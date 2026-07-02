/**
 * UI copy for the web exporter, keyed by language. This only covers
 * interface text (drop zone, errors, book list, download button) — it has
 * no effect on the language of the generated .md files, which is decided
 * per book by detectBookLang() in parser.js and is intentionally untouched
 * by this module.
 */
export const STRINGS = {
  es: {
    dropZone: '⬆️ Arrastra aquí tu "My Clippings.txt"<br>o haz clic para seleccionar',
    noHighlights: 'No se ha podido leer ningún highlight de este fichero. ¿Es el "My Clippings.txt" correcto?',
    processError: 'No se ha podido procesar el fichero. ¿Es el "My Clippings.txt" correcto?',
    readError: 'No se ha podido leer el fichero seleccionado.',
    zipError: 'No se ha podido generar el .zip. Inténtalo de nuevo.',
    bookCount: (n) => `${n} libro(s) detectado(s)`,
    bookListItem: (book) =>
      `${book.title}${book.author ? ' — ' + book.author : ''} — ${book.stats.highlights} subrayados, ${book.stats.notes} notas, ${book.stats.bookmarks} marcadores`,
    downloadLabel: '⬇️ Descargar todo (.zip)',
    generatingLabel: 'Generando…',
    processingLabel: 'Procesando fichero…',
    langWarning: '⚠️ Idioma no reconocido — revisa el resultado',
    downloadOneLabel: '⬇️ Descargar',
    dropZoneAriaLabel: 'Subir fichero My Clippings.txt',
    switchToDarkAriaLabel: 'Cambiar a modo oscuro',
    switchToLightAriaLabel: 'Cambiar a modo claro',
  },
  en: {
    dropZone: '⬆️ Drag your "My Clippings.txt" here<br>or click to browse',
    noHighlights: 'Couldn\'t read any highlights from this file. Is this the right "My Clippings.txt"?',
    processError: 'Couldn\'t process this file. Is this the right "My Clippings.txt"?',
    readError: 'Couldn\'t read the selected file.',
    zipError: 'Couldn\'t generate the .zip. Please try again.',
    bookCount: (n) => `${n} book(s) detected`,
    bookListItem: (book) =>
      `${book.title}${book.author ? ' — ' + book.author : ''} — ${book.stats.highlights} highlights, ${book.stats.notes} notes, ${book.stats.bookmarks} bookmarks`,
    downloadLabel: '⬇️ Download all (.zip)',
    generatingLabel: 'Generating…',
    processingLabel: 'Processing file…',
    langWarning: '⚠️ Unrecognized language — please check the result',
    downloadOneLabel: '⬇️ Download',
    dropZoneAriaLabel: 'Upload My Clippings.txt file',
    switchToDarkAriaLabel: 'Switch to dark mode',
    switchToLightAriaLabel: 'Switch to light mode',
  },
};

/**
 * Determines which language the UI should start in: a previously saved
 * manual choice wins; otherwise fall back to the browser's language.
 */
export function detectInitialLang() {
  const saved = localStorage.getItem('uiLang');
  if (saved === 'es' || saved === 'en') return saved;
  return navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
}
