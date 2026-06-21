# Parser Fixes + Per-Book Download + Accessibility — Design Spec

Fecha: 2026-06-21

## Contexto y motivación

Tras completar el MVP del exportador web y el selector de idioma, se hizo un análisis del estado de `web/parser.js`/`web/app.js` cruzando los bugs ya documentados en `CLAUDE.md` (heredados del script Python congelado) con hallazgos menores acumulados en revisiones anteriores. De esa lista, se priorizan para esta ronda: tres bugs reales (colisión de nombre de fichero, regex título/autor, idiomas no soportados silenciosos), dos mejoras de robustez (idioma de notas fusionadas, split de bloques), accesibilidad básica, y la funcionalidad pendiente de descarga individual por libro.

Quedan **fuera de esta ronda** (deferidos): límite de tamaño/tipo de fichero antes de leerlo, complejidad O(n²) de `pairNotes`, y los huecos de cobertura de test ya señalados (tie-break de fecha/página en el sort, alguna rama de Bookmark, señal mixta ES/EN en `detectEntryLang`).

## Cambios en `web/parser.js`

### 1. `safeName()` deja de convertir espacios en guion bajo

```js
export function safeName(name) {
  const cleaned = name.replace(/[^\p{L}\p{N}_\s-]/gu, '').trim();
  return cleaned.replace(/\s+/g, ' ');
}
```

Sigue eliminando los mismos caracteres que hoy (todo lo que no sea letra/dígito/guion bajo/espacio/guion, vía la misma clase Unicode-aware `\p{L}\p{N}`), pero colapsa espacios múltiples en uno solo en vez de convertirlos en `_`. Esto cambia el comportamiento de los 3 tests existentes de `safeName` en `parser.test.js`, que se actualizan como parte de este cambio (no es una regresión, es la corrección pedida).

### 2. Nombre de fichero incluye el autor

En `exportBooks`, el campo `filename` pasa de `${safeName(title)}.md` a:

```js
filename: author ? `${safeName(title)} (${safeName(author)}).md` : `${safeName(title)}.md`,
```

Esto resuelve la colisión documentada como bug #3 en `CLAUDE.md`: dos libros con el mismo título y distinto autor ya no se sobrescriben en el `.zip` ni al descargar individualmente (ver punto 7).

### 3. Regex título/autor soporta paréntesis anidados

```js
// Antes:
const titleMatch = titleLine.match(/^(.+?)\s*\((.+?)\)\s*$/);
// Después:
const titleMatch = titleLine.match(/^(.+)\s*\(([^()]+)\)\s*$/);
```

El grupo de título pasa a ser *greedy* (`.+` en vez de `.+?`) y el grupo de autor exige que no contenga paréntesis (`[^()]+`). Esto hace que el regex tome siempre el **último** grupo de paréntesis sin anidar como autor, en vez de quedarse colgado en el primer paréntesis que encuentra. Resuelve el bug #2 de `CLAUDE.md`: `"Parque Jurásico (Z-Library) (Michael Crichton)"` pasa a parsear `title="Parque Jurásico (Z-Library)"`, `author="Michael Crichton"` en vez de un autor corrupto.

### 4. `detectBookLang` se calcula sobre las entradas sin fusionar

En `exportBooks`, donde hoy se llama `detectBookLang(paired)` (la lista ya procesada por `pairNotes`, donde las notas fusionadas en un highlight pierden su propio campo `lang`), pasa a llamarse `detectBookLang(group.items)` — la lista original de entradas del grupo, antes de fusionar. Así, una nota que se fusiona en un highlight sigue aportando su idioma detectado al voto de mayoría, en vez de descartarse silenciosamente.

### 5. Campo `langDetected` por libro

`exportBooks` añade un booleano al objeto de cada libro:

```js
langDetected: group.items.some((it) => it.lang !== null),
```

`true` si al menos una entrada del libro tuvo un idioma reconocido (ES o EN); `false` si ninguna entrada coincidió con ningún patrón de `detectEntryLang` (p. ej. Kindle configurado en francés, alemán o portugués). `app.js` usa este campo para mostrar el aviso por libro (punto 8 más abajo). No cambia el comportamiento de `detectBookLang`, que sigue devolviendo `'es'`/`'en'` (con `'en'` como fallback) independientemente de este campo — `langDetected` es solo informativo para la UI.

### 6. Split de bloques robusto frente al delimitador `"=========="`

`parseEntries` deja de hacer `text.split('==========')` (que reconocería el delimitador aunque apareciera como subcadena dentro de un highlight real) y pasa a partir línea a línea, reconociendo el delimitador solo cuando ocupa una línea completa:

```js
export function parseEntries(text) {
  const order = [];
  const byKey = new Map();

  const blocks = [];
  let current = [];
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    if (rawLine.trim() === '==========') {
      blocks.push(current);
      current = [];
    } else {
      current.push(rawLine);
    }
  }
  blocks.push(current);

  for (const blockLines of blocks) {
    const lines = blockLines
      .map((l) => l.replace(/^﻿+|﻿+$/g, '').trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    // ... resto igual que hoy (título/autor, entry, agrupación por clave)
  }

  return order;
}
```

