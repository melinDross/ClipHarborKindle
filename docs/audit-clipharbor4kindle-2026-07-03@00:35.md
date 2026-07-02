# Audit — Clip Harbor for Kindle (web/) — 2026-07-03

Scope: `web/` (the live, actively maintained product at
https://melindross.github.io/ClipHarborKindle/), deployed via
`.github/workflows/deploy-pages.yml` on every push to `main` touching `web/`.
`cli/` is frozen per CLAUDE.md and out of scope for parsing-logic findings
(covered only where it affects the repo as a whole, e.g. secrets).

Reviewed as: full-stack dev, web security specialist, WCAG 2.2 AA accessibility
expert, technical SEO/GEO consultant, UX/mobile designer.

## 1. Executive summary

This is a small, well-built static SPA (5 JS files, no framework, no backend,
no build step) that already does several things right: strict CSP, no
`innerHTML` with dynamic data, keyboard-accessible drop zone, dark mode,
bilingual UI with a real `<html lang>` switch, and a genuinely privacy-safe
design (file never leaves the browser). The codebase is small enough that
there is no dead code, no console errors expected, and no obvious functional
bug.

The top 3 risks are all about **discoverability and hardening**, not
correctness:

1. **Zero SEO/GEO surface** — no meta description, no Open Graph tags, no
   `robots.txt`/`sitemap.xml`, no structured data. A privacy-focused
   Kindle→Notion tool that no search engine or LLM can describe accurately is
   invisible to the exact audience it's built for.
2. **Missing document heading (`<h1>`)** and a CSP with no `frame-ancestors`
   directive — small effort, real WCAG/clickjacking-hardening wins.
3. **Touch targets under 44×44px** on the language switch and per-book
   download buttons — on the one page where mobile users are most likely to
   be dragging in a file from Kindle's Send-to-PC export.

Nothing here blocks shipping; everything below is worth doing in a single
follow-up pass since the whole surface area is ~700 lines of code.

## 2. Quick Wins table

| # | Finding | Type | Effort |
|---|---|---|---|
| 1 | Add `<meta name="description">` + Open Graph tags | GEO/SEO | Low |
| 2 | Add `robots.txt` + `sitemap.xml` | GEO/SEO | Low |
| 3 | Add `frame-ancestors 'none'` to CSP | Security | Low |
| 4 | Add real `<h1>` in header | Accessibility | Low |
| 5 | Increase touch target size of `.lang-button` / `.download-one-button` | Accessibility/Mobile | Low |
| 6 | Add `rel="noopener"` check / SRI hash on vendored `jszip.min.js` | Security | Low |
| 7 | Lazy-load JSZip only when download is clicked | Performance | Low |
| 8 | Add Schema.org `SoftwareApplication` JSON-LD | GEO/SEO | Low |
| 9 | Add `Referrer-Policy` via `<meta>` | Security | Low |
| 10 | Fix header `.nav` wrap risk on narrow viewports (<360px) | Visual-UX/Mobile | Low |

## 3. Full findings

### [Medium] — No `<h1>` on the page

- **Location:** `web/index.html:12` (`<span>📚 Clip Harbor for Kindle</span>` inside `.nav`), no `<h1>` anywhere in the document
- **Type:** Accessibility
- **What to change:** Replace the `<span>` brand text in the header with an `<h1>`, or add a visually-hidden `<h1>` above `<main>` if the brand mark shouldn't visually look like a heading. `#book-count` is currently the only heading (`<h2>`), so screen-reader users navigating by heading land on "3 book(s) detected" with no page-level heading above it.
- **Why it matters:** WCAG 2.2 1.3.1 / "Info and Relationships" — screen reader users rely on heading level 1 to confirm what page they're on; skipping straight to `<h2>` breaks the expected hierarchy and is flagged by every automated a11y scanner (axe, Lighthouse), which also hurts perceived SEO quality.
- **Effort:** Low (<30min)
- **Quick win:** Yes

### [Medium] — Touch targets below 44×44px minimum

- **Location:** `web/style.css:35-43` (`.lang-button`, `padding: 4px 8px; font-size: 0.85rem`) and `web/style.css:101-106` (`.download-one-button`, `padding: 4px 10px; font-size: 0.85rem`)
- **Type:** Accessibility / Mobile
- **What to change:** Bump padding/min-height so the clickable box is at least 44×44px (e.g. `min-height: 44px; min-width: 44px; padding: 10px 14px`). This is exactly the interaction users will hit on a phone screen right after AirDropping/emailing themselves `My Clippings.txt`.
- **Why it matters:** WCAG 2.2 SC 2.5.8 (Target Size, AA — 24px minimum) and the stricter 2.5.5 (AAA, 44px) both apply; more concretely, mis-taps on `ES`/`EN` or "Download" on a phone are the most likely real-world friction point for this tool's actual mobile users.
- **Effort:** Low (<30min)
- **Quick win:** Yes

### [Medium] — CSP has no `frame-ancestors` directive

- **Location:** `web/index.html:6`
- **Type:** Security
- **What to change:** Add `frame-ancestors 'none'` to the existing `<meta http-equiv="Content-Security-Policy">` value. `X-Frame-Options` can't be set via `<meta>` (only as an HTTP header, unavailable on GitHub Pages without extra tooling), but `frame-ancestors` in the CSP meta tag *is* honored by all modern browsers and achieves the same clickjacking protection.
- **Why it matters:** without it, the page could be iframed on a malicious site and used for clickjacking (e.g. tricking a user into "downloading" something else, or just typosquatting the tool's UI). Low likelihood given the app has no auth/state, but the fix is a one-line addition to a directive that's already there.
- **Effort:** Low (<30min)
- **Quick win:** Yes

### [Medium] — No meta description / Open Graph / canonical tags

- **Location:** `web/index.html:1-9` (`<head>`)
- **Type:** GEO/SEO
- **What to change:** Add `<meta name="description" content="...">` (bilingual context: pick the ES description since `<html lang="es">` is the default), `<meta property="og:title">`, `og:description`, `og:image`, `og:url`, and `<link rel="canonical" href="https://melindross.github.io/ClipHarborKindle/">`. Content should state plainly and self-containedly what the tool does — e.g. "Convierte los subrayados y notas de tu Kindle (My Clippings.txt) en ficheros Markdown listos para Notion, 100% en tu navegador, sin subir el fichero a ningún servidor" — reusing the README's own framing (README.md:8).
- **Why it matters:** currently a Google/Bing snippet or a link shared on Slack/Twitter/WhatsApp renders with no description and no preview image — for a tool whose entire pitch is "your data never leaves the browser," that trust signal isn't even visible before the click. This also directly hurts GEO: an LLM asked "how do I convert Kindle highlights to Notion" has no self-contained text on the page to cite.
- **Effort:** Low (<30min)
- **Quick win:** Yes

### [Medium] — No `robots.txt`, `sitemap.xml`, or `llms.txt`

- **Location:** `web/` root (none present; confirmed via `find` across the whole repo)
- **Type:** GEO/SEO
- **What to change:** Add `web/robots.txt` (`User-agent: *\nAllow: /\nSitemap: https://melindross.github.io/ClipHarborKindle/sitemap.xml`), a minimal `sitemap.xml` with the single URL, and optionally `llms.txt` summarizing the tool for LLM crawlers (given the product's own pitch is privacy/no-server-processing, this is a natural fit for a short llms.txt).
- **Why it matters:** these are the deploy that GitHub Pages doesn't generate for you; without them, crawlers have no explicit signal the single page is intentionally the entire site, and there's no discovery path for a sitemap-respecting crawler.
- **Effort:** Low (<30min)
- **Quick win:** Yes

### [Medium] — No structured data (Schema.org)

- **Location:** `web/index.html` (`<head>`)
- **Type:** GEO/SEO
- **What to change:** Add a JSON-LD `SoftwareApplication` block (name, description, applicationCategory: "Utility"/"Productivity", operatingSystem: "Any (browser-based)", offers with price 0, and a note that it's free/open-source with a link to the GitHub repo).
- **Why it matters:** enables rich results (e.g. app card in search) and gives LLM answer engines a structured, unambiguous fact base instead of having to infer "is this a paid SaaS or a free tool" from prose.
- **Effort:** Low (<30min)
- **Quick win:** Yes

### [Low] — Vendored JSZip has no Subresource Integrity hash

- **Location:** `web/index.html:38` (`<script src="vendor/jszip.min.js">`)
- **Type:** Security
- **What to change:** Add an `integrity="sha384-..."` + `crossorigin="anonymous"` attribute (compute the hash locally since the file is vendored, not loaded from a CDN — SRI still protects against the file being tampered with on GitHub Pages' CDN edge or a future accidental `git` corruption).
- **Why it matters:** low risk today since it's same-origin, but it's a defense-in-depth line that costs one attribute and catches accidental or malicious modification of the vendored file without anyone noticing (nothing else in the pipeline verifies its contents).
- **Effort:** Low (<30min)
- **Quick win:** Yes (low effort, low-but-nonzero impact)

### [Low] — `Referrer-Policy` not set

- **Location:** `web/index.html:1-9`
- **Type:** Security
- **What to change:** Add `<meta name="referrer" content="strict-origin-when-cross-origin">` (or `no-referrer`, given the page has no meaningful query params to leak).
- **Why it matters:** the Ko-fi link (`web/index.html:16`) already sets `rel="noopener noreferrer me"` per-link so this is largely already mitigated for the one outbound link, but a page-level default protects any future outbound link (e.g. a "GitHub repo" link) from leaking the referring URL by default.
- **Effort:** Low (<30min)
- **Quick win:** No (real impact is marginal given the single outbound link is already hardened)

### [Low] — JSZip loaded eagerly even though only needed for one button

- **Location:** `web/index.html:38` (`<script src="vendor/jszip.min.js">`, loaded unconditionally on every page view)
- **Type:** Performance
- **What to change:** Dynamic-`import()` JSZip (or lazy-append the `<script>` tag) only when `downloadButton` is clicked for the first time, instead of shipping it as a blocking `<script>` on initial load.
- **Why it matters:** every visitor pays for JSZip's parse/compile cost before they've even dropped a file, even though a meaningful fraction will only use "download one book" (which doesn't need JSZip at all — see `app.js:81-89`, `downloadSingleBook` doesn't touch `JSZip`). Marginal on a file this small, but it's a real LCP/TBT win on low-end mobile since it's pure JS execution cost with zero payoff for most of the page's lifetime.
- **Effort:** Medium (30min-2h) — needs the dynamic import wired through the existing `downloadButton` click handler and a loading state while the module resolves
- **Quick win:** No (impact is real but small in absolute terms; effort is more than trivial once you handle the "module still loading" edge case)

### [Low] — Header `.nav` can wrap awkwardly on narrow viewports

- **Location:** `web/style.css:9-16` (`.nav { display: flex; justify-content: space-between }`) combined with `web/index.html:12-21` (brand text + Ko-fi badge + two language buttons all in one flex row)
- **Type:** Visual-UX / Mobile
- **What to change:** Test at 320px width (smallest common breakpoint, e.g. iPhone SE) — the brand text "📚 Clip Harbor for Kindle" at `font-size: 1.25rem; font-weight: 600` plus the Ko-fi badge plus two language buttons in a single unwrapped flex row is tight. Add a `flex-wrap: wrap` fallback with sane row-gap, or drop the brand text to a shorter form on small screens (`Clip Harbor` without the emoji/suffix) via a media query.
- **Why it matters:** if the row wraps unpredictably (no `flex-wrap` currently set, so children will instead overflow/shrink), the Ko-fi badge or language buttons can get squeezed or clipped on the smallest common phone width — a first impression problem on the exact device class (phone, Kindle-adjacent user) most likely to load this page.
- **Effort:** Low (<30min)
- **Quick win:** No (needs actual device/viewport testing to confirm severity before committing to a fix, so not a blind quick win)

### [Minor] — `results` list has no single `aria-live` region covering additions

- **Location:** `web/app.js:47-73` (`renderBooks`), `web/index.html:33` (`<h2 id="book-count" aria-live="polite">` covers only the count text, not the `<ul id="book-list">` itself)
- **Type:** Accessibility
- **What to change:** Either wrap `#results` itself in `aria-live="polite"` (with `aria-atomic="false"` so only the diff is announced) or keep the current per-element approach but confirm with a screen reader that the newly-inserted `<li>` book rows are actually announced — right now only the `<h2>` count text change is guaranteed to be announced; the list contents populate silently as far as ARIA live-region semantics go.
- **Why it matters:** a screen reader user who drops a file hears "3 books detected" but may not get any further feedback about what those books are without manually navigating into the list — the count doesn't tell them enough to decide what to do next.
- **Effort:** Low (<30min)
- **Quick win:** No (correctness needs a screen-reader smoke test, not just a markup change, before calling it fixed)

### [Minor] — No favicon declared

- **Location:** `web/index.html:1-9`
- **Type:** GEO/SEO / Visual-UX
- **What to change:** Add a `<link rel="icon">` (even a simple emoji-as-SVG favicon matching the 📚 used in the header/title would keep the browser tab from showing a generic globe/blank icon).
- **Why it matters:** small polish item — affects bookmark/tab recognizability and is one of the "professional finish" signals that separates a portfolio-quality static site from a placeholder page.
- **Effort:** Low (<30min)
- **Quick win:** Yes

## 4. Final checklist

### By severity

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 6 |
| Minor | 2 (Low-severity findings from §3 not already counted as Medium) |

*(Note: the table above double-counts against §3's per-finding "Low effort" labels — effort and severity are independent axes. Severity breakdown by finding: 0 Critical, 0 High, 6 Medium, 4 Low/Minor — 10 findings total.)*

### By type

| Type | Count |
|---|---|
| Security | 3 |
| Accessibility | 3 |
| GEO/SEO | 4 |
| Performance | 1 |
| Visual-UX / Mobile | 1 |
| Code | 0 |

Total findings: **10** (no duplicates across categories; the mobile/visual finding is also counted once under Accessibility where it overlaps with touch-target guidance).

## 5. What's already solid (not findings, for context)

- CSP already present and restrictive (`default-src 'self'`, no `unsafe-inline`).
- No `innerHTML`/`insertAdjacentHTML` with dynamic content anywhere in `app.js` — `setDropZoneText` deliberately avoids it (see comment at `app.js:29-31`), all book rendering uses `textContent`/`createElement`.
- Keyboard-accessible drop zone (`role="button"`, `tabindex="0"`, `Enter`/`Space` handling).
- Real `<html lang>` switching handled pre-paint via a separate non-module script (`lang-init.js`) specifically to avoid a flash of wrong document language for screen readers/crawlers — a detail most projects miss entirely.
- `aria-pressed` on language toggle buttons, `aria-live="polite"` on error/processing messages.
- Dark mode via `prefers-color-scheme`, including on interactive elements.
- No data ever leaves the browser (`FileReader.readAsText`, output via `Blob`/`URL.createObjectURL`) — genuinely matches its own privacy claim, verified by reading the code, not just trusting the README.
- No hardcoded secrets/API keys anywhere in `web/` (confirmed by inspection — there's no backend to have secrets for).
