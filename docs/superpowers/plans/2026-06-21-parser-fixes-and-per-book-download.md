# Parser Fixes + Per-Book Download + Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three real parsing bugs (filename collision, nested-parenthesis title/author regex, silently-dropped language signal from merged notes), add two robustness improvements (delimiter-safe block splitting, per-book "unrecognized language" flag), add basic accessibility to the drop zone/buttons/live regions, and add a per-book individual download button — all in the client-side web exporter under `web/`.

**Architecture:** All parsing logic lives in `web/parser.js` (pure functions, covered by `web/parser.test.js`, run via `node --test web/parser.test.js`). UI logic lives in `web/app.js`, copy in `web/strings.js`, markup in `web/index.html`, styles in `web/style.css`. No backend, no build step — these are loaded directly as ES modules by the browser and by Node's test runner.

**Tech Stack:** Vanilla JS (ES modules), Node's built-in `node:test`/`node:assert`, JSZip (vendored, only used for the "download all" button), plain CSS.

## Global Constraints

- `web/parser.js` is the sole source of truth for parsing logic (per `CLAUDE.md` "Gobernanza del parsing") — do not touch `cli/parse_kindle_notion_v1_1e.py`.
- No new dependencies. No build step. No backend.
- Run `node --test web/parser.test.js` after every parser.js change; all tests must pass before moving to the next task.
- Out of scope (do not implement): file size/type limits before reading, `pairNotes` O(n²) complexity, test coverage for sort tie-breaks/Bookmark branches/mixed-language signal in `detectEntryLang`, anything beyond a single warning string for unrecognized language.

---

### Task 1: `safeName()` keeps spaces instead of underscores

**Files:**
- Modify: `web/parser.js:8-11`
- Test: `web/parser.test.js:5-15` (update existing tests, this task does not add new ones)

**Interfaces:**
- Produces: `safeName(name: string): string` — unchanged signature, changed behavior (collapses whitespace runs into a single space `' '` instead of `'_'`).

- [ ] **Step 1: Update the three existing `safeName` tests to expect spaces**

In `web/parser.test.js`, replace lines 5-15:

```js
test('safeName strips punctuation and joins words with a single space', () => {
  assert.equal(safeName('Parque Jurásico (Z-Library)'), 'Parque Jurásico Z-Library');
});

test('safeName collapses multiple spaces and trims', () => {
  assert.equal(safeName('  Hábitos   atómicos  '), 'Hábitos atómicos');
});

test('safeName keeps hyphens and underscores as-is', () => {
  assert.equal(safeName('Self-Help_Classics'), 'Self-Help_Classics');
});
```

- [ ] **Step 2: Run the tests to verify they fail against current behavior**

Run: `node --test web/parser.test.js`
Expected: the three `safeName` tests FAIL (actual value still has underscores), all other tests still PASS.

- [ ] **Step 3: Update `safeName` implementation**

In `web/parser.js`, replace lines 8-11:

```js
export function safeName(name) {
  const cleaned = name.replace(/[^\p{L}\p{N}_\s-]/gu, '').trim();
  return cleaned.replace(/\s+/g, ' ');
}
```

Also update the doc comment above it (lines 1-7) — it currently says "collapses whitespace runs into underscores"; change that phrase to "collapses whitespace runs into a single space".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test web/parser.test.js`
Expected: all tests PASS (45 existing, no new ones yet).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "fix: safeName collapses spaces instead of converting to underscores"
```

---

### Task 2: Filename includes the author

**Files:**
- Modify: `web/parser.js` (`exportBooks`, currently line 309: `filename: \`${safeName(group.title)}.md\`,`)
- Test: `web/parser.test.js` (new test; update one existing assertion)

**Interfaces:**
- Consumes: `safeName` from Task 1.
- Produces: `exportBooks(...)` book objects now have `filename: '<safeName(title)> (<safeName(author)>).md'` when `author` is non-empty, else `'<safeName(title)>.md'` — this is what Task 8 (per-book download) and the zip download rely on.

- [ ] **Step 1: Write the failing test**

Add to `web/parser.test.js`, after the existing `exportBooks` tests (after line 367, before the "returns an empty array" test or anywhere in that block):

```js
test('exportBooks includes the author in the filename to avoid collisions between same-titled books', () => {
  const books = exportBooks(SAMPLE_CLIPPINGS, 'My Clippings.txt');
  const jurassic = books.find((b) => b.title === 'Parque Jurásico');
  assert.equal(jurassic.filename, 'Parque Jurásico (Michael Crichton).md');
});

test('exportBooks omits the parenthesized author segment in the filename when there is no author', () => {
  const text = 'Title Without Author\n- Your Highlight on Page 1 | Loc. 1\n\nText.\n==========\n';
  const books = exportBooks(text, 'My Clippings.txt');
  assert.equal(books[0].filename, 'Title Without Author.md');
});
```

