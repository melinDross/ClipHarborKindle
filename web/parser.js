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

/** Ports ranges_overlap() from cli/parse_kindle_notion_v1_1e.py. */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return !(aEnd < bStart || bEnd < aStart);
}

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
