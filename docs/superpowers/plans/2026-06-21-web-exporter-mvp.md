# Web Exporter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, client-side web app at `/web/` that lets a non-technical user drop their Kindle `My Clippings.txt` and download a `.zip` of per-book Markdown files, replicating the parsing behavior of `cli/parse_kindle_notion_v1_1e.py` without running any Python or CLI command.

**Architecture:** Pure static site (`index.html` + `style.css` + two ES modules: `parser.js` for parsing logic, `app.js` for DOM/UI wiring). No backend, no build step, no npm install. The only third-party code is JSZip, vendored as a local file (no CDN). `parser.js` is plain, DOM-free JavaScript so it can be unit-tested with Node's built-in test runner.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML, CSS, Node's built-in `node:test` + `node:assert/strict` for tests, JSZip (vendored) for zip generation, GitHub Pages for hosting.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-06-21-web-exporter-design.md`.
- 100% client-side: the uploaded file never leaves the browser. No backend, no network calls at runtime.
- Only external dependency: JSZip, vendored locally at `web/vendor/jszip.min.js`. No CDN script tags.
- `web/parser.js` is the source of truth for parsing logic going forward (per `CLAUDE.md`, decided 2026-06-21). `cli/parse_kindle_notion_v1_1e.py` is frozen and must not be modified by this plan.
- No Notion API integration, no dedup, no automatic backup, no execution logs — all explicitly out of scope for this MVP.
- Single-screen layout (approved design: option A) — drop zone, book list with stats, one download button. No multi-step wizard.
- Zip filename: `kindle-notion-export-YYYYMMDD.zip`. Per-book filename: `safeName(title) + '.md'`.
- If 0 books are detected after parsing, show a clear error message and keep the download button disabled — no partial "best effort" output in that case.
- Output language per book is decided by a real per-entry metadata heuristic (`detectEntryLang` + `detectBookLang`), not a port of `v1_1e`'s static `PER_BOOK_LANG` dict. Default on tie/no signal: `'en'`.
- Tests: Node's built-in `node:test` against `parser.js` only. No automated UI/DOM tests in this MVP — those are verified manually in a browser.
- Deployment target: GitHub Pages serving directly from `/web`.
- Node version assumed for running tests: >= 18 (for built-in `node:test`).

---

### Task 1: Project scaffold + `safeName`

**Files:**
- Create: `web/package.json`
- Create: `web/parser.js`
- Create: `web/parser.test.js`

**Interfaces:**
- Produces: `export function safeName(name: string): string` — sanitizes a book title into a filesystem-safe stem (no extension).

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "kindle-notion-web-exporter",
  "private": true,
  "type": "module"
}
```

This has no dependencies — it only exists so Node treats `.js` files in `web/` as ES modules (needed for `import`/`export` to work with `node:test`, and matches the `<script type="module">` usage in the browser).

- [ ] **Step 2: Write the failing test**

Create `web/parser.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeName } from './parser.js';

test('safeName strips punctuation and joins words with underscores', () => {
  assert.equal(safeName('Parque Jurásico (Z-Library)'), 'Parque_Jurásico_Z-Library');
});

test('safeName collapses multiple spaces and trims', () => {
  assert.equal(safeName('  Hábitos   atómicos  '), 'Hábitos_atómicos');
});

test('safeName keeps hyphens and underscores as-is', () => {
  assert.equal(safeName('Self-Help_Classics'), 'Self-Help_Classics');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test web/parser.test.js`
Expected: FAIL — `parser.js` does not exist yet, or does not export `safeName` (`Cannot find module` or `safeName is not a function`).

- [ ] **Step 4: Write minimal implementation**

Create `web/parser.js`:

```javascript
/**
 * Sanitizes a book title into a filesystem-safe filename stem (no extension).
 * Mirrors `safe_name()` in cli/parse_kindle_notion_v1_1e.py: strips everything
 * that is not a Unicode letter/digit/underscore/space/hyphen, then collapses
 * whitespace runs into underscores. Uses \p{L}/\p{N} instead of JS's ASCII-only
 * \w so accented characters (á, í, ñ...) survive, matching Python's Unicode-aware \w.
 */
export function safeName(name) {
  const cleaned = name.replace(/[^\p{L}\p{N}_\s-]/gu, '').trim();
  return cleaned.replace(/\s+/g, '_');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test web/parser.test.js`
