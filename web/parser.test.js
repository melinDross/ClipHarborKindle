import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeName, parsePos, parsePage, extractKind, detectEntryLang, parseAddedCompact, rangesOverlap, pairNotes, parseEntries } from './parser.js';

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

test('rangesOverlap returns true for overlapping ranges', () => {
  assert.equal(rangesOverlap(10, 20, 15, 25), true);
});

test('rangesOverlap returns false for disjoint ranges', () => {
  assert.equal(rangesOverlap(10, 20, 21, 30), false);
});

test('rangesOverlap returns false when any bound is null', () => {
  assert.equal(rangesOverlap(10, 20, null, 30), false);
});

test('pairNotes attaches a note to the highlight whose position range overlaps it', () => {
  const items = [
    { kind: 'Highlight', posStart: 49, posEnd: 50, pageNum: 6, text: 'Original highlight text.' },
    { kind: 'Note', posStart: 49, posEnd: 50, pageNum: 6, text: 'My note about it.' },
  ];
  const result = pairNotes(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].noteText, 'My note about it.');
  assert.equal(result[0].metaOverrideKind, 'Note');
});

test('pairNotes keeps a note as its own entry when no highlight overlaps', () => {
  const items = [
    { kind: 'Highlight', posStart: 10, posEnd: 12, pageNum: 1, text: 'Unrelated highlight.' },
    { kind: 'Note', posStart: 90, posEnd: 91, pageNum: 9, text: 'Standalone note.' },
  ];
  const result = pairNotes(items);
  assert.equal(result.length, 2);
  assert.equal(result[1].noteText, 'Standalone note.');
  assert.equal(result[1].text, '');
});

test('pairNotes passes bookmarks through unchanged with an empty noteText', () => {
  const items = [{ kind: 'Bookmark', posStart: null, posEnd: null, pageNum: 5, text: '' }];
  const result = pairNotes(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].noteText, '');
});

test('pairNotes searches backward and attaches note to most recent matching highlight, skipping non-matching ones', () => {
  const items = [
    { kind: 'Highlight', posStart: 10, posEnd: 20, pageNum: 2, text: 'Earlier highlight.' },
    { kind: 'Highlight', posStart: 100, posEnd: 110, pageNum: 10, text: 'Later highlight that does not overlap note.' },
    { kind: 'Note', posStart: 15, posEnd: 18, pageNum: 2, text: 'My note.' },
  ];
  const result = pairNotes(items);
  assert.equal(result.length, 2);
  assert.equal(result[0].noteText, 'My note.');
  assert.equal(result[0].text, 'Earlier highlight.');
  assert.equal(result[1].noteText, '');
  assert.equal(result[1].text, 'Later highlight that does not overlap note.');
});

test('pairNotes attaches note to most recent highlight when multiple highlights overlap the note', () => {
  const items = [
    { kind: 'Highlight', posStart: 10, posEnd: 30, pageNum: 3, text: 'First overlapping highlight.' },
    { kind: 'Highlight', posStart: 15, posEnd: 25, pageNum: 3, text: 'Second overlapping highlight.' },
    { kind: 'Note', posStart: 18, posEnd: 22, pageNum: 3, text: 'Overlaps both highlights.' },
  ];
  const result = pairNotes(items);
  assert.equal(result.length, 2);
  assert.equal(result[0].noteText, '');
  assert.equal(result[0].text, 'First overlapping highlight.');
  assert.equal(result[1].noteText, 'Overlaps both highlights.');
  assert.equal(result[1].text, 'Second overlapping highlight.');
  assert.equal(result[1].metaOverrideKind, 'Note');
});

test('pairNotes attaches note to highlight via page-number fallback when position ranges do not overlap', () => {
  const items = [
    { kind: 'Highlight', posStart: 10, posEnd: 20, pageNum: 5, text: 'Highlight on page 5.' },
    { kind: 'Note', posStart: 100, posEnd: 110, pageNum: 5, text: 'Note on same page, different position range.' },
  ];
  const result = pairNotes(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].noteText, 'Note on same page, different position range.');
  assert.equal(result[0].text, 'Highlight on page 5.');
  assert.equal(result[0].metaOverrideKind, 'Note');
});

test('pairNotes joins multiple notes attached to the same highlight with a space', () => {
  const items = [
    { kind: 'Highlight', posStart: 49, posEnd: 50, pageNum: 6, text: 'Highlight text.' },
    { kind: 'Note', posStart: 49, posEnd: 50, pageNum: 6, text: 'First note.' },
    { kind: 'Note', posStart: 49, posEnd: 50, pageNum: 6, text: 'Second note.' },
  ];
  const result = pairNotes(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].noteText, 'First note. Second note.');
  assert.equal(result[0].text, 'Highlight text.');
  assert.equal(result[0].metaOverrideKind, 'Note');
});

