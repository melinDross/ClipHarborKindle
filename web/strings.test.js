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
