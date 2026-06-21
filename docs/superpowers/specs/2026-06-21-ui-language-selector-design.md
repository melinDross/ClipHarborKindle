# UI Language Selector (EN/ES) — Design Spec

Fecha: 2026-06-21

## Contexto y motivación

La web exporter (`/web/`, ver `docs/superpowers/specs/2026-06-21-web-exporter-design.md`) tiene actualmente todos sus textos de interfaz fijados en español. Se añade un selector `EN / ES` con emoji de bandera en la cabecera para que un usuario angloparlante pueda usar la herramienta en su idioma.

## Alcance

- El selector cambia **únicamente los textos de la interfaz web** (zona de arrastre, mensajes de error, contador de libros, lista de libros, botón de descarga).
- **No afecta** al idioma de las etiquetas dentro de los `.md` generados — eso sigue decidiéndose automáticamente por libro vía `detectBookLang` (`web/parser.js`), sin cambios. `web/parser.js` no se toca en esta funcionalidad.
- Idioma inicial: `localStorage.getItem('uiLang')` si existe: si no, se detecta desde `navigator.language` (empieza por "en" → inglés; cualquier otro caso → español).
- Si el usuario cambia el idioma manualmente, la elección se guarda en `localStorage` y prevalece sobre la detección automática en visitas futuras.

## Componentes

### `web/strings.js` (nuevo)

Diccionario de textos de interfaz por idioma, sin dependencias de parsing:

```js
export const STRINGS = {
  es: {
    dropZone: '⬆️ Arrastra aquí tu "My Clippings.txt"<br>o haz clic para seleccionar',
    noHighlights: 'No se ha podido leer ningún highlight de este fichero. ¿Es el "My Clippings.txt" correcto?',
    processError: 'No se ha podido procesar el fichero. ¿Es el "My Clippings.txt" correcto?',
    readError: 'No se ha podido leer el fichero seleccionado.',
    zipError: 'No se ha podido generar el .zip. Inténtalo de nuevo.',
    bookCount: (n) => `${n} libro(s) detectado(s)`,
    bookListItem: (book) => `${book.title}${book.author ? ' — ' + book.author : ''} — ${book.stats.highlights} subrayados, ${book.stats.notes} notas, ${book.stats.bookmarks} marcadores`,
    downloadLabel: '⬇️ Descargar todo (.zip)',
    generatingLabel: 'Generando…',
  },
  en: {
    dropZone: '⬆️ Drag your "My Clippings.txt" here<br>or click to browse',
    noHighlights: 'Couldn\'t read any highlights from this file. Is this the right "My Clippings.txt"?',
    processError: 'Couldn\'t process this file. Is this the right "My Clippings.txt"?',
    readError: 'Couldn\'t read the selected file.',
    zipError: 'Couldn\'t generate the .zip. Please try again.',
    bookCount: (n) => `${n} book(s) detected`,
    bookListItem: (book) => `${book.title}${book.author ? ' — ' + book.author : ''} — ${book.stats.highlights} highlights, ${book.stats.notes} notes, ${book.stats.bookmarks} bookmarks`,
    downloadLabel: '⬇️ Download all (.zip)',
    generatingLabel: 'Generating…',
  },
};

export function detectInitialLang() {
  const saved = localStorage.getItem('uiLang');
  if (saved === 'es' || saved === 'en') return saved;
  return navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
}
```

Nota de corrección respecto al texto español actual: hoy `app.js` mezcla "highlights/notas/marcadores" (anglicismo) en la versión española de la lista de libros. La nueva versión `es` usa "subrayados/notas/marcadores", consistente con el resto de la interfaz en español.

### `web/strings.test.js` (nuevo)

Test con `node:test` que verifica que `STRINGS.es` y `STRINGS.en` tienen exactamente el mismo conjunto de claves (red de seguridad contra typos al añadir/editar textos). `detectInitialLang` no se testea automáticamente, porque depende de `localStorage`/`navigator`, globals de navegador fuera del alcance de los tests automatizados de este proyecto (mismo criterio ya aplicado a `app.js`).

### `web/index.html` (modificado)

Se añaden dos botones en la cabecera, junto al título:

```html
<header class="nav">
  <span>📚 Kindle → Notion Exporter</span>
  <div class="lang-switch">
    <button id="lang-es" class="lang-button" type="button">🇪🇸 ES</button>
    <button id="lang-en" class="lang-button" type="button">🇬🇧 EN</button>
  </div>
</header>
```

`style.css` añade `.lang-switch`/`.lang-button`/`.lang-button.active` para el layout y el resaltado del idioma activo.

### `web/app.js` (modificado)

- Importa `STRINGS`, `detectInitialLang` de `./strings.js`.
- Mantiene `let currentLang = detectInitialLang();` y `let lastErrorKey = null;` (para poder re-renderizar el mensaje de error correcto si el usuario cambia de idioma mientras hay un error visible).
- `t(key)` devuelve `STRINGS[currentLang][key]`.
- `showError(key)` pasa a recibir una **clave** de traducción (`'noHighlights'`, `'processError'`, `'readError'`, `'zipError'`) en vez de un string literal; guarda la clave en `lastErrorKey` y renderiza `t(key)`.
- `renderBooks(books)` usa `t('bookCount')(books.length)` y `t('bookListItem')(book)` para construir los textos.
- `applyLang(lang)`: actualiza `currentLang`, persiste en `localStorage.setItem('uiLang', lang)`, actualiza `dropZone.innerHTML`, el label del botón de descarga (solo si no está en mitad de una descarga), la clase `.active` de los botones de idioma, y re-renderiza en caliente el mensaje de error o la lista de libros si están visibles en ese momento.
- Los botones `#lang-es`/`#lang-en` llaman a `applyLang('es')`/`applyLang('en')` en su evento `click`.
- Se llama a `applyLang(currentLang)` una vez al cargar el script, para que la interfaz arranque ya en el idioma detectado (sustituyendo el texto en español fijado en el HTML).

## Testing

- `web/strings.test.js`: test de paridad de claves entre `STRINGS.es` y `STRINGS.en` (vía `node --test web/strings.test.js`).
- Sin tests automatizados de UI para el selector en sí (cambio de idioma, persistencia en `localStorage`) — verificación manual en navegador, consistente con el resto de `app.js`.

## Fuera de alcance

- Forzar el idioma de salida de los `.md` generados (sigue siendo automático por libro, vía `detectBookLang`).
- Más idiomas que español/inglés.
- Detección de idioma dentro de `parser.js` — no se toca ese módulo.