## Cambios en `web/strings.js`

Nuevas claves por idioma:

```js
es: {
  // ...existentes...
  langWarning: '⚠️ Idioma no reconocido — revisa el resultado',
  downloadOneLabel: '⬇️ Descargar',
  dropZoneAriaLabel: 'Subir fichero My Clippings.txt',
},
en: {
  // ...existentes...
  langWarning: '⚠️ Unrecognized language — please check the result',
  downloadOneLabel: '⬇️ Download',
  dropZoneAriaLabel: 'Upload My Clippings.txt file',
},
```

`bookListItem` se mantiene tal cual (sigue devolviendo el texto descriptivo de un libro); el botón de descarga individual y el aviso de idioma se renderizan como elementos DOM separados dentro de la fila, no concatenados en ese string.

## Cambios en `web/app.js`

### 7. Lista de libros como filas con botón de descarga individual

`renderBooks` deja de hacer `li.textContent = ...` y construye cada `<li>` como una fila con tres partes: el texto descriptivo, el aviso de idioma (si aplica) y el botón de descarga individual:

```js
function renderBooks(books) {
  currentBooks = books;
  lastErrorKey = null;
  errorMessage.hidden = true;

  if (books.length === 0) {
    showError('noHighlights');
    return;
  }

  bookCount.textContent = t('bookCount')(books.length);
  bookList.innerHTML = '';
  for (const book of books) {
    const li = document.createElement('li');
    li.className = 'book-row';

    const textSpan = document.createElement('span');
    textSpan.textContent = t('bookListItem')(book);
    if (!book.langDetected) {
      textSpan.textContent += ` ${t('langWarning')}`;
    }
    li.appendChild(textSpan);

    const downloadOneButton = document.createElement('button');
    downloadOneButton.type = 'button';
    downloadOneButton.className = 'download-one-button';
    downloadOneButton.textContent = t('downloadOneLabel');
    downloadOneButton.addEventListener('click', () => downloadSingleBook(book));
    li.appendChild(downloadOneButton);

    bookList.appendChild(li);
  }
  results.hidden = false;
}
```

El aviso de idioma se concatena como texto plano al final de la línea (no un icono separado) para mantener la implementación simple y consistente con el resto de la interfaz, que ya usa solo texto/emoji sin iconografía SVG.

### 8. Descarga individual por libro

Nueva función `downloadSingleBook(book)`, que reutiliza el mismo patrón blob+ancla ya corregido en el botón de "descargar todo" (adjuntar al DOM, click, quitar del DOM, revocar la URL con un `setTimeout` para evitar el bug de nombre de fichero perdido ya solucionado):

```js
function downloadSingleBook(book) {
  const blob = new Blob([book.markdown], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = book.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
```

No depende de JSZip (es un único fichero de texto, no un zip).

### 9. Accesibilidad

- `dropZone` gana `role="button"`, `tabindex="0"`, `aria-label` (vía `t('dropZoneAriaLabel')`, aplicado en `applyLang`), y un manejador de teclado:

  ```js
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  ```

- Los botones de idioma sincronizan `aria-pressed` junto con la clase `.active` en `applyLang`:

  ```js
  langEsButton.setAttribute('aria-pressed', String(lang === 'es'));
  langEnButton.setAttribute('aria-pressed', String(lang === 'en'));
  ```

- `web/index.html`: `#error-message` gana `aria-live="polite"` (atributo estático, sin cambios en JS) y `#book-count` gana `aria-live="polite"` para que un lector de pantalla anuncie tanto los errores como el número de libros detectados cuando aparecen.

## Cambios en `web/style.css`

Nueva regla para la fila de cada libro y su botón:

```css
.book-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.download-one-button {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 0.85rem;
  cursor: pointer;
}
```

`#book-list li` mantiene su `padding`/`border-bottom` ya existentes; solo cambia el contenido interno de cada `<li>` de texto plano a la fila flex anterior.

## Testing

- `web/parser.test.js`: se actualizan los 3 tests existentes de `safeName` (espacios en vez de guion bajo) y se añaden tests para: el regex título/autor con paréntesis anidados, el campo `filename` con autor en `exportBooks`, el campo `langDetected` (true/false), y el split robusto frente a un highlight que contenga literalmente `"=========="` en su texto.
- Sin tests automatizados para los cambios de `app.js` (botón de descarga individual, accesibilidad) — verificación manual en navegador, consistente con el resto del proyecto.

## Fuera de alcance (explícitamente, para esta ronda)

- Límite de tamaño/tipo de fichero antes de leerlo.
- Optimización de la complejidad O(n²) de `pairNotes`.
- Cobertura de test de los huecos ya señalados en rondas anteriores (tie-break sort, ramas de Bookmark, señal mixta `detectEntryLang`).
- Cualquier mecanismo más avanzado que un único string de aviso por idioma no reconocido (p. ej. detección de qué idioma sí podría ser, soporte real de más idiomas).
