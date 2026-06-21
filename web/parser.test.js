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

import { extractKind, detectEntryLang } from './parser.js';

test('extractKind recognizes English highlight/note/bookmark', () => {
  assert.equal(extractKind('Your Highlight on Page 6'), 'Highlight');
  assert.equal(extractKind('Your Note on Page 6'), 'Note');
  assert.equal(extractKind('Your Bookmark on Page 6'), 'Bookmark');
});

test('extractKind recognizes Spanish highlight/note/bookmark', () => {
  assert.equal(extractKind('El subrayado en la página 10'), 'Highlight');
  assert.equal(extractKind('La nota en la página 10'), 'Note');
  assert.equal(extractKind('Tu marcador en la página 10'), 'Bookmark');
});

test('extractKind defaults to Highlight when nothing matches', () => {
  assert.equal(extractKind('something unrecognized'), 'Highlight');
});

test('detectEntryLang detects Spanish from metadata keywords', () => {
  assert.equal(detectEntryLang('El subrayado en la página 10 | Añadido el jueves, 13 de junio de 2024'), 'es');
});

test('detectEntryLang detects English from metadata keywords', () => {
  assert.equal(detectEntryLang('Your Highlight on Page 6 | Added on Thursday, June 13, 2024'), 'en');
});

test('detectEntryLang returns null when no language signal is present', () => {
  assert.equal(detectEntryLang('???'), null);
});

import { parseAddedCompact } from './parser.js';

test('parseAddedCompact formats an English date with PM', () => {
  assert.equal(
    parseAddedCompact('- Your Highlight on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:38:24 PM'),
    '2024-06-13 22:38'
  );
});

test('parseAddedCompact formats an English date with AM at 12 (midnight)', () => {
  assert.equal(
    parseAddedCompact('Added on Monday, January 1, 2024 12:15:00 AM'),
    '2024-01-01 00:15'
  );
});

test('parseAddedCompact formats a Spanish date', () => {
  assert.equal(
    parseAddedCompact('- El subrayado en la página 10 | posición 120-125 | Añadido el jueves, 13 de junio de 2024 22:38:24'),
    '2024-06-13 22:38'
  );
});

test('parseAddedCompact falls back to the raw text when the date does not match either pattern', () => {
  assert.equal(parseAddedCompact('Added on some unparseable text'), 'some unparseable text');
});
