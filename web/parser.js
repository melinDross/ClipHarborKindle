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
