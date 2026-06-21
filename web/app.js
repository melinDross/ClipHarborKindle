import { exportBooks } from './parser.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const errorMessage = document.getElementById('error-message');
const results = document.getElementById('results');
const bookCount = document.getElementById('book-count');
const bookList = document.getElementById('book-list');
const downloadButton = document.getElementById('download-button');

let currentBooks = [];

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  results.hidden = true;
}

function renderBooks(books) {
  currentBooks = books;
  errorMessage.hidden = true;

  if (books.length === 0) {
    showError('No se ha podido leer ningún highlight de este fichero. ¿Es el "My Clippings.txt" correcto?');
    return;
  }

  bookCount.textContent = `${books.length} libro(s) detectado(s)`;
  bookList.innerHTML = '';
  for (const book of books) {
    const li = document.createElement('li');
    const authorPart = book.author ? ` — ${book.author}` : '';
    li.textContent = `${book.title}${authorPart} — ${book.stats.highlights} highlights, ${book.stats.notes} notas, ${book.stats.bookmarks} marcadores`;
    bookList.appendChild(li);
  }
  results.hidden = false;
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const books = exportBooks(reader.result, file.name);
      renderBooks(books);
    } catch (err) {
      showError('No se ha podido procesar el fichero. ¿Es el "My Clippings.txt" correcto?');
    }
  };
  reader.onerror = () => showError('No se ha podido leer el fichero seleccionado.');
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

export { currentBooks, downloadButton };