Also update the existing assertion at line 357 (`assert.equal(bsp.filename, 'Blood_Sweat_and_Pixels.md');`) to:

```js
  assert.equal(bsp.filename, 'Blood, Sweat, and Pixels (Jason Schreier).md');
```

And the one at line 364 (`assert.equal(jurassic.filename, 'Parque_Jurásico.md');`) — this line is superseded by the new test above; remove it (the new test at line ~368 covers the same field with the corrected expectation).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/parser.test.js`
Expected: FAIL on the filename assertions (actual is still `${safeName(title)}.md` with no author, underscored).

- [ ] **Step 3: Update `exportBooks`**

In `web/parser.js`, inside the `books.push({...})` block (around line 306-316), replace:

```js
      filename: `${safeName(group.title)}.md`,
```

with:

```js
      filename: group.author
        ? `${safeName(group.title)} (${safeName(group.author)}).md`
        : `${safeName(group.title)}.md`,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/parser.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "fix: include author in exported filename to avoid same-title collisions"
```

---

### Task 3: Title/author regex supports nested parentheses

**Files:**
- Modify: `web/parser.js:167` (inside `parseEntries`)
- Test: `web/parser.test.js` (new tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: `parseEntries` now correctly splits `"Parque Jurásico (Z-Library) (Michael Crichton)"` into `title="Parque Jurásico (Z-Library)"`, `author="Michael Crichton"`.

- [ ] **Step 1: Write the failing tests**

Add to `web/parser.test.js`, near the other `parseEntries` tests (after line 261, the "treats a title with no parenthesized author" test):

```js
test('parseEntries takes the last unnested parenthesized group as author when the title itself contains parentheses', () => {
  const text = 'Parque Jurásico (Z-Library) (Michael Crichton)\n- Your Highlight on Page 1 | Loc. 1\n\nText.\n==========\n';
  const books = parseEntries(text);
  assert.equal(books[0].title, 'Parque Jurásico (Z-Library)');
  assert.equal(books[0].author, 'Michael Crichton');
});

