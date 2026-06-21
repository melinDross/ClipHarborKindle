import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeName, parsePos, parsePage } from './parser.js';

test('safeName strips punctuation and joins words with underscores', () => {
  assert.equal(safeName('Parque Jurásico (Z-Library)'), 'Parque_Jurásico_Z-Library');
});

test('safeName collapses multiple spaces and trims', () => {
  assert.equal(safeName('  Hábitos   atómicos  '), 'Hábitos_atómicos');
});

test('safeName keeps hyphens and underscores as-is', () => {
  assert.equal(safeName('Self-Help_Classics'), 'Self-Help_Classics');
});

test('parsePos parses an ASCII-dash range (regression for the DASH bug fixed in v1_1e)', () => {
  assert.deepEqual(parsePos('Your Highlight on Page 6 | Loc. 49-50 | Added on...'), {
    label: 'Pos 49-50',
    start: 49,
    end: 50,
  });
});

test('parsePos parses a single position with no range', () => {
  assert.deepEqual(parsePos('Your Bookmark on Page 6 | Loc. 49 | Added on...'), {
    label: 'Pos 49',
    start: 49,
    end: 49,
  });
});

test('parsePos parses Spanish "posición" metadata', () => {
  assert.deepEqual(parsePos('El subrayado en la página 10 | posición 120-125 | Añadido el...'), {
    label: 'Pos 120-125',
    start: 120,
    end: 125,
  });
});

test('parsePos returns nulls when there is no position metadata', () => {
  assert.deepEqual(parsePos('Your Bookmark | Added on...'), { label: '', start: null, end: null });
});

test('parsePage parses English "Page" metadata', () => {
  assert.equal(parsePage('Your Highlight on Page 6 | Loc. 49-50'), 6);
});

test('parsePage parses Spanish "página" metadata', () => {
  assert.equal(parsePage('El subrayado en la página 10 | posición 120-125'), 10);
});

test('parsePage returns null when there is no page metadata', () => {
  assert.equal(parsePage('Your Highlight | Loc. 49-50'), null);
});
