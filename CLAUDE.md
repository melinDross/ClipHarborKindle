# CLAUDE.md — Memoria técnica del proyecto

Este fichero documenta cambios técnicos, bugs encontrados y decisiones relevantes a medida que se trabaja en el proyecto. Se actualiza en cada sesión de trabajo con Claude.

## Convención de uso de git

- Nunca añadir línea `Co-Authored-By` de Claude en los commits de este repo (instrucción explícita del usuario, aplicada también retroactivamente vía `git filter-branch` + force push).

## Estado de los scripts

- `parse_kindle_notion_v1_1d.py` — **eliminado** del root (era versión de referencia, redundante con v1_1e).
- `cli/parse_kindle_notion_v1_1e.py` — versión marcada como estable en el README. **Congelado** (ver "Gobernanza del parsing" más abajo): sigue funcionando por CLI, pero no recibe nuevas funcionalidades de parsing. Movido de la raíz a `cli/` el 2026-06-21 (junto con `v1_2_1_fix.py`) para no mezclar los scripts Python con la nueva web en `/web/`.
- `cli/parse_kindle_notion_v1_2_1_fix.py` — experimento con dedup vía hash SHA1 embebido (`<!-- key:... -->`) y modo append-only. El README dice que la dedup de v1.2 se "canceló", pero este script sí la implementa de forma funcional — pendiente de decidir si se promueve a versión estable o se documenta como experimental.

## Gobernanza del parsing (a partir de 2026-06-21)

Se está construyendo una versión web del exportador (`/web/`, ver spec en `docs/superpowers/specs/2026-06-21-web-exporter-design.md`) pensada para usuarios sin conocimientos técnicos: corre 100% en el navegador (sin backend), con la lógica de parsing portada a `web/parser.js`.

**`web/parser.js` pasa a ser la fuente de verdad de la lógica de parsing.** `cli/parse_kindle_notion_v1_1e.py` queda congelado: los bugs y mejoras pendientes de este documento (regex título/autor, colisión de nombre de fichero, manejo de encoding) se implementan de aquí en adelante solo en `parser.js`, no en el `.py`. El script Python no se retira del repo, pero no se itera más sobre su lógica de parsing.

## Bugs encontrados

### 1. Regex `DASH` roto — rangos de posición con guion ASCII no se parseaban (CORREGIDO)

```python
# Antes (bug):
DASH = r'[\\-–—]'
# Después (fix):
DASH = r'[-–—]'
```

