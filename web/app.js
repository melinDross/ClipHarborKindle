import { exportBooks } from './parser.js';
import { STRINGS, detectInitialLang } from './strings.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const errorMessage = document.getElementById('error-message');
const processingMessage = document.getElementById('processing-message');
const results = document.getElementById('results');
const bookCount = document.getElementById('book-count');
const bookList = document.getElementById('book-list');
const downloadButton = document.getElementById('download-button');
const langEsButton = document.getElementById('lang-es');
const langEnButton = document.getElementById('lang-en');
const themeToggleButton = document.getElementById('theme-toggle');

let currentBooks = [];
let currentLang = detectInitialLang();
let lastErrorKey = null;
let jsZipPromise = null;

// Only reflects the button's icon/label; the actual page appearance is
// driven by the theme-* class theme-init.js applies pre-paint (or, absent a
// saved choice, by the prefers-color-scheme rules in style.css). Doesn't get
// written to localStorage until the user actually clicks the toggle — so
// visitors who never touch it keep following their OS setting live.
let currentTheme = detectInitialTheme();

function detectInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The icon and aria-pressed reflect the current appearance; the label
// describes what clicking it does next (switch to the *other* mode), which
// reads more naturally for a toggle than a static "dark mode" label would.
function updateThemeButton() {
  themeToggleButton.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  themeToggleButton.setAttribute('aria-pressed', String(currentTheme === 'dark'));
  themeToggleButton.setAttribute(
    'aria-label',
    t(currentTheme === 'dark' ? 'switchToLightAriaLabel' : 'switchToDarkAriaLabel')
  );
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  updateThemeButton();
}

// JSZip is only needed for the "download all" button, not for the initial
// parse or for downloading a single book — so it's fetched on first use
// instead of blocking page load. It's a plain UMD script (not an ES module),
// so it's loaded by appending a <script> tag rather than dynamic import().
// The integrity hash pins it against tampering; browsers verify it even for
// same-origin scripts.
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jsZipPromise) {
    jsZipPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/jszip.min.js';
      script.integrity = 'sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }
  return jsZipPromise;
}

function t(key) {
  return STRINGS[currentLang][key];
}

function showError(key) {
  lastErrorKey = key;
  errorMessage.textContent = t(key);
  errorMessage.hidden = false;
  results.hidden = true;
}

// Builds the drop-zone copy from text nodes instead of innerHTML, so a
// future string that embeds user/file-derived data can't turn into an XSS
// sink. The only "markup" the copy needs is a line break between the two
// sentences, which we insert as a real <br> element instead of parsing HTML.
function setDropZoneText(copy) {
  dropZone.textContent = '';
  const lines = copy.split('<br>');
  lines.forEach((line, index) => {
    if (index > 0) dropZone.appendChild(document.createElement('br'));
    dropZone.appendChild(document.createTextNode(line));
  });
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

/**
 * Switches the UI language, persists the choice, and re-renders whatever
 * is currently on screen (the drop zone copy always; the error message or
 * book list only if one of them is currently visible).
 */
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('uiLang', lang);
  document.documentElement.lang = lang;

  setDropZoneText(t('dropZone'));
  dropZone.setAttribute('aria-label', t('dropZoneAriaLabel'));
  if (!downloadButton.disabled) downloadButton.textContent = t('downloadLabel');
  langEsButton.classList.toggle('active', lang === 'es');
  langEnButton.classList.toggle('active', lang === 'en');
  langEsButton.setAttribute('aria-pressed', String(lang === 'es'));
  langEnButton.setAttribute('aria-pressed', String(lang === 'en'));
  updateThemeButton();

  if (!errorMessage.hidden && lastErrorKey) {
    errorMessage.textContent = t(lastErrorKey);
  }
  if (!processingMessage.hidden) {
    processingMessage.textContent = t('processingLabel');
  }
  if (!results.hidden && currentBooks.length > 0) {
    renderBooks(currentBooks);
  }
}

function handleFile(file) {
  processingMessage.textContent = t('processingLabel');
  processingMessage.hidden = false;
  errorMessage.hidden = true;
  results.hidden = true;

  const reader = new FileReader();
  reader.onload = () => {
    // Deferred one tick so the browser has a chance to paint the
    // "processing" message before the (potentially slow, synchronous)
    // parse of a large My Clippings.txt blocks the main thread.
    setTimeout(() => {
      try {
        const books = exportBooks(reader.result, file.name);
        renderBooks(books);
      } catch (err) {
        showError('processError');
      } finally {
        processingMessage.hidden = true;
      }
    }, 0);
  };
  reader.onerror = () => {
    processingMessage.hidden = true;
    showError('readError');
  };
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

dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

langEsButton.addEventListener('click', () => applyLang('es'));
langEnButton.addEventListener('click', () => applyLang('en'));

themeToggleButton.addEventListener('click', () => setTheme(currentTheme === 'dark' ? 'light' : 'dark'));

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
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    for (const book of currentBooks) {
      zip.file(book.filename, book.markdown);
    }
    const blob = await zip.generateAsync({ type: 'blob' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = buildZipFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately can make Chrome lose the suggested filename for
    // the blob: URL before the download actually starts, falling back to a
    // generated name with no extension — give it a tick first.
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  } catch (err) {
    showError('zipError');
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = t('downloadLabel');
  }
});

applyLang(currentLang);