Expected: PASS (3 tests passing)

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/parser.js web/parser.test.js
git commit -m "Scaffold web/ exporter and port safeName from v1_1e"
```

---

### Task 2: `parsePos` + `parsePage`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `export function parsePos(meta: string): { label: string, start: number|null, end: number|null }`
  - `export function parsePage(meta: string): number|null`

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
import { parsePos, parsePage } from './parser.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `parsePos`/`parsePage` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
const DASH = '[-–—]';

/**
 * Ports parse_pos() from cli/parse_kindle_notion_v1_1e.py.
 * Note the character class is `[-–—]` (literal hyphen, en-dash, em-dash) —
 * NOT `[\\-–—]`, which was the bug documented in CLAUDE.md: a leading
 * backslash there turns it into a Unicode range between `\` and `–`,
 * silently failing to match a plain ASCII hyphen.
 */
export function parsePos(meta) {
  const re = new RegExp(
    `(Location|Ubicaci[oó]n|Loc\\.?|posici[oó]n|Pos)\\s+(\\d+)(?:\\s*${DASH}\\s*(\\d+))?`,
    'i'
  );
  const m = meta.match(re);
  if (!m) return { label: '', start: null, end: null };
  const start = parseInt(m[2], 10);
  const end = m[3] ? parseInt(m[3], 10) : start;
  const label = start === end ? `Pos ${start}` : `Pos ${start}-${end}`;
  return { label, start, end };
}

/**
 * Ports parse_page() from cli/parse_kindle_notion_v1_1e.py. The original
 * Python function also returns whether the matched label started with "p"
 * (`page`/`página`), but that second value is never read anywhere in the
 * script — dropped here since porting unused output would be dead code.
 */
export function parsePage(meta) {
  const m = meta.match(/(Page|P[aá]gina|Pag\.?)\s+(\d+)/i);
  return m ? parseInt(m[2], 10) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (10 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Port parsePos and parsePage from v1_1e, with DASH-bug regression test"
```

---

### Task 3: `extractKind` + `detectEntryLang`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export function extractKind(meta: string): 'Highlight'|'Note'|'Bookmark'`
  - `export function detectEntryLang(meta: string): 'es'|'en'|null`

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `extractKind`/`detectEntryLang` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
/** Ports extract_kind() from cli/parse_kindle_notion_v1_1e.py verbatim. */
export function extractKind(meta) {
  if (/\b(la|el)\s+nota\b/i.test(meta) || /\btu\s+nota\b/i.test(meta)) return 'Note';
  if (/\b(subrayado|resaltado)\b/i.test(meta)) return 'Highlight';
  if (/\bmarcador\b/i.test(meta)) return 'Bookmark';
  if (/your note/i.test(meta)) return 'Note';
  if (/\bhighlight\b/i.test(meta)) return 'Highlight';
  if (/\bbookmark\b/i.test(meta)) return 'Bookmark';
  return 'Highlight';
}

/**
 * New in the web port (not present in v1_1e — see CLAUDE.md "Gobernanza del
 * parsing" and the design spec's correction note). v1_1e's output language
 * was a static config default, not real detection; this classifies a single
 * entry's metadata line as Spanish or English based on the same keywords
 * extractKind/parseAddedCompact already rely on. Returns null when no
 * keyword matches, so callers can do a majority vote across a book's entries.
 */
