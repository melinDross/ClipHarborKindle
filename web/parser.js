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
