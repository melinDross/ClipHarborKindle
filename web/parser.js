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