test('parseEntries still parses a simple single-parenthesis title/author correctly', () => {
  const text = 'Some Title (Some Author)\n- Your Highlight on Page 1 | Loc. 1\n\nText.\n==========\n';
  const books = parseEntries(text);
  assert.equal(books[0].title, 'Some Title');
  assert.equal(books[0].author, 'Some Author');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/parser.test.js`
Expected: FAIL on the nested-parentheses test (current regex is non-greedy and stops at the first `)`, giving `title="Parque Jurásico"`, `author="Z-Library"`, and treating `"(Michael Crichton)"` as trailing garbage dropped from the match entirely — actual title/author will differ from expected).

- [ ] **Step 3: Update the regex**

In `web/parser.js`, line 167, replace:

```js
    const titleMatch = titleLine.match(/^(.+?)\s*\((.+?)\)\s*$/);
```

with:

```js
    const titleMatch = titleLine.match(/^(.+)\s*\(([^()]+)\)\s*$/);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/parser.test.js`
Expected: PASS, including all pre-existing `parseEntries` tests (the title-group going from `.+?` to `.+` is still anchored by the trailing `\(([^()]+)\)\s*$`, so single-parenthesis cases are unaffected).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "fix: title/author regex handles nested parentheses in book titles"
```

---

### Task 4: `detectBookLang` runs on unmerged entries; add `langDetected` field

**Files:**
- Modify: `web/parser.js` (`exportBooks`, around line 303 and the `books.push` block around line 306-316)
- Test: `web/parser.test.js` (new tests)

**Interfaces:**
- Consumes: `detectBookLang(items)` (existing, unchanged signature — still takes an array of objects with a `.lang` field and returns `'es'`/`'en'`).
- Produces: `exportBooks(...)` book objects gain a new boolean field `langDetected`.

- [ ] **Step 1: Write the failing tests**

Add to `web/parser.test.js`, after the `exportBooks` filename tests added in Task 2:

```js
test('exportBooks sets langDetected=true when at least one entry has a recognized language', () => {
  const books = exportBooks(SAMPLE_CLIPPINGS, 'My Clippings.txt');
  const bsp = books.find((b) => b.title === 'Blood, Sweat, and Pixels');
  assert.equal(bsp.langDetected, true);
});

test('exportBooks sets langDetected=false when no entry has a recognized language', () => {
  const text = 'Some Title (Some Author)\n- ??? unrecognized metadata line\n\nText.\n==========\n';
  const books = exportBooks(text, 'My Clippings.txt');
  assert.equal(books[0].langDetected, false);
});

test('exportBooks keeps the language signal from a note that gets merged into a highlight (langDetected and book lang)', () => {
  // The Note's metadata line is the only one with an English signal; the Highlight's
  // metadata line has none. detectBookLang must see the Note's lang even though
  // pairNotes() merges it into the Highlight and drops its standalone entry.
  const text = `Some Title (Some Author)
- ???
Loc. 49-50

Highlight text with no language signal.
==========
Some Title (Some Author)
- Your Note on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:40:00 PM

A note in English.
==========
`;
  const books = exportBooks(text, 'My Clippings.txt');
  assert.equal(books[0].langDetected, true);
});
```

Note: the first metadata line `- ???\nLoc. 49-50` above is intentionally unparseable by `extractKind`/`detectEntryLang` (defaults to `Highlight` kind, `lang: null`) but `parsePos` still needs `Loc. 49-50` somewhere to overlap the Note — adjust if needed so the Highlight's `posStart`/`posEnd` are `49`/`50`. Since `parsePos` reads from the same single metadata line, write the highlight's metadata line as `- ??? Loc. 49-50` (one line) instead of splitting across two — fix the fixture to:

```js
  const text = `Some Title (Some Author)
- ??? Loc. 49-50

Highlight text with no language signal.
==========
Some Title (Some Author)
- Your Note on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:40:00 PM

A note in English.
==========
`;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/parser.test.js`
Expected: FAIL — `langDetected` is `undefined` on all three new tests (field doesn't exist yet), and the merged-note test fails because `detectBookLang(paired)` today only sees the Highlight (lang `null`) since the Note's standalone entry was merged away, giving `enCount === 0 && esCount === 0`, defaulting to `'en'` — but the test only checks `langDetected`, not the lang value, so confirm it fails specifically on `langDetected`.

- [ ] **Step 3: Update `exportBooks`**

In `web/parser.js`, inside the `for (const group of groups)` loop (around line 290-316), change:

```js
    const lang = detectBookLang(paired);
```

to:

```js
    const lang = detectBookLang(group.items);
```

And add the new field to the `books.push({...})` object (alongside `filename` from Task 2):

```js
      langDetected: group.items.some((it) => it.lang !== null),
```

So the full push block reads:

```js
    books.push({
      title: group.title,
      author: group.author,
      filename: group.author
        ? `${safeName(group.title)} (${safeName(group.author)}).md`
        : `${safeName(group.title)}.md`,
      langDetected: group.items.some((it) => it.lang !== null),
      markdown,
      stats: {
        highlights: paired.filter((it) => it.kind === 'Highlight').length,
        notes: paired.filter((it) => it.metaOverrideKind === 'Note' || it.kind === 'Note').length,
        bookmarks: paired.filter((it) => it.kind === 'Bookmark').length,
      },
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/parser.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "fix: detect book language from unmerged entries and expose langDetected flag"
```

---

### Task 5: Robust block splitting (delimiter only matches on its own line)

**Files:**
- Modify: `web/parser.js` (`parseEntries`, lines 152-199)
- Test: `web/parser.test.js` (new test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `parseEntries` behavior unchanged for all existing inputs; now also correctly handles a highlight whose text contains the literal substring `"=========="` (no longer mis-splits on it).

- [ ] **Step 1: Write the failing test**

Add to `web/parser.test.js`, near the other `parseEntries` tests:

```js
test('parseEntries does not split a block when "==========" appears inside a highlight\'s text rather than on its own line', () => {
  const text = 'Some Title (Some Author)\n- Your Highlight on Page 1 | Loc. 1\n\nThis text contains ========== as a literal substring, not a delimiter.\n==========\n';
  const books = parseEntries(text);
  assert.equal(books.length, 1);
  assert.equal(books[0].items.length, 1);
  assert.equal(
    books[0].items[0].text,
    'This text contains ========== as a literal substring, not a delimiter.'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/parser.test.js`
Expected: FAIL — current `text.split('==========')` splits inside the highlight text itself, producing 2 blocks instead of 1, so `books[0].items[0].text` ends up truncated to `'This text contains '` (trimmed) instead of the full sentence.

- [ ] **Step 3: Rewrite `parseEntries` to split line-by-line**

In `web/parser.js`, replace the body of `parseEntries` (lines 152-199) with:

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

    const [titleLine, metaLine] = lines;
    const content = lines.slice(2).join('\n').trim();

    const titleMatch = titleLine.match(/^(.+)\s*\(([^()]+)\)\s*$/);
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
      noteText: undefined,
    };

    // Use a collision-free key: JSON.stringify(tuple) instead of naive
    // string concatenation, which could collide when space boundaries shift.
    // E.g. title="Foo" author="Bar Baz" and title="Foo Bar" author="Baz"
    // both produce "Foo Bar Baz" with concatenation but distinct keys with tuple.
    const key = JSON.stringify([title, author]);
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

Note this already includes the Task 3 regex (`[^()]+`) since both changes touch the same function — keep them consistent with what Task 3 already committed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/parser.test.js`
Expected: PASS, all tests including pre-existing ones (the old behavior used `.trim()` on the whole block before splitting lines; the new version trims each line individually via the existing `.map((l) => ...trim())` — verify the `'parseEntries returns an empty array for a file with no valid blocks'` test still passes, since an all-empty block now produces `lines.length === 0 < 2` and is skipped, same as before).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js web/parser.test.js
git commit -m "fix: split clippings blocks line-by-line so a literal ========== in highlight text isn't mistaken for the delimiter"
```

---

### Task 6: New UI strings (`langWarning`, `downloadOneLabel`, `dropZoneAriaLabel`)

**Files:**
- Modify: `web/strings.js`

**Interfaces:**
- Produces: `STRINGS.es.langWarning`, `STRINGS.es.downloadOneLabel`, `STRINGS.es.dropZoneAriaLabel`, and the `en` equivalents — consumed by Task 7 and Task 9.

This task has no automated test (per spec: "Sin tests automatizados para los cambios de `app.js`" — these strings are pure UI copy with no parser-level test coverage, consistent with the rest of `strings.js` which is untested).

- [ ] **Step 1: Add the new keys**

In `web/strings.js`, inside the `es` object (after `generatingLabel: 'Generando…',` on line 19), add:

```js
    langWarning: '⚠️ Idioma no reconocido — revisa el resultado',
    downloadOneLabel: '⬇️ Descargar',
    dropZoneAriaLabel: 'Subir fichero My Clippings.txt',
```

Inside the `en` object (after `generatingLabel: 'Generating…',` on line 31), add:

```js
    langWarning: '⚠️ Unrecognized language — please check the result',
    downloadOneLabel: '⬇️ Download',
    dropZoneAriaLabel: 'Upload My Clippings.txt file',
```

- [ ] **Step 2: Verify by running the existing test suite (sanity check, no parser changes here)**

Run: `node --test web/parser.test.js`
Expected: PASS (this file doesn't test `strings.js`, but running it confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add web/strings.js
git commit -m "feat: add UI strings for language warning, per-book download, and drop zone aria-label"
```

---

### Task 7: Per-book row with individual download button

**Files:**
- Modify: `web/app.js` (`renderBooks`, lines 29-47)
- Modify: `web/style.css` (add `.book-row` and `.download-one-button` rules)

**Interfaces:**
- Consumes: `t('langWarning')`, `t('downloadOneLabel')` from Task 6; `book.langDetected` from Task 4; `book.filename`/`book.markdown` (existing fields) for `downloadSingleBook` from Task 8.
- Produces: each `<li>` in `#book-list` is now a flex row containing a text `<span>` and a download `<button class="download-one-button">`.

No automated test for this task (DOM rendering in `app.js`, untested per spec — verify manually in Task 10).

- [ ] **Step 1: Rewrite `renderBooks`**

In `web/app.js`, replace lines 29-47:

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

(`downloadSingleBook` is defined in Task 8 — function declarations in this file are hoisted-by-convention via `const` at module scope below, so define it before this point or anywhere in the module; Task 8 places it immediately after this function.)

- [ ] **Step 2: Add CSS for the row layout**

In `web/style.css`, after the `#book-list li` rule (after line 68), add:

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

- [ ] **Step 3: Commit**

(Commit together with Task 8, since `renderBooks` references `downloadSingleBook` which doesn't exist until Task 8 — see Task 8 Step 2 for the combined commit.)

---

### Task 8: `downloadSingleBook` function

**Files:**
- Modify: `web/app.js` (add new function, place immediately after `renderBooks`, i.e. after the closing brace that was at old line 47)

**Interfaces:**
- Consumes: `book.markdown`, `book.filename` (existing `exportBooks` output fields).
- Produces: `downloadSingleBook(book)` — referenced by the click handler added in Task 7 Step 1.

- [ ] **Step 1: Add the function**

In `web/app.js`, immediately after the `renderBooks` function (the one just rewritten in Task 7), add:

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

- [ ] **Step 2: Commit Task 7 + Task 8 together**

```bash
git add web/app.js web/style.css
git commit -m "feat: add per-book download button and language warning to the results list"
```

---

### Task 9: Accessibility — drop zone, language buttons, live regions

**Files:**
- Modify: `web/app.js` (`applyLang`, lines 54-70; add a new `keydown` listener near the other `dropZone` listeners, lines 86-102)
- Modify: `web/index.html` (drop zone div line 19-21, `#error-message` line 24, `#book-count` line 27)

No automated test for this task — manual browser verification in Task 10.

- [ ] **Step 1: Add static ARIA attributes in `index.html`**

In `web/index.html`, change line 19-21 from:

```html
    <div id="drop-zone" class="drop-zone">
      ⬆️ Arrastra aquí tu "My Clippings.txt"<br>o haz clic para seleccionar
    </div>
```

to:

```html
    <div id="drop-zone" class="drop-zone" role="button" tabindex="0">
      ⬆️ Arrastra aquí tu "My Clippings.txt"<br>o haz clic para seleccionar
    </div>
```

Change line 24 from:

```html
    <p id="error-message" class="error" hidden></p>
```

to:

```html
    <p id="error-message" class="error" aria-live="polite" hidden></p>
```

Change line 27 from:

```html
      <h2 id="book-count"></h2>
```

to:

```html
      <h2 id="book-count" aria-live="polite"></h2>
```

- [ ] **Step 2: Set `aria-label` on the drop zone and `aria-pressed` on language buttons in `applyLang`**

In `web/app.js`, in `applyLang` (lines 54-70), after the line `dropZone.innerHTML = t('dropZone');`, add:

```js
  dropZone.setAttribute('aria-label', t('dropZoneAriaLabel'));
```

And after the lines `langEsButton.classList.toggle('active', lang === 'es');` / `langEnButton.classList.toggle('active', lang === 'en');`, add:

```js
  langEsButton.setAttribute('aria-pressed', String(lang === 'es'));
  langEnButton.setAttribute('aria-pressed', String(lang === 'en'));
```

So the full updated function reads:

```js
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('uiLang', lang);
  document.documentElement.lang = lang;

  dropZone.innerHTML = t('dropZone');
  dropZone.setAttribute('aria-label', t('dropZoneAriaLabel'));
  if (!downloadButton.disabled) downloadButton.textContent = t('downloadLabel');
  langEsButton.classList.toggle('active', lang === 'es');
  langEnButton.classList.toggle('active', lang === 'en');
  langEsButton.setAttribute('aria-pressed', String(lang === 'es'));
  langEnButton.setAttribute('aria-pressed', String(lang === 'en'));

  if (!errorMessage.hidden && lastErrorKey) {
    errorMessage.textContent = t(lastErrorKey);
  }
  if (!results.hidden && currentBooks.length > 0) {
    renderBooks(currentBooks);
  }
}
```

- [ ] **Step 3: Add keyboard handler for the drop zone**

In `web/app.js`, after the existing `dropZone.addEventListener('drop', ...)` block (after line 102), add:

```js
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add web/app.js web/index.html
git commit -m "feat: add keyboard support and ARIA attributes to drop zone, language buttons, and live regions"
```

---

### Task 10: Full verification — automated tests + manual browser check

**Files:** none (verification only)

- [ ] **Step 1: Run the full parser test suite**

Run: `node --test web/parser.test.js`
Expected: all tests PASS (45 pre-existing + ~10 new from Tasks 1-5 ≈ 55 total). Record the actual count.

- [ ] **Step 2: Manually verify in a browser**

Serve `web/` (e.g. `cd web && python3 -m http.server 8000`), open `http://localhost:8000`, and check:
- Drop a `My Clippings.txt` sample file (or use one under `Books/` if available, or construct a minimal one with two books, one with a nested-parenthesis title like `Foo (Z-Library) (Bar)`).
- Confirm each book row shows a "⬇️ Descargar"/"⬇️ Download" button on the right, and clicking it downloads a `.md` file named `<title> (<author>).md`.
- Confirm a book with no recognized language metadata shows the `⚠️` warning suffix.
- Tab to the drop zone with keyboard only, press Enter/Space, confirm the file picker opens.
- Toggle ES/EN and confirm `aria-pressed` updates (inspect via devtools) and the drop zone `aria-label` text changes.
- Confirm the "download all" `.zip` button still works and produces correctly-named files inside the zip (now including author in each entry's filename).

- [ ] **Step 3: Report results**

No commit for this task — it's verification only. If any check fails, return to the relevant task and fix before considering the plan complete.
