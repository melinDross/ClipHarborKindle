# UI Language Selector (EN/ES) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an EN/ES language selector (with flag emoji) to the web exporter's header that switches all interface copy (drop zone, error messages, book list, download button) between Spanish and English, defaulting to the browser's language and remembering manual choices.

**Architecture:** A new pure data module (`web/strings.js`) holds both languages' UI copy and the initial-language detection logic. `web/app.js` is refactored to read all user-facing text through a `t(key)` lookup instead of hardcoded literals, and a new `applyLang(lang)` function re-renders whatever is currently on screen when the user clicks one of the two new header buttons.

**Tech Stack:** Vanilla JavaScript (ES modules), `localStorage`, `navigator.language`, Node's built-in `node:test` for the one pure-data test.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-06-21-ui-language-selector-design.md`.
- This feature changes ONLY interface copy. It must not modify `web/parser.js` or anything related to `detectBookLang`/per-book output-language detection — those stay exactly as they are.
- No new npm dependencies, no build step — plain ES modules, consistent with the rest of `/web/`.
- Initial language: `localStorage.getItem('uiLang')` if it is exactly `'es'` or `'en'`; otherwise derive from `navigator.language` (starts with `"en"` → `'en'`, anything else → `'es'`).
- Manual language switches must be persisted to `localStorage` under the key `uiLang` and must win over `navigator.language` on the next visit.
- The Spanish book-list copy must say "subrayados/notas/marcadores" (not the current "highlights/notas/marcadores" anglicism mix) — this is an intentional correction, not a regression.
- No automated tests for DOM/browser-global behavior (consistent with the rest of this project) — only the `STRINGS` dictionary's key-parity gets an automated test; everything else is manually verified in a browser.

---

### Task 1: `web/strings.js` — UI copy dictionary + initial-language detection

**Files:**
- Create: `web/strings.js`
- Create: `web/strings.test.js`

**Interfaces:**
- Produces:
  - `export const STRINGS = { es: {...}, en: {...} }` where each language object has the keys: `dropZone` (string with `<br>`), `noHighlights` (string), `processError` (string), `readError` (string), `zipError` (string), `bookCount` (function `(n: number) => string`), `bookListItem` (function `(book: {title, author, stats: {highlights, notes, bookmarks}}) => string`), `downloadLabel` (string), `generatingLabel` (string).
  - `export function detectInitialLang(): 'es' | 'en'` — reads `localStorage`/`navigator`, both browser globals (not available under `node:test`, so this function is never called from `strings.test.js`, only declared/exported there).

- [ ] **Step 1: Write the failing test**

Create `web/strings.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from './strings.js';

test('STRINGS has exactly the es and en language keys', () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), ['en', 'es']);
});

test('STRINGS.es and STRINGS.en expose exactly the same set of text keys', () => {
  const esKeys = Object.keys(STRINGS.es).sort();
  const enKeys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(esKeys, enKeys);
});

test('bookCount renders a count into both languages', () => {
  assert.equal(STRINGS.es.bookCount(3), '3 libro(s) detectado(s)');
  assert.equal(STRINGS.en.bookCount(3), '3 book(s) detected');
});

test('bookListItem renders title, author, and stats in Spanish using subrayados/notas/marcadores', () => {
  const book = { title: 'Steve Jobs', author: 'Walter Isaacson', stats: { highlights: 5, notes: 2, bookmarks: 1 } };
  assert.equal(
    STRINGS.es.bookListItem(book),
    'Steve Jobs — Walter Isaacson — 5 subrayados, 2 notas, 1 marcadores'
  );
});

test('bookListItem renders title, author, and stats in English using highlights/notes/bookmarks', () => {
  const book = { title: 'Steve Jobs', author: 'Walter Isaacson', stats: { highlights: 5, notes: 2, bookmarks: 1 } };
  assert.equal(
    STRINGS.en.bookListItem(book),
    'Steve Jobs — Walter Isaacson — 5 highlights, 2 notes, 1 bookmarks'
  );
});

test('bookListItem omits the author dash when there is no author', () => {
  const book = { title: 'Untitled Collection', author: '', stats: { highlights: 1, notes: 0, bookmarks: 0 } };
  assert.equal(STRINGS.es.bookListItem(book), 'Untitled Collection — 1 subrayados, 0 notas, 0 marcadores');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test web/strings.test.js`
