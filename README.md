**EN** | [ES](README.es.md)

<img src="docs/logo.svg" width="72" height="72" alt="Clip Harbor for Kindle logo — a lighthouse casting a highlighter beam">

# Clip Harbor for Kindle — Kindle Highlights → Notion Markdown Exporter
### QA / automation project | Python · JavaScript · Web · Markdown · Notion

[![Deploy](https://img.shields.io/github/actions/workflow/status/melinDross/ClipHarborKindle/deploy-pages.yml?branch=main&label=deploy)](https://github.com/melinDross/ClipHarborKindle/actions/workflows/deploy-pages.yml)
[![Live site](https://img.shields.io/website?url=https%3A%2F%2Fmelindross.github.io%2FClipHarborKindle%2F&label=live%20demo)](https://melindross.github.io/ClipHarborKindle/)
[![Last commit](https://img.shields.io/github/last-commit/melinDross/ClipHarborKindle)](https://github.com/melinDross/ClipHarborKindle/commits/main)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)](LICENSE)

![The live app — drag in My Clippings.txt, get one Markdown file per book back](docs/screenshots/app-results-light.png)

Clip Harbor for Kindle automatically converts the highlights and notes you make on a Kindle into Markdown files ready to import into Notion. It started as a Python command-line script; today the actively maintained version is an **install-free web app**, built for anyone — no terminal required: **[melindross.github.io/ClipHarborKindle](https://melindross.github.io/ClipHarborKindle/)**. Drag in your `My Clippings.txt` and download the `.zip` (or each `.md` individually) — everything runs in your browser, the file is never sent to any server.

**Live:** [melindross.github.io/ClipHarborKindle](https://melindross.github.io/ClipHarborKindle/)

This README documents the project as a **QA and automation case study**: not just what was built, but the actual bugs found, the version cancelled mid-development, and the reasoning behind each design decision — the same kind of trail I'd leave for a teammate picking up this code cold.

---

## 🚀 Quick start

No install needed — the tool is a static site, so the fastest path is just using it:

1. Open **[melindross.github.io/ClipHarborKindle](https://melindross.github.io/ClipHarborKindle/)**
2. Drag your Kindle's `My Clippings.txt` onto the drop zone (or click to browse)
3. Download the `.zip` (all books) or individual `.md` files per book

To run it from a local clone instead:

```bash
git clone https://github.com/melinDross/ClipHarborKindle.git
cd ClipHarborKindle
open web/index.html   # or just double-click it — no server, no build step
```

The original Python CLI still works too, if you prefer a terminal and already have `My Clippings.txt` at hand — see "⚙️ Running it locally" further down.

---

## 💡 Where the idea came from

The starting point wasn't "let's build a Kindle exporter" in the abstract — it was trying an existing tool and finding it fell short. I tried [clippings.io](https://clippings.io), a third-party Kindle-highlight exporter, and the result didn't convince me: flat formatting, no useful visual structure, no relevant metadata, and no linkage at all between notes and the highlights they belonged to.

![clippings.io test — flat output with no structure](docs/screenshots/clippings-io-comparison.png)

That got me asking how hard it would actually be to build exactly the output I needed myself. This project is the answer to that question.

### What `My Clippings.txt` actually is

When you highlight something on a Kindle, the device automatically saves it to a plain-text file called `My Clippings.txt`, stored in the reader's internal memory. This file accumulates every annotation from every book, in the order you made them, with no separation by book and no navigable structure.

Each entry follows Amazon's proprietary format:

```
Blood, Sweat, and Pixels (Jason Schreier)
- Your Highlight on Page 6 | Loc. 49-50 | Added on Thursday, June 13, 2024 10:38:24 PM

Developers everywhere talk about how hard it is to make games.
==========
Blood, Sweat, and Pixels (Jason Schreier)
- Your Note on Page 6 | Loc. 46-48 | Added on Thursday, June 13, 2024 10:28:16 PM

With all the unexpected things that came up during development...
==========
```

Every block ends in `==========`. There's no hierarchical structure, no explicit relationship between a note and the highlight it belongs to, and the metadata's language changes depending on the device's settings. Unprocessed, that file is unreadable in any external tool and practically impossible to search or review.

This project solves exactly that: it parses the file, groups annotations by book, automatically pairs each note with its matching highlight, and generates one clean, readable, Notion-compatible `.md` per book.

---

## 🙋 Who it's for

Anyone who reads on a Kindle and wants to bring their highlights into a knowledge-management system like Notion, without depending on third-party apps, subscriptions, or external APIs.

The primary use case is my own: I read frequently, highlight a lot, and needed to review and search my highlights in Notion without the manual copy-paste-per-entry process.

Most people today should use the web version — no install, just a browser. The Python CLI is still there for anyone who prefers it or already has it in their workflow: it has zero external dependencies (no `pip install`, no account with any service) — just Python 3.9+ and the file from your Kindle.

---

## 🛠️ Tools and technologies

### Original CLI (Python — frozen, see Phase 5)

| Layer | Choice |
|---|---|
| **Language** | Python 3.9+ (no external dependencies) |
| **Standard libraries** | `re` (regex), `pathlib` (cross-platform paths), `datetime`, `shutil` (file copies), `sys` |
| **Input format** | Plain UTF-8 text — the Kindle's `My Clippings.txt` |
| **Output format** | Markdown (`.md`), Notion-compatible syntax |
| **Operating systems** | macOS and Windows (documented and tested on both) |

Skipping external dependencies was deliberate: a personal tool needs to keep working at any time without managing virtual environments or package versions. Zero installation friction.

### Web version (JavaScript — active, current source of truth)

| Layer | Choice |
|---|---|
| **Language** | JavaScript (native ES modules, no transpiling) |
| **Build** | None — no bundler, no `npm install`, modules load directly in the browser |
| **Dependency** | [JSZip](https://stuk.github.io/jszip/), vendored (`web/vendor/jszip.min.js`), lazy-loaded only for the "download all (.zip)" button, pinned with an SRI hash |
| **Tests** | `node:test` + `node:assert` (built into Node, no external test library) — `web/parser.test.js`, `web/strings.test.js` |
| **Hosting / deploy** | GitHub Pages, auto-deployed via GitHub Actions on every push to `main` that touches `web/` |
| **Security** | Strict CSP (`script-src 'self'`, `frame-ancestors 'none'`), `Referrer-Policy`, no `innerHTML` with dynamic data |
| **Accessibility** | `aria-live`, `aria-pressed`, keyboard-navigable drop zone, 44×44px touch targets |

Both share **version control** (Git + GitHub) and **destination tool** (Notion — manual import or via the official Notion Importer).

---

## 🐛 Technical problems solved

A sample of the real engineering problems this project ran into — not a feature list, a "what actually went wrong and how it got fixed" list:

- **A broken regex silently corrupted the most common Kindle position format.** The character class for position ranges was written as `[\-–—]` (hyphen, en-dash, em-dash). That leading backslash-hyphen pair is interpreted as a Unicode *range* between `\` (0x5C) and `–` (0x2013) — not a literal character class — so a plain ASCII hyphen (the format every Kindle set to English/Spanish actually uses) silently failed to match. `Loc. 49-50` parsed as `pos_start=49, pos_end=None` instead of `(49, 50)`, breaking note-to-highlight pairing by range overlap for the single most common input format. Fixed to `[-–—]`; verified with `parse_pos('Loc. 49-50')` returning `(49, 50)` instead of `(49, None)`.
- **Nested parentheses in a book title broke the title/author split — and produced real duplicate books.** The regex `^(?P<title>.+?)\(\s*(?P<author>.+?)\)\s*$` doesn't handle titles like `"Jurassic Park (Z-Library) (Michael Crichton)"` (common when an ebook comes from an unofficial source) — it captured `"Z-Library"` as the author. This shipped two separate files, `Parque_Jurasico.md` and `Parque_Jurásico.md`, for the same book, both with a mangled author field — confirmed by inspecting the actual output in `Books/`, not just reading the code. Fixed in the web parser by taking the *last* unnested parenthesis group as the author (`^(.+)\s*\(([^()]+)\)\s*$`), covered by a dedicated test in `parser.test.js`.
- **Two books with the same title and different authors could overwrite each other's file.** The filename was generated from the title alone. Fixed by including the author in the filename (`Title (Author).md`), with a collision-free grouping key (`JSON.stringify([title, author])` instead of string concatenation, which could itself collide when word boundaries shifted — e.g. `"Foo"`+`"Bar Baz"` and `"Foo Bar"`+`"Baz"` both concatenate to `"Foo Bar Baz"`).
- **A Kindle set to an unsupported language exported silently, with no way to know the language wasn't recognized.** Detection only understood English/Spanish keywords; anything else just meant `lang: null` with no visible signal. Fixed by voting language per entry across a book and showing an explicit "⚠️ Unrecognized language" warning in the UI when no entry in a book had a detectable language — turning a silent gap into a visible one.
- **A highlight containing the literal string `==========` inside its own text could be mistaken for the block delimiter.** The original split used `text.split('==========')`, which matches that substring anywhere, not just on its own line. Fixed by splitting line-by-line and only treating a line as a delimiter when it equals `==========` after trimming.

---

## 🏗️ How I built it

### Phase 1 — Understanding the real problem

Before writing a single line of code, I spent time going through `My Clippings.txt` by hand. I needed to understand how many distinct block types existed (highlight, note, bookmark), whether the format was stable across books and devices, and what information was actually worth keeping and in what order.

I found immediately that the note–highlight relationship wasn't explicit in the file at all. That became the central problem to solve, and it shaped the whole script's architecture from the start.

### Phase 2 — A working basic parser (v1.1d)

The first working script did the essentials: split the file on `==========`, extract title/author/kind/position/text from each block, group everything by book (title + author as key), and generate one `.md` per book with highlights as bullets and metadata in a blockquote. Note-to-highlight pairing by position overlap, bilingual date parsing, and filename sanitization were already implemented at this stage. What it didn't have: backups of the source file or an execution log.

### Phase 3 — Identifying risk and adding safeguards (v1.1e)

After using v1.1d for a while, I identified a real operational risk: the script overwrites the output `.md` files on every run. If parsing failed — or I was experimenting with changes — the previous good output was gone with no way to recover it.

I added two safety mechanisms: an **automatic backup** of `My Clippings.txt` to `backups/` with a timestamp before every run, and an **execution log** (`logs/last_run.txt`) recording date, books processed, highlight/note/bookmark totals, source file, and backup filename — turning every run into something auditable.

### Phase 4 — Deduplication experiment (v1.2 — cancelled)

I tried adding deduplication logic: detect whether a highlight had already been exported in a previous run and skip it, to avoid duplicates on re-import into Notion. I built and tested the logic, then discarded it before merging — comparing against a previous state introduced false negatives: legitimate highlights silently skipped. For a tool whose core job is *not losing any annotation*, that instability was unacceptable. **QA call:** keep v1.1e as the stable version and cancel v1.2 rather than ship something that worked "almost always." A silent failure here — losing a highlight without warning — is worse than not having the feature at all.

### Phase 5 — Migrating to web: `parser.js` becomes the source of truth

v1.1e stayed the CLI's stable version, but it still had a real barrier to entry: it required Python installed, minimal terminal knowledge, and cloning or downloading the repo. To let anyone with a Kindle use the tool — not just people who code — I ported the entire parsing logic to JavaScript and ran it 100% in the browser, no backend: you drag the file in, processing happens on your machine, you download the result. With no server involved, `My Clippings.txt` (which can hold years of personal notes) never leaves your device.

This raised an immediate governance question: with the same logic now living in two places (the `.py` and the `.js`), where do bugs get fixed going forward? Keeping two hand-synced implementations in two different languages is a recipe for silent divergence — fixing something in one and forgetting the other until someone notices by accident. So I made an explicit governance call, documented in `CLAUDE.md`:

> **`web/parser.js` becomes the source of truth for parsing logic.** `cli/parse_kindle_notion_v1_1e.py` is **frozen**: it keeps working for anyone running it via CLI, but receives no more parsing fixes or features. Every improvement from this point on lands only in `parser.js`.

With that decided, the first round of web work was a functional MVP (drag&drop → parse → download `.zip`) plus a UI language switcher (ES/EN, independent of the generated `.md` files' language). The second round — with the CLI now officially frozen — fixed several long-documented bugs, deliberately **not ported to the `.py`**: the filename collision, the nested-parentheses title/author regex, the silent unsupported-language gap (see "Technical problems solved" above), plus more robust language detection when a note merges into a highlight, a delimiter-collision-proof block split, per-book individual download (not just the full `.zip`), and baseline accessibility (keyboard, `aria-live`, `aria-pressed`). This round was also the first time the project had **automated tests** — see "How I tested this" for why that changed.

### Phase 6 — Security, accessibility, and performance hardening

A full multi-discipline audit (security, WCAG 2.2 AA accessibility, SEO/GEO, performance, mobile) surfaced ten findings, of which the highest-value quick wins shipped immediately: a `frame-ancestors 'none'` CSP directive, a real `<h1>` (the page previously had no heading above `<h2>`, breaking the heading hierarchy), 44×44px minimum touch targets on the language-switch and per-book download buttons, an SRI-pinned hash on the vendored JSZip, lazy-loading JSZip only when "download all" is actually clicked (single-book downloads never needed it, so every visit was paying its parse cost for nothing), a `Referrer-Policy` header, and a responsive header that wraps instead of squeezing on narrow viewports.

---

## 📸 Screenshots

| Landing (light) | Landing (dark mode) |
|---|---|
| ![Landing screen, light mode](docs/screenshots/app-landing-light.png) | ![Landing screen, dark mode, following prefers-color-scheme](docs/screenshots/app-landing-dark.png) |

| clippings.io comparison | Real Notion import result |
|---|---|
| ![clippings.io test — flat output with no structure](docs/screenshots/clippings-io-comparison.png) | ![Notion import — How to Win Friends and Influence People](docs/screenshots/notion-import-result.png) |

All four screenshots above are the real, live app and a real generation — none are mockups. The landing shots are from [melindross.github.io/ClipHarborKindle](https://melindross.github.io/ClipHarborKindle/); the Notion import result ("Cómo ganar amigos e influir sobre las personas" / *How to Win Friends and Influence People*) is a real book processed through the tool.

---

## 🧪 How I tested this

The CLI has no automated unit tests, and that's a conscious decision worth explaining. The web version does — see "Why that criterion changed" below.

### Structured manual validation approach (CLI)

Testing was manual and iterative, but with a clear criterion each cycle:

**1. Real personal test file.** The input was my own `My Clippings.txt`, with 200+ highlights across 12+ books in English and Spanish — real-world variability from day one, no need to fabricate test data.

**2. Visual output inspection.** After every change, I compared the generated `.md` against the original file by hand: are all the highlights there? Are notes attached to the right highlight? Do bookmarks export without losing information? Does the format look right when imported into Notion?

**3. Cross-version comparison.** Moving from v1.1d to v1.1e, I ran both versions on the same input and diffed the outputs line by line. The rule was explicit: v1.1e cannot produce any different `.md` content, only add backup and logging. That comparison was my manual regression test.

**4. Known edge-case checks**

| Case | What I verified |
|---|---|
| Books with no identifiable author | Script doesn't fail; exports the book without an author field |
| Note with no matching highlight | Exported as a standalone entry, never dropped |
| Bookmark with no text | Rendered as "Bookmark at Page X" |
| Title with special characters (`:`, `"`, `¿`) | Filename sanitized correctly |
| File in Spanish (Kindle set to ES) | Dates and annotation types parsed correctly |
| File with a BOM (`﻿`) | Stripped before processing |
| Run with no `My Clippings.txt` present | Clear error message, controlled exit |

**5. Destination validation.** The final test was always importing the output into Notion and confirming the format survives: bullets render as a list, blockquotes render as blockquotes, `---` separators work as visual dividers.

### Why I didn't automate tests (on the CLI)

Adding unit tests would have meant building `My Clippings.txt` fixtures for known cases. Feasible, but not justified extra work for a personal tool with a single contributor. Regression risk was managed with cross-version manual comparison and the script's built-in automatic backup, which acts as a safety net for any unexpected failure. If the project ever scaled to multiple contributors, or Amazon's format changed often, automated tests would be the natural next step.

### Why that criterion changed in the web version

The web version has had automated tests since its first line of code (`web/parser.test.js` + `web/strings.test.js`, using `node:test`/`node:assert` — built into Node, no external dependency — currently **59 tests**, all against real behavior, no mocks). That's not a contradiction of the reasoning above, it's the same QA criterion applied to a different context:

- **"Single contributor" stopped being literal.** Web development happens in rounds with multiple subagents working task-by-task on the same code (`parser.js`, `app.js`, `strings.js`). Without a suite that runs in seconds after every change, each subagent would have to manually re-verify everything that already worked — exactly the kind of silent regression a test catches for free.
- **The change surface is bigger and more interlinked.** Each round touches several functions that call each other (`parseEntries` → `pairNotes` → `detectBookLang` → `exportBooks`). Line-by-line manual comparison — the method used for v1.1d→v1.1e — stops being practical with 8-9 small, interdependent commits in one work session.
- **The cost of automating dropped.** `node:test` ships with Node, no install needed, and no browser has to spin up — the parsing functions are pure (text in, objects out, no DOM), so testing them is as simple as it would be in Python. The original reason not to automate (unjustified effort) no longer applies.

The underlying criterion never changed: **automate when the cost of not doing it outweighs the cost of doing it.** For a single-contributor personal CLI, it didn't. For a web app iterating through a multi-agent, per-task review flow, it does.

---

## 🎯 Design decisions

**No external dependencies (CLI).** Could have used something like `click` for the CLI or `pytest` for tests. Chose not to, so anyone can clone the repo and run it immediately with no extra setup steps.

**Backup before processing, not after (CLI only).** The backup happens at the start of the run, before the script touches anything. If the script fails halfway through, the backup is already done. Order matters here.

**The web version doesn't back up `My Clippings.txt` — and that's intentional, not an oversight.** The CLI's backup exists because the script **overwrites** the output `.md` files on every run: if parsing failed, the previous output was gone with no source file at hand to reprocess. The web version never writes anything to your disk except what you explicitly download — it reads the `.txt` in browser memory, processes it, and the original stays exactly where it was. There's nothing the web app can overwrite, so there's nothing to back up. The one real risk left is closing the tab before downloading the result (not the original) — a UX risk, not a data-loss one.

**`---` separators in the output.** Notion handles some Markdown elements inconsistently. Horizontal separators are one of the few elements that render reliably on import. The choice wasn't aesthetic, it was functional.

**Configurable multi-language support, not automatic (CLI).** Automatic per-book language detection was evaluated and rejected in the `.py` because it produced false positives on titles mixing multiple languages. The explicit-configuration approach (`PER_BOOK_LANG`) is less "magic" but more predictable and less prone to silent errors. The web version *does* implement automatic detection, by majority vote across a book's entries (`detectBookLang`), with an explicit warning when no entry has a recognizable language — the difference is the failure is now visible instead of silent.

**One source of truth for parsing, not two hand-synced ones.** Porting the logic to JavaScript could have meant maintaining `.py` and `.js` fixing the same bugs in parallel. Deliberately rejected: manual sync between two languages is a mechanism for silent divergence — exactly the kind of failure this project exists to prevent in its output. Chose to freeze the CLI instead of duplicating effort (see Phase 5).

---

## 📁 Repository structure

```
ClipHarborKindle/
├── cli/
│   ├── parse_kindle_notion_v1_1e.py       # Main script (frozen, see Phase 5)
│   └── parse_kindle_notion_v1_2_1_fix.py  # Cancelled experiment (v1.2)
├── web/                                   # Web exporter — source of truth for parsing
│   ├── index.html
│   ├── parser.js                          # Parsing logic (ported from cli/parse_kindle_notion_v1_1e.py + its own fixes)
│   ├── parser.test.js                     # Test suite (node:test) — see "How I tested this"
│   ├── app.js                             # UI: drag&drop, result rendering, downloads, lazy JSZip load
│   ├── strings.js                         # ES/EN interface copy
│   ├── strings.test.js
│   ├── style.css
│   └── vendor/jszip.min.js                # Only dependency, vendored + SRI-pinned (zip download only)
├── docs/
│   ├── screenshots/                       # Images used in this README
│   ├── audit-clipharbor4kindle-*.md       # Full multi-discipline audit report
│   └── superpowers/                       # Specs and plans per web development round
├── README.md / README.es.md
├── CLAUDE.md                              # Technical memory: bugs, decisions, parsing governance
├── LICENSE
├── Books/                                 # Output: one .md per book
├── backups/                               # Timestamped My Clippings.txt copies (CLI only)
└── .gitignore
```

The CLI runs from the repo root (e.g. `python3 cli/parse_kindle_notion_v1_1e.py`), so relative paths (`Books/`, `backups/`, `logs/`) resolve correctly. The web version needs no install: served as a static site (GitHub Pages) or opened directly at `web/index.html`.

`parse_kindle_notion_v1_1e.py` is frozen: parsing logic is no longer iterated on here, only in `web/parser.js` (see Phase 5 and `CLAUDE.md`).

---

## 🕓 Version history

| Version | Status | Highlights |
|---|---|---|
| v1.1d (CLI) | Stable (retired) | Full parsing, note–highlight pairing, multi-language, Notion-friendly output |
| v1.1e (CLI) | **Frozen** (see Phase 5) | Automatic backup before every run, execution log with full traceability |
| v1.2 (CLI) | Cancelled | Highlight deduplication — unacceptable false negatives, risk of silently losing annotations |
| Web — MVP | Stable | Same parsing engine ported to JS, runs 100% in browser, `.zip` download, ES/EN interface switcher |
| Web — fixes + per-book download + a11y | Stable | Filename-collision fix, nested-parentheses title/author regex fix, unrecognized-language warning, per-book download, baseline accessibility, first automated test suite |
| v1.4 — Security/a11y/performance hardening | **Current** | `frame-ancestors` CSP, real `<h1>`, 44px touch targets, SRI-pinned + lazy-loaded JSZip, `Referrer-Policy`, responsive header |

Full detail per release: [GitHub Releases](https://github.com/melinDross/ClipHarborKindle/releases).

---

## 🚫 Ideas evaluated and not pursued

Kept here because *deciding not to build something* is as much a product decision as building it:

- **Highlight deduplication (v1.2)** — built, tested, and explicitly cancelled: comparing against previous run state introduced false negatives that could silently drop real highlights (see Phase 4). Won't reintroduce it until there's a comparison strategy that guarantees zero false negatives — output reliability outranks convenience here.
- **Automatic language detection in the CLI** — evaluated and rejected; produced false positives on titles mixing languages. Kept as explicit per-book configuration instead (the web version's automatic detection uses a different, majority-vote approach with a visible fallback warning, so this isn't a blanket rejection of the idea, just of that specific implementation).
- **Syncing bug fixes across both `.py` and `.js` implementations** — evaluated and rejected as a maintenance model; chose to freeze the CLI and declare `parser.js` the single source of truth instead (see Phase 5).

---

## ⚙️ Running it locally

**Web version** — no install, no build:

```bash
git clone https://github.com/melinDross/ClipHarborKindle.git
cd ClipHarborKindle
open web/index.html   # or serve web/ with any static file server
```

To run the test suite:

```bash
node --test web/*.test.js   # 59 tests, node:test built into Node — no install needed
```

**CLI version** (Python 3.9+, no dependencies to install):

```bash
git clone https://github.com/melinDross/ClipHarborKindle.git
cd ClipHarborKindle
# place your Kindle's My Clippings.txt in the repo root, then:
python3 cli/parse_kindle_notion_v1_1e.py
```

Run from the repo root so the relative `Books/`, `backups/`, and `logs/` paths resolve correctly. Output lands in `Books/` (one `.md` per book), a timestamped backup of the source file lands in `backups/`, and the run is logged to `logs/last_run.txt`.

### Deploying your own copy of the web version

It's a static site with no backend and no environment variables — fork the repo and either enable GitHub Pages on your fork (the existing `.github/workflows/deploy-pages.yml` auto-deploys `web/` on every push to `main`), or serve the `web/` folder from any static host.

---

## 📜 License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to view, run, modify, and share for any non-commercial purpose (learning, personal projects, forks). Selling this project or using it commercially isn't permitted under this license.

---

## 🔗 Repository

[github.com/melinDross/ClipHarborKindle](https://github.com/melinDross/ClipHarborKindle)

---

Found a bug, have an idea, or just want to say hi? [Open an issue](https://github.com/melinDross/ClipHarborKindle/issues) — I read every one. If you liked the project and want to support keeping it maintained, [Ko-fi](https://ko-fi.com/melindross) is very appreciated. ☕