export function detectEntryLang(meta) {
  const esSignal =
    /añadido el/i.test(meta) ||
    /\b(la|el|tu)\s+nota\b/i.test(meta) ||
    /\b(subrayado|resaltado|marcador)\b/i.test(meta) ||
    /p[aá]gina/i.test(meta) ||
    /ubicaci[oó]n/i.test(meta) ||
    /posici[oó]n/i.test(meta);
  if (esSignal) return 'es';

  const enSignal =
    /added on/i.test(meta) ||
    /your (note|highlight|bookmark)/i.test(meta) ||
    /\b(highlight|bookmark|page|location)\b/i.test(meta);
  if (enSignal) return 'en';

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (16 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Port extractKind from v1_1e; add detectEntryLang for real per-entry language detection"
```

---

### Task 4: `parseAddedCompact`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export function parseAddedCompact(meta: string): string`

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `parseAddedCompact` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
const EN_MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};
const ES_MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Ports parse_added_compact() from cli/parse_kindle_notion_v1_1e.py.
 * Seconds are parsed (required to match the date patterns) but dropped from
 * the output, matching DATE_FMT_COMPACT = "%Y-%m-%d %H:%M" in the original.
 */
export function parseAddedCompact(meta) {
  const addedMatch = meta.match(/(Added on|Añadido el)\s+(.*)$/i);
  const txt = addedMatch ? addedMatch[2].trim() : meta.trim();

  const en = txt.match(
    /^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$/
  );
  if (en) {
    const [, monthName, day, year, hourStr, minute, , ampm] = en;
    const month = EN_MONTHS[monthName];
    if (month) {
      let hour = parseInt(hourStr, 10);
      if (ampm) {
        const upper = ampm.toUpperCase();
        if (upper === 'PM' && hour !== 12) hour += 12;
        if (upper === 'AM' && hour === 12) hour = 0;
      }
      return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${minute}`;
    }
  }

  const es = txt.match(
    /^[A-Za-zÁÉÍÓÚÑáéíóúñ]+,\s+(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  );
  if (es) {
    const [, day, monthName, year, hour, minute] = es;
    const month = ES_MONTHS[monthName.toLowerCase()];
    if (month) {
      return `${year}-${pad2(month)}-${pad2(day)} ${pad2(parseInt(hour, 10))}:${minute}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(txt)) return txt;

  return txt;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (20 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Port parseAddedCompact (EN/ES date formatting) from v1_1e"
```

---

### Task 5: `rangesOverlap` + `pairNotes`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (operates on plain entry objects with `kind`, `posStart`, `posEnd`, `pageNum`, `text` fields — the same shape `parseEntries` will produce in Task 6).
- Produces:
  - `export function rangesOverlap(aStart: number|null, aEnd: number|null, bStart: number|null, bEnd: number|null): boolean`
  - `export function pairNotes(items: Array<object>): Array<object>` — mutates and returns entries, attaching `noteText` (and `metaOverrideKind: 'Note'` when a note got merged into a highlight).

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
import { rangesOverlap, pairNotes } from './parser.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `rangesOverlap`/`pairNotes` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
/** Ports ranges_overlap() from cli/parse_kindle_notion_v1_1e.py. */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return !(aEnd < bStart || bEnd < aStart);
}

/**
 * Ports pair_notes() from cli/parse_kindle_notion_v1_1e.py. Walks entries in
 * order; a Note is merged into the most recent Highlight whose position range
 * overlaps it (or whose page number matches, as a fallback), otherwise it is
 * kept as its own standalone entry.
 */
export function pairNotes(items) {
  const out = [];
  for (const it of items) {
    if (it.kind === 'Highlight') {
      it.noteText = '';
      out.push(it);
    } else if (it.kind === 'Note') {
      let attached = false;
      for (let j = out.length - 1; j >= 0; j--) {
        const h = out[j];
        if (h.kind !== 'Highlight') continue;
        const overlap = rangesOverlap(it.posStart, it.posEnd, h.posStart, h.posEnd);
        const samePage = it.pageNum != null && h.pageNum != null && it.pageNum === h.pageNum;
        if (overlap || samePage) {
          h.noteText = (h.noteText || '') + (h.noteText ? ' ' : '') + it.text.trim();
          h.metaOverrideKind = 'Note';
          attached = true;
          break;
        }
      }
      if (!attached) {
        it.noteText = it.text.trim();
        it.text = '';
        out.push(it);
      }
    } else {
      it.noteText = '';
      out.push(it);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (27 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Port rangesOverlap and pairNotes from v1_1e"
```

---

### Task 6: `parseEntries`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: `extractKind`, `parsePos`, `parsePage`, `parseAddedCompact`, `detectEntryLang` (all from Tasks 2–4).
- Produces: `export function parseEntries(text: string): Array<{ title: string, author: string, items: Array<object> }>` — each item has `{ kind, posLabel, posStart, posEnd, pageNum, added, text, metaRaw, lang, noteText: undefined }` (no `noteText` yet — that's added by `pairNotes` in Task 5/9).

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
import { parseEntries } from './parser.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `parseEntries` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
/**
 * Ports parse_entries() from cli/parse_kindle_notion_v1_1e.py. Splits the raw
 * "My Clippings.txt" text on the "==========" delimiter, and for each block
 * extracts title/author from the first line and metadata from the second.
 * Blocks with fewer than 2 non-empty lines (e.g. trailing empty blocks) are
 * skipped, matching `if len(lines) < 2: continue` in the original.
 */
export function parseEntries(text) {
  const order = [];
  const byKey = new Map();

  for (const block of text.split('==========')) {
    const lines = block
      .trim()
      .split(/\r\n|\r|\n/)
      .map((l) => l.replace(/^﻿+|﻿+$/g, '').trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) continue;

    const [titleLine, metaLine] = lines;
    const content = lines.slice(2).join('\n').trim();

    const titleMatch = titleLine.match(/^(.+?)\s*\((.+?)\)\s*$/);
    const title = titleMatch ? titleMatch[1].trim() : titleLine.trim();
    const author = titleMatch ? titleMatch[2].trim() : '';

    const pos = parsePos(metaLine);
    const entry = {
      kind: extractKind(metaLine),
      posLabel: pos.label,
      posStart: pos.start,
      posEnd: pos.end,
      pageNum: parsePage(metaLine),
      added: parseAddedCompact(metaLine),
      text: content,
      metaRaw: metaLine,
      lang: detectEntryLang(metaLine),
    };

    const key = `${title} ${author}`;
    if (!byKey.has(key)) {
      const group = { title, author, items: [] };
      byKey.set(key, group);
      order.push(group);
    }
    byKey.get(key).items.push(entry);
  }

  return order;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (33 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Port parseEntries from v1_1e"
```

---

### Task 7: `detectBookLang`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: entries shaped like `parseEntries`'s output items (specifically their `lang` field, `'es'|'en'|null`).
- Produces: `export function detectBookLang(items: Array<{ lang: 'es'|'en'|null }>): 'es'|'en'`

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
import { detectBookLang } from './parser.js';

test('detectBookLang picks the majority language across entries', () => {
  const items = [{ lang: 'es' }, { lang: 'es' }, { lang: 'en' }, { lang: null }];
  assert.equal(detectBookLang(items), 'es');
});

test('detectBookLang defaults to "en" on a tie', () => {
  const items = [{ lang: 'es' }, { lang: 'en' }];
  assert.equal(detectBookLang(items), 'en');
});

test('detectBookLang defaults to "en" when no entry has a detected language', () => {
  const items = [{ lang: null }, { lang: null }];
  assert.equal(detectBookLang(items), 'en');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `detectBookLang` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
/**
 * New in the web port (see CLAUDE.md "Gobernanza del parsing"). Replaces
 * v1_1e's static PER_BOOK_LANG/OUTPUT_LANG_DEFAULT config with a real
 * majority vote over each entry's detected language. Ties and "no signal at
 * all" both fall back to 'en', matching v1_1e's OUTPUT_LANG_DEFAULT.
 */
export function detectBookLang(items) {
  let esCount = 0;
  let enCount = 0;
  for (const it of items) {
    if (it.lang === 'es') esCount++;
    if (it.lang === 'en') enCount++;
  }
  return esCount > enCount ? 'es' : 'en';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (36 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Add detectBookLang majority-vote heuristic for output language"
```

---

### Task 8: `renderBookMarkdown`

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: `items` shaped like `pairNotes`'s output (have `kind`, `posLabel`, `pageNum`, `added`, `text`, `noteText`, optional `metaOverrideKind`); a `lang` value from `detectBookLang`.
- Produces: `export function renderBookMarkdown(title: string, author: string, items: Array<object>, lang: 'es'|'en', sourceFilename: string): string`

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
import { renderBookMarkdown } from './parser.js';

test('renderBookMarkdown renders English labels, header stats, and a paired note', () => {
  const items = [
    {
      kind: 'Highlight',
      posLabel: 'Pos 49-50',
      pageNum: 6,
      added: '2024-06-13 22:38',
      text: 'Developers everywhere talk about how hard it is to make games.',
      noteText: 'This is a great point about crunch.',
      metaOverrideKind: 'Note',
    },
  ];
  const md = renderBookMarkdown('Blood, Sweat, and Pixels', 'Jason Schreier', items, 'en', 'My Clippings.txt');

  assert.match(md, /^# Blood, Sweat, and Pixels/);
  assert.match(md, /Author: Jason Schreier/);
  assert.match(md, /Highlights: 1 \| Notes: 1 \| Bookmarks: 0/);
  assert.match(md, /Source: My Clippings\.txt/);
  assert.match(md, /— \*\*Note 👉🏼:\*\* _This is a great point about crunch\._/);
  assert.match(md, /> 🟧 _Note \| Page 6 \| Pos 49-50 \| 2024-06-13 22:38_/);
});

test('renderBookMarkdown renders Spanish labels and a standalone bookmark with no text', () => {
  const items = [
    { kind: 'Bookmark', posLabel: '', pageNum: 50, added: '2024-06-14 08:00', text: '', noteText: '' },
  ];
  const md = renderBookMarkdown('Parque Jurásico', 'Michael Crichton', items, 'es', 'My Clippings.txt');

  assert.match(md, /Marcadores: 1/);
  assert.match(md, /- Bookmark at Page 50/);
  assert.match(md, /> 🟩 _Marcador \| Página 50 \| 2024-06-14 08:00_/);
});

test('renderBookMarkdown omits the author line when there is no author', () => {
  const md = renderBookMarkdown('Title Without Author', '', [], 'en', 'My Clippings.txt');
  assert.doesNotMatch(md, /Author:/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `renderBookMarkdown` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
const EMOJIS = { Highlight: '🟦', Note: '🟧', Bookmark: '🟩' };

const KIND_MAP = {
  en: { Highlight: 'Highlight', Note: 'Note', Bookmark: 'Bookmark', Page: 'Page', Highlights: 'Highlights', Notes: 'Notes', Bookmarks: 'Bookmarks', Author: 'Author', Processed: 'Processed', Source: 'Source' },
  es: { Highlight: 'Subrayado', Note: 'Nota', Bookmark: 'Marcador', Page: 'Página', Highlights: 'Subrayados', Notes: 'Notas', Bookmarks: 'Marcadores', Author: 'Autor', Processed: 'Procesado', Source: 'Origen' },
};

function styleNote(note, lang) {
  const label = lang === 'en' ? 'Note 👉🏼' : 'Nota 👉🏼';
  return `**${label}:** _${note}_`;
}

function renderMeta(parts, metaKind) {
  const meta = `_${parts.join(' | ')}_`;
  const prefix = EMOJIS[metaKind] ? `${EMOJIS[metaKind]} ` : '';
  return `> ${prefix}${meta}`;
}

/**
 * Ports render_book_md() from cli/parse_kindle_notion_v1_1e.py. The original
 * script's META_STYLE/EMOJI_IN_META/ENTRY_SEPARATOR config flags were all
 * fixed at "blockquote"/true/"---" and never changed, so they're hardcoded
 * here rather than ported as unused configurability (YAGNI).
 */
export function renderBookMarkdown(title, author, items, lang, sourceFilename) {
  const kindMap = KIND_MAP[lang];

  const nHigh = items.filter((it) => it.kind === 'Highlight').length;
  const nNote = items.filter((it) => it.metaOverrideKind === 'Note' || it.kind === 'Note').length;
  const nBook = items.filter((it) => it.kind === 'Bookmark').length;
  const processedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const lines = [`# ${title}`];
  if (author) lines.push(`🖋️ ${kindMap.Author}: ${author}`);
  lines.push(`🔖 ${kindMap.Highlights}: ${nHigh} | ${kindMap.Notes}: ${nNote} | ${kindMap.Bookmarks}: ${nBook}`);
  lines.push(`📌 ${kindMap.Processed}: ${processedAt}`);
  lines.push(`📂 ${kindMap.Source}: ${sourceFilename}`);
  lines.push('', '---', '');

  items.forEach((it, index) => {
    if (index > 0) lines.push('');

    const text = (it.text || '').trim();
    const note = (it.noteText || '').trim();
    let main = text;
    if (it.kind === 'Bookmark' && !main) {
      if (it.pageNum != null) main = `Bookmark at Page ${it.pageNum}`;
      else if (it.posLabel) main = `Bookmark at ${it.posLabel}`;
      else main = '(Bookmark)';
    }
    if (note) main += ` — ${styleNote(note, lang)}`;
    lines.push(`- ${main}`);

    const metaKind = note ? 'Note' : it.kind || 'Highlight';
    const parts = [kindMap[metaKind] || metaKind];
    if (it.pageNum != null) parts.push(`${kindMap.Page} ${it.pageNum}`);
    if (it.posLabel) parts.push(it.posLabel);
    if (it.added) parts.push(it.added);
    lines.push(renderMeta(parts, metaKind));

    lines.push('', '---', '');
  });

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (39 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Port renderBookMarkdown from v1_1e"
```

---

### Task 9: `exportBooks` orchestration

**Files:**
- Modify: `web/parser.js`
- Modify: `web/parser.test.js`

**Interfaces:**
- Consumes: `parseEntries`, `pairNotes`, `detectBookLang`, `renderBookMarkdown`, `safeName` (Tasks 1–8).
- Produces: `export function exportBooks(text: string, sourceFilename: string): Array<{ title: string, author: string, filename: string, markdown: string, stats: { highlights: number, notes: number, bookmarks: number } }>`. **This is the only function `app.js` calls** — it is the public API of `parser.js`.

- [ ] **Step 1: Write the failing tests**

Append to `web/parser.test.js`:

```javascript
import { exportBooks } from './parser.js';

test('exportBooks turns raw clippings text into ready-to-download books', () => {
  const books = exportBooks(SAMPLE_CLIPPINGS, 'My Clippings.txt');

  assert.equal(books.length, 2);

  const bsp = books.find((b) => b.title === 'Blood, Sweat, and Pixels');
  assert.equal(bsp.author, 'Jason Schreier');
  assert.equal(bsp.filename, 'Blood_Sweat_and_Pixels.md');
  assert.equal(bsp.stats.highlights, 1);
  assert.equal(bsp.stats.notes, 1);
  assert.equal(bsp.stats.bookmarks, 0);
  assert.match(bsp.markdown, /^# Blood, Sweat, and Pixels/);

  const jurassic = books.find((b) => b.title === 'Parque Jurásico');
  assert.equal(jurassic.filename, 'Parque_Jurásico.md');
  assert.equal(jurassic.stats.bookmarks, 1);
  assert.match(jurassic.markdown, /Marcadores: 1/);
});

test('exportBooks returns an empty array for a file with no valid entries', () => {
  assert.deepEqual(exportBooks('not a clippings file', 'My Clippings.txt'), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test web/parser.test.js`
Expected: FAIL — `exportBooks` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `web/parser.js`:

```javascript
/**
 * Public entry point for app.js. Mirrors the per-book pipeline in main() of
 * cli/parse_kindle_notion_v1_1e.py: pair notes to highlights, sort entries by
 * position/page/date, detect output language, render Markdown, and compute
 * the same highlight/note/bookmark counts shown in the book's header.
 */
export function exportBooks(text, sourceFilename) {
  const groups = parseEntries(text);
  const books = [];

  for (const group of groups) {
    const paired = pairNotes(group.items);

    paired.sort((a, b) => {
      const posA = a.posStart ?? Number.MAX_SAFE_INTEGER;
      const posB = b.posStart ?? Number.MAX_SAFE_INTEGER;
      if (posA !== posB) return posA - posB;
      const pageA = a.pageNum ?? Number.MAX_SAFE_INTEGER;
      const pageB = b.pageNum ?? Number.MAX_SAFE_INTEGER;
      if (pageA !== pageB) return pageA - pageB;
      return (a.added || '').localeCompare(b.added || '');
    });

    const lang = detectBookLang(paired);
    const markdown = renderBookMarkdown(group.title, group.author, paired, lang, sourceFilename);

    books.push({
      title: group.title,
      author: group.author,
      filename: `${safeName(group.title)}.md`,
      markdown,
      stats: {
        highlights: paired.filter((it) => it.kind === 'Highlight').length,
        notes: paired.filter((it) => it.metaOverrideKind === 'Note' || it.kind === 'Note').length,
        bookmarks: paired.filter((it) => it.kind === 'Bookmark').length,
      },
    });
  }

  return books;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: PASS (41 tests passing)

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "Add exportBooks orchestration as the public parser.js API for app.js"
```

---

### Task 10: Vendor JSZip

**Files:**
- Create: `web/vendor/jszip.min.js`

**Interfaces:**
- Produces: a global `JSZip` constructor, available on `window.JSZip` once the file is loaded via a classic `<script>` tag (Task 12).

- [ ] **Step 1: Download the pinned JSZip release**

Run:

```bash
curl -fL https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js -o web/vendor/jszip.min.js
```

Expected: the command exits 0 and `web/vendor/jszip.min.js` is created.

- [ ] **Step 2: Verify the downloaded file looks correct**

Run:

```bash
head -c 200 web/vendor/jszip.min.js && echo && wc -c web/vendor/jszip.min.js
```

Expected: the first line contains a comment banner with `JSZip v3.10.1`, and the file size is roughly 95,000–100,000 bytes (a near-empty or truncated file means the download failed silently — re-run Step 1 if so).

- [ ] **Step 3: Commit**

```bash
git add web/vendor/jszip.min.js
git commit -m "Vendor JSZip 3.10.1 locally for offline-capable zip downloads"
```

---

### Task 11: `index.html` + `style.css` skeleton

**Files:**
- Create: `web/index.html`
- Create: `web/style.css`

**Interfaces:**
- Produces: DOM elements that Task 12/13 (`app.js`) will query by id: `#drop-zone`, `#file-input`, `#book-list`, `#error-message`, `#download-button`.

- [ ] **Step 1: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kindle → Notion Exporter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="nav">📚 Kindle → Notion Exporter</header>

  <main>
    <div id="drop-zone" class="drop-zone">
      ⬆️ Arrastra aquí tu "My Clippings.txt"<br>o haz clic para seleccionar
    </div>
    <input type="file" id="file-input" accept=".txt" hidden>

    <p id="error-message" class="error" hidden></p>

    <section id="results" hidden>
      <h2 id="book-count"></h2>
      <ul id="book-list"></ul>
      <button id="download-button">⬇️ Descargar todo (.zip)</button>
    </section>
  </main>

  <script src="vendor/jszip.min.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `web/style.css`**

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
  color: #222;
}

.nav {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 24px;
}

.drop-zone {
  padding: 32px;
  text-align: center;
  border: 2px dashed #888;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 16px;
}

.drop-zone.dragover {
  border-color: #4a4;
  background: #f3fff3;
}

.error {
  padding: 12px;
  border-radius: 6px;
  background: #fde8e8;
  color: #8a1f1f;
}

#book-list {
  list-style: none;
  padding: 0;
}

#book-list li {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

#download-button {
  margin-top: 16px;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
}

#download-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```

- [ ] **Step 3: Verify manually**

Run: `python3 -m http.server 8000 --directory web` (any local static server works), then open `http://localhost:8000/` in a browser.
Expected: page loads with the drop zone visible and no console errors, even though there's no `app.js` yet — that's Task 12.

- [ ] **Step 4: Commit**

```bash
git add web/index.html web/style.css
git commit -m "Add static index.html/style.css skeleton for the web exporter"
```

---

### Task 12: `app.js` — upload, parse, render list, error handling

**Files:**
- Create: `web/app.js`

**Interfaces:**
- Consumes: `exportBooks` from `web/parser.js` (Task 9); DOM ids from `web/index.html` (Task 11).
- Produces: module-level state (`currentBooks`) that Task 13 extends with the zip-download click handler.

- [ ] **Step 1: Create `web/app.js`**

```javascript
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
```

- [ ] **Step 2: Verify manually**

Run: `python3 -m http.server 8000 --directory web`, open `http://localhost:8000/`.

Create a small sample file locally (not committed) to drag in, e.g. save this as `/tmp/My Clippings.txt`:

```
Blood, Sweat, and Pixels (Jason Schreier)
- Your Highlight on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:38:24 PM

Developers everywhere talk about how hard it is to make games.
==========
```

Drag `/tmp/My Clippings.txt` onto the drop zone.
Expected: the results section appears showing "1 libro(s) detectado(s)" and a list item for "Blood, Sweat, and Pixels — Jason Schreier — 1 highlights, 0 notas, 0 marcadores". Dragging in an unrelated `.txt` file (e.g. one containing just `hello`) should instead show the red error message and keep the results section hidden.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "Add app.js: file upload, parsing, and book list rendering"
```

---

### Task 13: `app.js` — zip download

**Files:**
- Modify: `web/app.js`

**Interfaces:**
- Consumes: the global `JSZip` constructor (Task 10, loaded via `<script>` in `index.html`); `currentBooks` (Task 12).

- [ ] **Step 1: Replace the final export line with the download handler**

In `web/app.js`, replace:

```javascript
export { currentBooks, downloadButton };
```

with:

```javascript
function buildZipFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `kindle-notion-export-${yyyy}${mm}${dd}.zip`;
}

downloadButton.addEventListener('click', async () => {
  downloadButton.disabled = true;
  const originalLabel = downloadButton.textContent;
  downloadButton.textContent = 'Generando…';

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
    showError('No se ha podido generar el .zip. Inténtalo de nuevo.');
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = originalLabel;
  }
});
```

- [ ] **Step 2: Verify manually**

Run: `python3 -m http.server 8000 --directory web`, open `http://localhost:8000/`, drag in the same sample file from Task 12, then click "⬇️ Descargar todo (.zip)".

Expected: the browser downloads `kindle-notion-export-YYYYMMDD.zip` (today's date). Unzip it and confirm it contains `Blood_Sweat_and_Pixels.md` with the expected header (`# Blood, Sweat, and Pixels`, `Author: Jason Schreier`, `Highlights: 1 | Notes: 0 | Bookmarks: 0`) and the highlight bullet.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "Add zip download to app.js using vendored JSZip"
```

---

### Task 14: End-to-end verification against a real `My Clippings.txt` + enable GitHub Pages

**Files:** none (manual verification + a one-time repo settings change).

- [ ] **Step 1: Compare web output against the frozen CLI script for a real file**

Using the same real `My Clippings.txt` you'd use for `cli/parse_kindle_notion_v1_1e.py` (per the README's testing approach):

```bash
python3 cli/parse_kindle_notion_v1_1e.py
```

(run from the repo root, with that file present), then separately drop the same file onto the running `web/index.html` (Task 13) and download the zip.

Expected: for each book, the body content (highlight/note/bookmark bullets, paired notes, positions, dates) matches between the `Books/*.md` produced by the CLI and the `.md` files inside the downloaded zip. Header labels may legitimately differ in language for non-English books — that's the intended `detectBookLang` improvement over `v1_1e`'s static English default, not a bug.

- [ ] **Step 2: Run the full parser.js test suite one more time**

Run: `node --test web/parser.test.js`
Expected: PASS (41 tests passing, 0 failing)

- [ ] **Step 3: Enable GitHub Pages from `/web`**

In the GitHub repository settings (Settings → Pages), set the source to "Deploy from a branch", branch `main`, folder `/web`. Save.

Expected: GitHub shows a published URL (e.g. `https://melinDross.github.io/Kindle-Enhanced-Clippings-Exporter/` — confirm the exact org/repo name in the Pages settings page, since the remote reported the repo was renamed). Visit that URL and confirm `index.html` loads and the drag-and-drop flow from Task 13 works there too.

- [ ] **Step 4: Update README with the live link**

Add a short note near the top of `README.md` (after the intro paragraph) pointing at the published GitHub Pages URL, so non-technical users find the web version without reading the rest of the document.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "Document the published web exporter URL in README"
```
