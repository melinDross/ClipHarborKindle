# Ko-fi Donation Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Ko-fi donation badge/link to the web exporter's header, vendored locally and pointing at a clearly-marked placeholder URL until a real Ko-fi account exists.

**Architecture:** Static markup change only — no app logic. The header's right-hand side gains a wrapper `<div class="header-actions">` containing the new Ko-fi `<a>`/`<img>` and the existing `.lang-switch` div. The badge image is vendored into `web/vendor/` exactly like JSZip already is, instead of being loaded from `storage.ko-fi.com`/`ko-fi.com` at runtime.

**Tech Stack:** Plain HTML/CSS (no build step, no new JS).

## Global Constraints

- No new dependencies, no build step, no backend — this is a static markup/CSS-only change.
- The Ko-fi badge image must be vendored locally under `web/vendor/`, not loaded from a remote URL at runtime (same rule already applied to JSZip).
- The donation link's `href` is a placeholder for now (no real Ko-fi account exists yet) — it must be visually unmistakable as a placeholder in the source (`TU_USUARIO_AQUI` plus an HTML comment) so it's easy to find and swap later.
- `alt`/accessible text on the badge stays in English, fixed, not wired through `web/strings.js` — the badge image itself has English text baked in.
- `target="_blank" rel="noopener noreferrer"` on the donation link (external link security best practice).
- No automated test for this change (static markup/CSS, no logic) — verify manually in a browser per Task 2.

---

### Task 1: Vendor the Ko-fi badge image

**Files:**
- Create: `web/vendor/kofi-badge.svg`

**Interfaces:**
- Produces: a local SVG file at `web/vendor/kofi-badge.svg` that Task 2's `<img>` tag references via `src="vendor/kofi-badge.svg"`.

This is Ko-fi's own officially-documented small embeddable button asset (the same one Ko-fi's own "add a button to GitHub" instructions point at), so no design work is needed here — just download and verify it.

- [ ] **Step 1: Download the asset**

```bash
curl -fsL https://ko-fi.com/img/githubbutton_sm.svg -o web/vendor/kofi-badge.svg
```

- [ ] **Step 2: Verify it downloaded correctly as an SVG**

```bash
file web/vendor/kofi-badge.svg
head -c 200 web/vendor/kofi-badge.svg
```

Expected: `file` reports it as `SVG Scalable Vector Graphics image` (or similar XML/SVG description), and the first ~200 bytes start with `<?xml` or `<svg`. If `curl` instead saved an HTML error page (e.g. starts with `<!DOCTYPE html>`), the download failed — stop and report this as a blocker rather than committing a broken asset.

- [ ] **Step 3: Confirm the file is non-trivial in size**

```bash
wc -c web/vendor/kofi-badge.svg
```

Expected: a few thousand bytes or more (Ko-fi's badge SVG is on the order of 15-16 KB at time of writing). A file of a few dozen bytes would indicate a truncated or failed download.

- [ ] **Step 4: Commit**

```bash
git add web/vendor/kofi-badge.svg
git commit -m "Vendor the Ko-fi badge SVG asset locally"
```

---

### Task 2: Add the Ko-fi link to the header and verify in browser

**Files:**
- Modify: `web/index.html`
- Modify: `web/style.css`

**Interfaces:**
- Consumes: `web/vendor/kofi-badge.svg` from Task 1.

- [ ] **Step 1: Restructure the header markup**

In `web/index.html`, replace the current `<header class="nav">` block:

```html
  <header class="nav">
    <span>📚 Kindle → Notion Exporter</span>
    <div class="lang-switch">
      <button id="lang-es" class="lang-button" type="button">🇪🇸 ES</button>
      <button id="lang-en" class="lang-button" type="button">🇬🇧 EN</button>
    </div>
  </header>
```

with:

```html
  <header class="nav">
    <span>📚 Kindle → Notion Exporter</span>
    <div class="header-actions">
      <!-- TODO: replace TU_USUARIO_AQUI with the real Ko-fi username once the account exists -->
      <a id="kofi-link" class="kofi-link" href="https://ko-fi.com/TU_USUARIO_AQUI" target="_blank" rel="noopener noreferrer">
        <img src="vendor/kofi-badge.svg" alt="Buy Me a Coffee at ko-fi.com" class="kofi-badge">
      </a>
      <div class="lang-switch">
        <button id="lang-es" class="lang-button" type="button">🇪🇸 ES</button>
        <button id="lang-en" class="lang-button" type="button">🇬🇧 EN</button>
      </div>
    </div>
  </header>
```

Note: the alt text is `"Buy Me a Coffee at ko-fi.com"` (the real caption baked into this specific Ko-fi asset), not the generic `"Support me on Ko-fi"` mentioned in the original design spec — use this exact string since it matches what the vendored image actually says.

- [ ] **Step 2: Add the new CSS rules**

In `web/style.css`, after the existing `.lang-switch` rule (after the block ending `gap: 4px; }`), add:

```css
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kofi-badge {
  height: 28px;
  width: auto;
  display: block;
}
```

- [ ] **Step 3: Serve the site locally and verify visually**

```bash
python3 -m http.server 8000 --directory web
```

Open `http://localhost:8000/` in a browser (or use the Playwright MCP tools: `browser_navigate` to `http://localhost:8000/`, then `browser_snapshot`). Confirm:
- The header still fits on one line: title on the left, Ko-fi badge + ES/EN buttons grouped on the right.
- The Ko-fi badge renders at a height that looks proportionate to the language buttons next to it (not oversized).
- Clicking the badge opens `https://ko-fi.com/TU_USUARIO_AQUI` in a new tab (expected to 404 or show a "user not found" page on Ko-fi's side, since this is a placeholder — that 404 is expected and fine, it confirms the link itself works).
- Toggling the ES/EN language buttons still works exactly as before (the Ko-fi addition must not have broken the existing language-switch behavior).

Stop the server afterward:

```bash
pkill -f "http.server 8000"
```

- [ ] **Step 4: Commit**

```bash
git add web/index.html web/style.css
git commit -m "Add Ko-fi donation badge to the header (placeholder URL)"
```
