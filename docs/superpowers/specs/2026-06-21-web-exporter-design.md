# Web Exporter (MVP) — Design Spec

Fecha: 2026-06-21

## Contexto y motivación

El proyecto actual (`cli/parse_kindle_notion_v1_1e.py`) requiere conectar el Kindle por USB y ejecutar un script Python desde la terminal. Esto es una barrera para usuarios sin conocimientos técnicos. Este spec define una versión web del exportador, pensada para que cualquier persona pueda generar sus `.md` para Notion sin instalar nada ni usar la línea de comandos.

## Alcance del MVP

- Replica el comportamiento de `cli/parse_kindle_notion_v1_1e.py` (sin la deduplicación por hash de `cli/parse_kindle_notion_v1_2_1_fix.py`).
- Solo descarga de `.md` (empaquetados en `.zip`). **Sin integración con la API de Notion** en esta versión — queda fuera de alcance.
- Sin backend: 100% client-side. El fichero `My Clippings.txt` del usuario nunca sale de su navegador.
- Sin persistencia entre sesiones: no hay backup automático, no hay log, no hay dedup. Cada subida es un ciclo independiente de principio a fin.

## Arquitectura

Sitio estático en `/web/` (HTML + CSS + JS vanilla, sin build step), desplegado en GitHub Pages directamente desde esa carpeta.

Única dependencia externa: **JSZip**, vendorizada localmente en `web/vendor/jszip.min.js` (no se carga desde CDN), para mantener la web funcional sin llamadas de red ocultas y coherente con la filosofía "cero dependencias externas" del proyecto Python original.

```
web/
├── index.html
├── style.css
├── parser.js     # lógica portada de parse_kindle_notion_v1_1e.py
├── app.js        # manejo de UI: drag&drop, render de la lista, generar zip
└── vendor/
    └── jszip.min.js
```

## Componentes

### `parser.js`

Puerto directo de la lógica de parsing de `cli/parse_kindle_notion_v1_1e.py`. Funciones puras, sin tocar el DOM:

- `parseEntries(text)` — divide el texto por `==========`, extrae título/autor/tipo/posición/página/fecha por bloque, agrupa por libro.
- `pairNotes(items)` — vincula notas con highlights por solapamiento de rango de posición (`rangesOverlap`) o coincidencia de página, igual que `pair_notes` en Python.
- `parsePos(meta)` / `parsePage(meta)` / `extractKind(meta)` / `parseAddedCompact(meta)` — extracción de metadatos individuales, con soporte es/en igual que el script actual (incluye el fix ya aplicado del regex `DASH` para rangos con guion ASCII).
- `renderBookMarkdown(title, author, items, sourceFilename)` — genera el string Markdown final por libro. **Corrección respecto al script Python:** `detect_lang_for_book` en `v1_1e` no detecta nada automáticamente — usa inglés fijo (`OUTPUT_LANG_DEFAULT = 'en'`) salvo que se edite manualmente `PER_BOOK_LANG` en el código, lo cual no es viable en una web sin backend. `parser.js` implementa detección real: `detectEntryLang(metaRaw)` clasifica cada entrada como `'es'`/`'en'`/`null` según patrones ya usados en `extractKind`/`parseAddedCompact` (ej. "Añadido el", "tu nota", "subrayado" → es; "Added on", "Your Note", "Highlight" → en); `detectBookLang(items)` hace recuento por mayoría sobre las entradas con idioma detectado y usa `'en'` como desempate (mismo valor por defecto que el script Python).
- `safeName(title)` — sanitiza el título para nombre de fichero, igual que `safe_name` en Python.

Entrada: texto crudo del fichero. Salida: array de `{ title, author, filename, markdown, stats: { highlights, notes, bookmarks } }`.

### `app.js`

Toda la lógica de interfaz:

- Zona de drag&drop + `<input type="file">` como alternativa al arrastre.
- Lectura del fichero con `FileReader.readAsText` (UTF-8).
- Llamada a `parser.parseEntries` + `parser.pairNotes` + `parser.renderBookMarkdown` por libro.
- Render de la lista de libros detectados (título, autor, conteos de highlights/notes/bookmarks) — sin previsualización del contenido completo del Markdown.
- Validación de "0 libros detectados" → mensaje de error, botón de descarga deshabilitado.
- Botón de descarga: construye un `JSZip` con un `.md` por libro, genera el blob y dispara la descarga vía `<a download>` temporal. Nombre del zip: `kindle-notion-export-YYYYMMDD.zip`.

**Contrato entre módulos:** `app.js` nunca interpreta el formato de Amazon directamente — solo pasa texto crudo a `parser.js` y pinta lo que recibe. Cambios en reglas de parsing se hacen únicamente en `parser.js`.

### `index.html` / `style.css`

Pantalla única (layout aprobado: opción A del mockup) — zona de drop, lista de libros con stats, botón de descarga. Sin wizard de pasos separados.

## Flujo de datos

1. Usuario arrastra o selecciona `My Clippings.txt`.
2. `app.js` lee el fichero como texto UTF-8.
3. `parser.parseEntries(texto)` agrupa las entradas por libro.
4. Por cada libro: `parser.pairNotes(items)` → `parser.renderBookMarkdown(...)`.
5. Si 0 libros → mensaje de error, flujo detenido.
6. Si ≥1 libro → se pinta la lista con stats y se habilita "Descargar todo (.zip)".
7. Al pulsar descargar → JSZip empaqueta todos los `.md`, se descarga el `.zip`.

Todo ocurre en memoria en un único ciclo síncrono tras soltar el fichero.

## Manejo de errores

- **0 libros detectados tras el parsing**: aviso claro (ej. *"No se ha podido leer ningún highlight de este fichero. ¿Es el `My Clippings.txt` correcto?"*), descarga deshabilitada.
- **Bloques individuales corruptos** (menos de 2 líneas tras split) dentro de un fichero por lo demás válido: se descartan en silencio, igual que `if len(lines) < 2: continue` en Python. No bloquea el resto del fichero.
- **Encoding / BOM**: `FileReader.readAsText` con UTF-8 maneja el BOM de forma nativa; se mantiene además el `.strip('﻿')` por línea como en el script Python, por seguridad.
- **Fallo de JSZip al generar el blob** (caso raro): mensaje de error genérico con opción de reintentar, sin perder la lista de libros ya parseada en pantalla.

## Testing

- `parser.js` se testea con fixtures de texto cubriendo los casos ya documentados en `CLAUDE.md`/README: rango de posición con guion ASCII (`Loc. 49-50`), metadatos en español vs inglés, nota vinculada a highlight por solapamiento de rango, bookmark sin texto asociado. Runner: `node:test` (stdlib de Node, sin dependencias de npm).
- No hay tests automatizados de UI/DOM en este MVP. Verificación manual: arrastrar un `My Clippings.txt` real y comparar el `.zip` descargado contra el output que generaría hoy `cli/parse_kindle_notion_v1_1e.py` para el mismo fichero.

## Gobernanza futura del parsing

A partir de esta versión, **`parser.js` pasa a ser la fuente de verdad para la lógica de parsing**. `cli/parse_kindle_notion_v1_1e.py` queda congelado tal cual está: sigue funcionando para quien lo use por CLI, pero no recibe nuevas funcionalidades de parsing. Los bugs y mejoras pendientes documentados en `CLAUDE.md` (regex título/autor con paréntesis anidados, colisión de nombre de fichero, manejo de encoding) se implementan de aquí en adelante únicamente en `parser.js`, no en el `.py`.

## Fuera de alcance (explícitamente, para esta versión)

- Integración con la API de Notion.
- Deduplicación de entradas (lógica de `cli/parse_kindle_notion_v1_2_1_fix.py`).
- Backup automático del fichero subido.
- Logs de ejecución.
- Tests automatizados de UI.