const SAMPLE_CLIPPINGS = `Blood, Sweat, and Pixels (Jason Schreier)
- Your Highlight on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:38:24 PM

Developers everywhere talk about how hard it is to make games.
==========
Blood, Sweat, and Pixels (Jason Schreier)
- Your Note on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:40:00 PM

This is a great point about crunch.
==========
Parque Jurásico (Michael Crichton)
- Tu marcador en la página 50 | Añadido el viernes, 14 de junio de 2024 08:00:00
==========
`;

test('parseEntries groups entries by (title, author) and extracts fields', () => {
  const books = parseEntries(SAMPLE_CLIPPINGS);
  assert.equal(books.length, 2);

  const [bsp, jurassic] = books;
  assert.equal(bsp.title, 'Blood, Sweat, and Pixels');
  assert.equal(bsp.author, 'Jason Schreier');
  assert.equal(bsp.items.length, 2);
  assert.equal(bsp.items[0].kind, 'Highlight');
  assert.equal(bsp.items[0].posStart, 49);
  assert.equal(bsp.items[0].posEnd, 50);
  assert.equal(bsp.items[0].text, 'Developers everywhere talk about how hard it is to make games.');
  assert.equal(bsp.items[0].lang, 'en');
  assert.equal(bsp.items[1].kind, 'Note');

  assert.equal(jurassic.title, 'Parque Jurásico');
  assert.equal(jurassic.author, 'Michael Crichton');
  assert.equal(jurassic.items.length, 1);
  assert.equal(jurassic.items[0].kind, 'Bookmark');
  assert.equal(jurassic.items[0].text, '');
  assert.equal(jurassic.items[0].lang, 'es');
});

test('parseEntries skips malformed blocks with fewer than 2 lines', () => {
  const text = 'Some Title (Some Author)\n- Your Highlight on Page 1 | Loc. 1\n\nFirst entry text.\n==========\n\n==========\n';
  const books = parseEntries(text);
  assert.equal(books.length, 1);
  assert.equal(books[0].items.length, 1);
});

test('parseEntries strips a leading BOM character from lines', () => {
  const text = '﻿Some Title (Some Author)\n- Your Highlight on Page 1 | Loc. 1\n\nText.\n==========\n';
  const books = parseEntries(text);
  assert.equal(books[0].title, 'Some Title');
});

test('parseEntries treats a title with no parenthesized author as author-less', () => {
  const text = 'Title Without Author\n- Your Highlight on Page 1 | Loc. 1\n\nText.\n==========\n';
  const books = parseEntries(text);
  assert.equal(books[0].title, 'Title Without Author');
  assert.equal(books[0].author, '');
});

test('parseEntries returns an empty array for a file with no valid blocks', () => {
  assert.deepEqual(parseEntries(''), []);
  assert.deepEqual(parseEntries('==========\n==========\n'), []);
});

test('parseEntries uses collision-free (title, author) tuple key to avoid merging distinct books with space-boundary shifts', () => {
  // Regression test for Task 6 review finding: naive `${title} ${author}` concatenation
  // collides when a space boundary shifts. E.g., title="Foo" author="Bar Baz" produces
  // the same string "Foo Bar Baz" as title="Foo Bar" author="Baz". With a proper
  // tuple key (JSON.stringify), these are correctly treated as distinct books.
  const text = `Foo (Bar Baz)
- Your Highlight on Page 1 | Loc. 1 | Added on Thursday, June 13, 2024 10:38:24 PM

First book's highlight.
==========
Foo Bar (Baz)
- Your Highlight on Page 2 | Loc. 2 | Added on Thursday, June 13, 2024 10:39:00 PM

Second book's highlight.
==========
`;
  const books = parseEntries(text);
  assert.equal(books.length, 2, 'Should have two distinct book groups, not merge into one');
  assert.equal(books[0].title, 'Foo');
  assert.equal(books[0].author, 'Bar Baz');
  assert.equal(books[0].items.length, 1);
  assert.equal(books[0].items[0].text, "First book's highlight.");

  assert.equal(books[1].title, 'Foo Bar');
  assert.equal(books[1].author, 'Baz');
  assert.equal(books[1].items.length, 1);
  assert.equal(books[1].items[0].text, "Second book's highlight.");
});
