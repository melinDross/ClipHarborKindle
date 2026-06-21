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