Expected: FAIL — `web/strings.js` does not exist yet (`Cannot find module`).

- [ ] **Step 3: Write the minimal implementation**

Create `web/strings.js`:

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test web/strings.test.js`
Expected: PASS (6 tests passing)

- [ ] **Step 5: Run the full web test suite to confirm no regressions**

Run: `node --test web/`
Expected: PASS (51 tests total — 45 from `parser.test.js` + 6 from `strings.test.js`)

- [ ] **Step 6: Commit**

```bash
git add web/strings.js web/strings.test.js
git commit -m "Add STRINGS dictionary and detectInitialLang for the EN/ES UI selector"
```

---

### Task 2: `index.html` + `style.css` — language selector buttons

**Files:**
- Modify: `web/index.html`
- Modify: `web/style.css`

**Interfaces:**
- Produces: DOM elements `#lang-es` and `#lang-en` (buttons) that Task 3's `app.js` will attach click listeners to and toggle an `.active` class on.

- [ ] **Step 1: Update the header markup in `web/index.html`**

Find this line:

```html
  <header class="nav">📚 Kindle → Notion Exporter</header>
```

Replace it with:

```html
  <header class="nav">
    <span>📚 Kindle → Notion Exporter</span>
    <div class="lang-switch">
      <button id="lang-es" class="lang-button" type="button">🇪🇸 ES</button>
      <button id="lang-en" class="lang-button" type="button">🇬🇧 EN</button>
    </div>
  </header>
```

- [ ] **Step 2: Update `.nav` and add language-button styles in `web/style.css`**

Find this rule:

```css
.nav {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 24px;
}
```

Replace it with:

```css
.nav {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lang-switch {
  display: flex;
  gap: 4px;
}

.lang-button {
  padding: 4px 8px;
  font-size: 0.85rem;
  font-weight: 400;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.lang-button.active {
  background: #eef;
  border-color: #88a;
  font-weight: 600;
}
```

- [ ] **Step 3: Verify manually**

Run: `python3 -m http.server 8000 --directory web`, open `http://localhost:8000/`.
Expected: the header now shows the title on the left and two small buttons (`🇪🇸 ES` / `🇬🇧 EN`) on the right. Clicking them does nothing yet — that's Task 3. No console errors.

- [ ] **Step 4: Commit**

```bash
git add web/index.html web/style.css
git commit -m "Add EN/ES language selector buttons to the header"
```

---

### Task 3: `app.js` — wire the language selector and translate all UI copy

