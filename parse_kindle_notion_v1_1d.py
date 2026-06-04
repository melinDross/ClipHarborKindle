#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_kindle_notion_v1_1d.py

Changes vs v1.1c:
- Header "Processed" shows date+time (YYYY-MM-DD HH:MM)
- Header adds "📂 Source: <My Clippings filename>"
"""

import re, sys
from datetime import datetime
from pathlib import Path

# =================== CONFIG ===================
INPUT_DIR = Path('.')
OUTPUT_DIR = Path('Books')
LOG_DIR = Path('logs')

META_STYLE = "blockquote"  # "blockquote" | "inline_code" | "plain"
COMPACT_DATE = True
DATE_FMT_COMPACT = "%Y-%m-%d %H:%M"

EMOJIS = { 'Highlight': '🟦', 'Note': '🟧', 'Bookmark': '🟩' }
EMOJI_IN_META = True

OUTPUT_LANG_DEFAULT = 'en'   # 'en' or 'es'
AUTO_DETECT_PER_BOOK = False
PER_BOOK_LANG = {}

ENTRY_SEPARATOR = "---"   # set "" to disable
# =============================================

OUTPUT_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

EN_MONTHS = {'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,'July':7,'August':8,'September':9,'October':10,'November':11,'December':12}
ES_MONTHS = {'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12}
DASH = r'[\\-–—]'

def find_latest_clippings():
    files = sorted(INPUT_DIR.glob('My Clippings_*.txt'), key=lambda p: p.stat().st_mtime, reverse=True)
    if files: return files[0]
    default = INPUT_DIR / 'My Clippings.txt'
    if default.exists(): return default
    print("❌ No 'My Clippings.txt' nor 'My Clippings_YYYYMMDD.txt' found.", file=sys.stderr); sys.exit(1)

def safe_name(name):
    name = re.sub(r'[^\w\s\-]', '', name).strip()
    return re.sub(r'\s+', '_', name)

def parse_pos(meta):
    m = re.search(r'(Location|Ubicaci[oó]n|Loc\.?|posici[oó]n|Pos)\s+(\d+)(?:\s*' + DASH + r'\s*(\d+))?', meta, re.I)
    if not m: return ("", None, None)
    start = int(m.group(2)); end = int(m.group(3)) if m.group(3) else start
    label = f"Pos {start}" if start == end else f"Pos {start}-{end}"
    return (label, start, end)

def parse_page(meta):
    m = re.search(r'(Page|P[aá]gina|Pag\.?)\s+(\d+)', meta, re.I)
    if not m: return (None, None)
    return (int(m.group(2)), m.group(1).lower().startswith('p'))

def extract_kind(meta):
    if re.search(r'\b(la|el)\s+nota\b', meta, re.I) or re.search(r'\btu\s+nota\b', meta, re.I): return 'Note'
    if re.search(r'\b(subrayado|resaltado)\b', meta, re.I): return 'Highlight'
    if re.search(r'\bmarcador\b', meta, re.I): return 'Bookmark'
    if re.search(r'Your Note', meta, re.I): return 'Note'
    if re.search(r'\bHighlight\b', meta, re.I): return 'Highlight'
    if re.search(r'\bBookmark\b', meta, re.I): return 'Bookmark'
    return 'Highlight'

def parse_added_compact(meta):
    m = re.search(r'(Added on|Añadido el)\s+(.*)$', meta, re.I)
    txt = m.group(2).strip() if m else meta.strip()
    # EN: Thursday, June 13, 2024 22:43:46  or with AM/PM
    me = re.match(r'^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$', txt)
    if me:
        mon_name, day, year, hh, mm, ss, ampm = me.groups()
        mon = EN_MONTHS.get(mon_name, None)
        if mon:
            h = int(hh)
            if ampm:
                ampm = ampm.upper()
                if ampm == 'PM' and h != 12: h += 12
                if ampm == 'AM' and h == 12: h = 0
            dt = datetime(int(year), mon, int(day), h, int(mm), int(ss))
            return dt.strftime(DATE_FMT_COMPACT)
    # ES: jueves, 13 de junio de 2024 22:43:46
    ms = re.match(r'^[A-Za-zÁÉÍÓÚÑáéíóúñ]+,\s+(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$', txt)
    if ms:
        day, mon_name, year, hh, mm, ss = ms.groups()
        mon = ES_MONTHS.get(mon_name.lower(), None)
        if mon:
            dt = datetime(int(year), mon, int(day), int(hh), int(mm), int(ss))
            return dt.strftime(DATE_FMT_COMPACT)
    mc = re.match(r'^\d{4}\-\d{2}\-\d{2}\s+\d{2}:\d{2}$', txt)
    if mc: return txt
    return txt

def parse_entries(text):
    books = {}
    for block in text.split("=========="):
        lines = [l.strip('\ufeff').strip() for l in block.strip().splitlines() if l.strip()]
        if len(lines) < 2: continue
        title_line, meta_line = lines[:2]
        content = '\n'.join(lines[2:]).strip()
        m = re.match(r'^(?P<title>.+?)\s*\((?P<author>.+?)\)\s*$', title_line)
        title, author = (m.group('title').strip(), m.group('author').strip()) if m else (title_line.strip(), '')
        kind = extract_kind(meta_line)
        pos_label, pos_start, pos_end = parse_pos(meta_line)
        page_num, _ = parse_page(meta_line)
        added = parse_added_compact(meta_line) if COMPACT_DATE else (re.search(r'(Added on|Añadido el)\s+(.*)$', meta_line, re.I).group(2).strip() if re.search(r'(Added on|Añadido el)\s+(.*)$', meta_line, re.I) else meta_line.strip())
        entry = {'kind': kind,'pos_label': pos_label,'pos_start': pos_start,'pos_end': pos_end,'page_num': page_num,'added': added,'text': content,'meta_raw': meta_line}
        books.setdefault((title, author), []).append(entry)
    return books

def ranges_overlap(a_start, a_end, b_start, b_end):
    if None in (a_start, a_end, b_start, b_end): return False
    return not (a_end < b_start or b_end < a_start)

def pair_notes(items):
    out = []
    for it in items:
        if it['kind'] == 'Highlight':
            it['note_text'] = ''
            out.append(it)
        elif it['kind'] == 'Note':
            attached = False
            for j in range(len(out)-1, -1, -1):
                h = out[j]
                if h['kind'] != 'Highlight': continue
                if ranges_overlap(it['pos_start'], it['pos_end'], h['pos_start'], h['pos_end']) or (
                    it['page_num'] is not None and h['page_num'] is not None and it['page_num'] == h['page_num']
                ):
                    h['note_text'] = (h.get('note_text') or '')
                    h['note_text'] += ('' if h['note_text']=='' else ' ') + it['text'].strip()
                    h['meta_override_kind'] = 'Note'
                    attached = True
                    break
            if not attached:
                it['note_text'] = it['text'].strip(); it['text'] = ''
                out.append(it)
        else:
            it['note_text'] = ''
            out.append(it)
    return out

def detect_lang_for_book(title, items):
    for key, lang in PER_BOOK_LANG.items():
        if key in title: return lang
    return OUTPUT_LANG_DEFAULT

def style_note(note, lang):
    label = "Note 👉🏼" if lang == 'en' else "Nota 👉🏼"
    return f"**{label}:** _{note}_"

def render_meta(parts, meta_kind):
    meta = f"_{' | '.join(parts)}_"
    prefix = f"{EMOJIS.get(meta_kind, '')} "
    if META_STYLE == "blockquote": return f"> {prefix}{meta}"
    elif META_STYLE == "inline_code": return f"{prefix}`{meta}`"
    else: return f"{prefix}{meta}"

def render_book_md(title, author, items, source_filename):
    lang = detect_lang_for_book(title, items)
    kind_map = {
        'en': {'Highlight':'Highlight','Note':'Note','Bookmark':'Bookmark', 'Page':'Page', 'Highlights':'Highlights','Notes':'Notes','Bookmarks':'Bookmarks','Author':'Author','Processed':'Processed','Source':'Source'},
        'es': {'Highlight':'Subrayado','Note':'Nota','Bookmark':'Marcador', 'Page':'Página', 'Highlights':'Subrayados','Notes':'Notas','Bookmarks':'Marcadores','Author':'Autor','Processed':'Procesado','Source':'Origen'}
    }[lang]

    n_high = sum(1 for it in items if it['kind']=='Highlight')
    n_note = sum(1 for it in items if (it.get('meta_override_kind')=='Note' or it['kind']=='Note'))
    n_book = sum(1 for it in items if it['kind']=='Bookmark')
    processed_dt = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [f"# {title}"]
    if author: lines.append(f"🖋️ {kind_map['Author']}: {author}")
    lines.append(f"🔖 {kind_map['Highlights']}: {n_high} | {kind_map['Notes']}: {n_note} | {kind_map['Bookmarks']}: {n_book}")
    lines.append(f"📌 {kind_map['Processed']}: {processed_dt}")
    lines.append(f"📂 {kind_map['Source']}: {source_filename}")
    lines.append(""); lines.append("---"); lines.append("")

    first = True
    for it in items:
        if not first: lines.append("")
        first = False

        text, note = (it.get('text') or '').strip(), (it.get('note_text') or '').strip()
        main = text or ""
        if it['kind'] == 'Bookmark' and not main:
            if it.get('page_num') is not None:
                main = f"Bookmark at Page {it['page_num']}"
            elif it.get('pos_label'):
                main = f"Bookmark at {it['pos_label']}"
            else:
                main = "(Bookmark)"
        if note: main += f" — {style_note(note, lang)}"
        lines.append(f"- {main}")

        meta_kind = 'Note' if note else it.get('kind','Highlight')
        parts = [kind_map.get(meta_kind, meta_kind)]
        if it.get('page_num') is not None: parts.append(f"{kind_map['Page']} {it['page_num']}")
        if it.get('pos_label'): parts.append(it['pos_label'])
        if it.get('added'): parts.append(it['added'])
        lines.append(render_meta(parts, meta_kind))

        if ENTRY_SEPARATOR:
            lines.append(""); lines.append(ENTRY_SEPARATOR); lines.append("")

    return "\n".join(lines)

def main():
    file = find_latest_clippings()
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    books = parse_entries(content)
    updated_files = []
    total_books = total_high = total_notes = total_bookm = 0

    for (title, author), items in books.items():
        paired = pair_notes(items)
        paired.sort(key=lambda it: (it.get('pos_start') if it.get('pos_start') is not None else 10**12,
                                    it.get('page_num') if it.get('page_num') is not None else 10**12,
                                    it.get('added') or ""))
        md_text = render_book_md(title, author, paired, source_filename=file.name)
        out_path = OUTPUT_DIR / f"{safe_name(title)}.md"
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(md_text)
        total_books += 1
        total_high += sum(1 for it in paired if it['kind']=='Highlight')
        total_notes += sum(1 for it in paired if (it.get('meta_override_kind')=='Note' or it['kind']=='Note'))
        total_bookm += sum(1 for it in paired if it['kind']=='Bookmark')
        updated_files.append(out_path.name)

    LOG_DIR.mkdir(exist_ok=True)
    with open(LOG_DIR/'last_run.txt', 'a', encoding='utf-8') as lf:
        lf.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} • Books:{total_books} • Highlights:{total_high} • Notes:{total_notes} • Bookmarks:{total_bookm} • Updated:{', '.join(updated_files)} | Source:{file.name}\n")

    print(f"📚 Parsed {total_books} book(s) • {total_high} highlights • {total_notes} notes • {total_bookm} bookmarks")
    print(f"📂 Source: {file.name}")
    if updated_files: print('✅ Updated:', ' | '.join(updated_files))

if __name__ == '__main__':
    main()
