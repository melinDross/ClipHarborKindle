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

### 2. Duplicado de libro por regex título/autor mal formado (PENDIENTE)

Evidencia en `Books/`: existen `Parque_Jurasico.md` y `Parque_Jurásico.md` como ficheros separados para el mismo libro, con autor mal parseado en ambos (`Z-Library) (Michael Crichton`, `Jurassic Park) (Crichton, Michael`).

**Causa:** el regex `^(?P<title>.+?)\s*\((?P<author>.+?)\)\s*$` no soporta paréntesis anidados tipo `Título (Z-Library) (Autor)`.

**Pendiente:** arreglar el regex y fusionar manualmente ambos ficheros en uno.

### 3. Colisión de nombre de fichero por título únicamente (PENDIENTE)

`safe_name(title)` ignora el autor al generar el nombre del `.md`. Dos libros con mismo título y distinto autor podrían pisarse/mezclarse en el mismo fichero.

### 4. `errors='ignore'` en lectura del fichero fuente (PENDIENTE)

`file.read_text(encoding='utf-8', errors='ignore')` descarta bytes mal formados sin avisar — riesgo de corrupción silenciosa de texto. Probablemente relacionado con el bug #2.

## Mejoras pendientes (por prioridad)

1. ~~Arreglar regex `DASH`~~ — hecho
2. Consolidar los scripts en uno solo (eliminar duplicación entre v1_1e y v1_2_1_fix)
3. Arreglar regex título/autor + usar (título, autor) en el nombre de fichero
4. Fusionar manualmente los `Parque_Jurásico*.md` duplicados
5. Tests con fixtures cubriendo los edge cases ya documentados en el README
6. Manejo explícito de errores de encoding en vez de `errors='ignore'`