**Files:**
- Modify: `web/app.js` (full rewrite of the file's content, shown below)

**Interfaces:**
- Consumes: `STRINGS`, `detectInitialLang` from `./strings.js` (Task 1); `#lang-es`/`#lang-en` from `index.html` (Task 2); `exportBooks` from `./parser.js` (unchanged, already in place).

- [ ] **Step 1: Replace the full contents of `web/app.js`**

```javascript
import { exportBooks } from './parser.js';
import { STRINGS, detectInitialLang } from './strings.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const errorMessage = document.getElementById('error-message');
const results = document.getElementById('results');
const bookCount = document.getElementById('book-count');
const bookList = document.getElementById('book-list');
const downloadButton = document.getElementById('download-button');
const langEsButton = document.getElementById('lang-es');
const langEnButton = document.getElementById('lang-en');

let currentBooks = [];
let currentLang = detectInitialLang();
let lastErrorKey = null;

function t(key) {
  return STRINGS[currentLang][key];
}

function showError(key) {
  lastErrorKey = key;
  errorMessage.textContent = t(key);
  errorMessage.hidden = false;
  results.hidden = true;
}

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
    li.textContent = t('bookListItem')(book);
    bookList.appendChild(li);
  }
  results.hidden = false;
}

/**
 * Switches the UI language, persists the choice, and re-renders whatever
 * is currently on screen (the drop zone copy always; the error message or
 * book list only if one of them is currently visible).
 */
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('uiLang', lang);

  dropZone.innerHTML = t('dropZone');
  if (!downloadButton.disabled) downloadButton.textContent = t('downloadLabel');
  langEsButton.classList.toggle('active', lang === 'es');
  langEnButton.classList.toggle('active', lang === 'en');

  if (!errorMessage.hidden && lastErrorKey) {
    errorMessage.textContent = t(lastErrorKey);
  }
  if (!results.hidden && currentBooks.length > 0) {
    renderBooks(currentBooks);
  }
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const books = exportBooks(reader.result, file.name);
      renderBooks(books);
    } catch (err) {
      showError('processError');
    }
  };
  reader.onerror = () => showError('readError');
  reader.readAsText(file, 'utf-8');
}

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

langEsButton.addEventListener('click', () => applyLang('es'));
langEnButton.addEventListener('click', () => applyLang('en'));

function buildZipFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `kindle-notion-export-${yyyy}${mm}${dd}.zip`;
}

downloadButton.addEventListener('click', async () => {
  downloadButton.disabled = true;
  downloadButton.textContent = t('generatingLabel');

  try {
    const zip = new JSZip();
    for (const book of currentBooks) {
      zip.file(book.filename, book.markdown);
    }
    const blob = await zip.generateAsync({ type: 'blob' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = buildZipFilename();
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    showError('zipError');
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = t('downloadLabel');
  }
});

applyLang(currentLang);
```

Note on a small deliberate behavior change from the previous version: the download button used to snapshot its current `textContent` before showing "Generando…" and restore that exact snapshot afterwards. It now restores via `t('downloadLabel')` instead, so the label is always correct for whichever language is active by the time the download finishes (relevant only in the edge case where a user switches language while a download is in flight). This is a one-line simplification, not a regression — the snapshot and the translated label were always the same string before this feature existed.

- [ ] **Step 2: Verify manually — language switch updates static copy**

Run: `python3 -m http.server 8000 --directory web`, open `http://localhost:8000/` in a private/incognito window (so no `uiLang` is set in `localStorage` yet).
Expected: the page loads in Spanish or English depending on your browser's language setting; the matching `🇪🇸 ES` / `🇬🇧 EN` button shows as active (highlighted). Click the other button: the drop zone text and the download button's label switch language immediately, and the clicked button becomes active instead.

- [ ] **Step 3: Verify manually — language switch persists across reloads**

With the same tab still open, reload the page (`Cmd+R` / `F5`).
Expected: the page loads in whichever language you last clicked, not back to the browser-detected default — confirming `localStorage.uiLang` is being read on load.

- [ ] **Step 4: Verify manually — language switch re-renders visible error and book list**

Drag in a `.txt` file with no parseable highlights (e.g. one containing just the word `hello`) to trigger the "no highlights found" error, then click the other language button.
Expected: the error message text switches language instantly without needing to re-upload.

Then drag in a real sample clippings file (any valid `My Clippings.txt`-style content) to populate the book list, then click the other language button.
Expected: the book count text and every book-list line switch language instantly (e.g. "5 subrayados, 2 notas, 1 marcadores" becomes "5 highlights, 2 notes, 1 bookmarks"), without needing to re-upload, and the download button still works afterward.

- [ ] **Step 5: Run the full web test suite one more time**

Run: `node --test web/`
Expected: PASS (51 tests — this task touches no tested logic, so the count is unchanged from Task 1)

- [ ] **Step 6: Commit**

```bash
git add web/app.js
git commit -m "Wire EN/ES language selector into app.js, translating all UI copy"
```