**Causa:** `[\\-–—]` se interpretaba como un rango de caracteres Unicode entre `\` (0x5C) y `–` (0x2013), en vez de una clase de caracteres literal con guion, en-dash y em-dash. Esto hacía que un guion ASCII normal (`-`) **no** matchee la clase, así que `Loc. 49-50` se parseaba como `pos_start=49, pos_end=None` (colapsado a un solo punto) en vez de `pos_start=49, pos_end=50`.

**Impacto:** Rompía silenciosamente el pareado de notas con highlights por solapamiento de rango (`ranges_overlap`) para el formato más común de Kindle (guion ASCII), que es justo la función central del proyecto.

**Verificado con:**
```python
parse_pos('Loc. 49-50')  # antes: ('Pos 49', 49, None) → ahora: ('Pos 49-50', 49, 50)
```

**Aplicado en:** `v1_1e` y `v1_2_1_fix` (v1_1d fue eliminado antes de aplicar el fix ahí).

### 2. Duplicado de libro por regex título/autor mal formado (CORREGIDO solo en `web/parser.js`)

Evidencia en `Books/`: existen `Parque_Jurasico.md` y `Parque_Jurásico.md` como ficheros separados para el mismo libro, con autor mal parseado en ambos (`Z-Library) (Michael Crichton`, `Jurassic Park) (Crichton, Michael`).

**Causa:** el regex `^(?P<title>.+?)\s*\((?P<author>.+?)\)\s*$` no soporta paréntesis anidados tipo `Título (Z-Library) (Autor)`.

**Fix (2026-06-21, solo en `web/parser.js`, NO en `cli/parse_kindle_notion_v1_1e.py` — ver "Gobernanza del parsing"):** el regex pasó a `^(.+)\s*\(([^()]+)\)\s*$` (grupo de título *greedy*, grupo de autor sin paréntesis), de forma que siempre toma el último grupo de paréntesis sin anidar como autor. `"Parque Jurásico (Z-Library) (Michael Crichton)"` pasa a parsear `title="Parque Jurásico (Z-Library)"`, `author="Michael Crichton"`. Cubierto por tests en `web/parser.test.js`.

**Sigue pendiente:** fusionar manualmente los ficheros `Parque_Jurásico*.md` ya existentes en `Books/` (esto es limpieza de datos, no de código, y no se resuelve solo con el fix del regex). El `.py` sigue teniendo el bug si se usa directamente.

### 3. Colisión de nombre de fichero por título únicamente (CORREGIDO solo en `web/parser.js`)

`safe_name(title)` ignora el autor al generar el nombre del `.md`. Dos libros con mismo título y distinto autor podrían pisarse/mezclarse en el mismo fichero.

**Fix (2026-06-21, solo en `web/parser.js`):** `exportBooks` genera el filename como `${safeName(title)} (${safeName(author)}).md` cuando hay autor (si no, `${safeName(title)}.md` como antes). De paso, `safeName()` dejó de convertir espacios en `_` y ahora solo los colapsa, para que el nombre del fichero sea más legible. El `.py` sigue sin el autor en el filename.

### 4. `errors='ignore'` en lectura del fichero fuente (PENDIENTE)

`file.read_text(encoding='utf-8', errors='ignore')` descarta bytes mal formados sin avisar — riesgo de corrupción silenciosa de texto. Probablemente relacionado con el bug #2. Solo afecta al `.py` — la web lee con `FileReader.readAsText(file, 'utf-8')`, que no tiene un equivalente directo a `errors='ignore'` pero tampoco se ha auditado este caso ahí.

## Ronda 2026-06-21: fixes de parser + descarga por libro + accesibilidad (solo `web/`)

Ver spec completo en `docs/superpowers/specs/2026-06-21-parser-fixes-and-per-book-download-design.md` y plan en `docs/superpowers/plans/2026-06-21-parser-fixes-and-per-book-download.md`. Resumen de lo añadido a `web/parser.js`/`web/app.js`/`web/strings.js` (nada de esto toca el `.py`):

- Bugs #2 y #3 de arriba, corregidos.
- `detectBookLang` ahora vota sobre las entradas **sin fusionar** (antes perdía el idioma de una nota fusionada en un highlight por `pairNotes`).
- Nuevo campo `langDetected` por libro (booleano informativo): si ninguna entrada tuvo idioma reconocido, la UI muestra un aviso "⚠️ Idioma no reconocido" en la fila del libro.
- `parseEntries` ya no usa `text.split('==========')` (que rompía si un highlight contenía esa cadena literal como subcadena); ahora parte línea a línea, reconociendo el delimitador solo cuando ocupa una línea completa.
- Botón de descarga individual por libro (además del zip de "descargar todo").
- Accesibilidad básica: drop-zone navegable por teclado (`role="button"`, `Enter`/`Space`), `aria-pressed` en los botones de idioma, `aria-live` en mensajes de error y contador de libros.

## Diferencias de comportamiento CLI vs. web (no son bugs, pero generan confusión si no se documentan)

### La web no hace backup del `My Clippings.txt` — y no le hace falta

El CLI copia el `My Clippings.txt` original a `backups/` con timestamp antes de cada ejecución (ver Fase 3 del README). La web **no tiene ningún mecanismo equivalente** — confirmado: no hay ninguna referencia a "backup" en `web/app.js` ni `web/parser.js`.

**Por qué no es una regresión:** el backup del CLI protege contra un riesgo muy concreto que no existe en la web. El CLI lee `My Clippings.txt` y **escribe** los `.md` de salida en `Books/`, sobrescribiendo la ejecución anterior — si el parsing fallaba o tenía un bug, se perdía el output bueno anterior sin poder recuperarlo, de ahí la necesidad de un backup del fichero fuente para poder re-procesar. La web nunca escribe nada en el disco del usuario salvo lo que se descarga explícitamente (el `.zip` o un `.md` individual, vía `Blob`/`URL.createObjectURL`): lee el fichero en memoria con `FileReader.readAsText()`, lo procesa, y el `My Clippings.txt` original queda exactamente donde estaba, sin tocar. No hay nada que la web pueda sobrescribir o corromper del lado del usuario, así que no hay nada que respaldar.

**El único riesgo real en la web** es distinto: si el usuario cierra la pestaña antes de descargar, pierde el resultado procesado (no el fichero original) y tiene que volver a arrastrar el `.txt`. Esto está documentado aquí para que quede claro que es una diferencia de diseño, no un descuido — si en el futuro se quisiera mitigar, sería con un aviso en la UI antes de cerrar/recargar con resultados sin descargar (`beforeunload`), no con un backup del fichero fuente.

## Documentación externa actualizada

- **README.md (2026-06-21):** reescrito para reflejar que `web/parser.js` es ahora la fuente de verdad y `cli/parse_kindle_notion_v1_1e.py` está congelado. Se mantuvo el formato narrativo de portfolio QA (origen, fases, decisiones, testing, historial de versiones) y se añadió una "Fase 5 — Migración a web" explicando el por qué de la migración y de la gobernanza de parsing. También se documentó ahí el cambio de criterio sobre tests automatizados (el CLI no los tiene por decisión consciente; la web sí, y se explica por qué cambió el contexto).

## Ronda 2026-07-03: auditoría exhaustiva + quick wins de seguridad/accesibilidad/SEO (solo `web/`)

Auditoría multi-disciplinar (seguridad, accesibilidad WCAG 2.2 AA, SEO/GEO, rendimiento, visual/mobile) guardada en `docs/audit-clipharbor4kindle-2026-07-03@00:35.md`. De los 10 hallazgos, se implementaron los quick wins #3-7, #9 y #10 (todos solo en `web/`):

- **CSP:** añadido `frame-ancestors 'none'` a la política ya existente en `web/index.html` (mitiga clickjacking; `X-Frame-Options` no es viable como header real en GitHub Pages sin tooling adicional).
- **`<h1>`:** el `<span>` de marca en el header pasó a `<h1>` — antes el único heading de la página era el `<h2>` de `#book-count`, rompiendo la jerarquía de encabezados.
- **Touch targets:** `.lang-button` y `.download-one-button` ahora cumplen el mínimo de 44×44px (WCAG 2.5.5/2.5.8) — antes tenían `padding: 4px 8px/10px`, insuficiente para uso táctil.
- **SRI en JSZip:** `web/vendor/jszip.min.js` pasó a cargarse con hash `integrity` (sha384) pinneado, como defensa en profundidad ante manipulación del fichero vendorizado.
- **Lazy-load de JSZip:** se quitó el `<script src="vendor/jszip.min.js">` estático de `index.html`; ahora `app.js` lo inyecta bajo demanda (`loadJSZip()`) solo al pulsar "descargar todo (.zip)" — la descarga individual por libro (`downloadSingleBook`) nunca lo necesitó, así que antes se pagaba ese coste de parseo en toda visita sin motivo.
- **Referrer-Policy:** añadido `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **Header responsive:** `.nav`/`.header-actions` pasaron a `flex-wrap: wrap` con `row-gap`, para que en viewports <360px el badge de Ko-fi y los botones de idioma no se compriman/corten en una sola fila sin wrap.

**Pendiente de la auditoría (no implementado en esta ronda):** meta description/Open Graph/canonical, `robots.txt`/`sitemap.xml`, structured data (Schema.org `SoftwareApplication`), `aria-live` cubriendo el `<ul>` de libros completo, y favicon — ver el informe completo para el detalle de cada uno.

## Mejoras pendientes (por prioridad)

1. ~~Arreglar regex `DASH`~~ — hecho
2. Consolidar los scripts en uno solo (eliminar duplicación entre v1_1e y v1_2_1_fix)
3. ~~Arreglar regex título/autor + usar (título, autor) en el nombre de fichero~~ — hecho, solo en `web/parser.js` (ver ronda 2026-06-21 arriba)
4. Fusionar manualmente los `Parque_Jurásico*.md` duplicados ya existentes en `Books/`
5. Tests con fixtures cubriendo los edge cases ya documentados en el README (para el `.py`; `web/parser.js` ya tiene su propia suite en `web/parser.test.js`)
6. Manejo explícito de errores de encoding en vez de `errors='ignore'` (en el `.py`)
