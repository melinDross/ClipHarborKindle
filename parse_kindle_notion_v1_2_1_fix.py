#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_kindle_notion_v1_2_1_fix.py

Hotfix for syntax error in v1.2.1 (bad inline f-string when building meta parts).
- Keeps the "append-only" dedupe behavior.
- Simplifies meta assembly to avoid quoting issues.
"""

import re, sys, shutil, hashlib
from datetime import datetime
from pathlib import Path

# =================== CONFIG ===================
INPUT_DIR = Path('.')
OUTPUT_DIR = Path('Books')
LOG_DIR = Path('logs')
BACKUP_DIR = Path('backups')

META_STYLE = "blockquote"  # "blockquote" | "inline_code" | "plain"
COMPACT_DATE = True
DATE_FMT_COMPACT = "%Y-%m-%d %H:%M"

OUTPUT_LANG_DEFAULT = 'en'
PER_BOOK_LANG = {}

EMOJIS = { 'Highlight': '🟦', 'Note': '🟧', 'Bookmark': '🟩' }
EMOJI_IN_META = True

ENTRY_SEPARATOR = "---"
# =============================================

for d in (OUTPUT_DIR, LOG_DIR, BACKUP_DIR):
    d.mkdir(exist_ok=True)

EN_MONTHS = {'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,'July':7,'August':8,'September':9,'October':10,'November':11,'December':12}
ES_MONTHS = {'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12}
DASH = r'[\\-–—]'

def sha1_hex(s: str) -> str:
    return hashlib.sha1(s.encode('utf-8')).hexdigest()

def find_latest_clippings():
    files = sorted(INPUT_DIR.glob('My Clippings_*.txt'), key=lambda p: p.stat().st_mtime, reverse=True)
    if files: return files[0]
    default = INPUT_DIR / 'My Clippings.txt'
    if default.exists(): return default
    print("❌ No 'My Clippings.txt' nor 'My Clippings_YYYYMMDD.txt' found.", file=sys.stderr); sys.exit(1)

def backup_clippings(path: Path) -> Path:
    ts = datetime.now().strftime('%Y%m%d_%H%M')
    out = BACKUP_DIR / f"{path.stem}_{ts}{path.suffix}"
    shutil.copy2(path, out)
    return out

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

def detect_lang_for_book(title):
    for key, lang in PER_BOOK_LANG.items():
        if key in title: return lang
    return OUTPUT_LANG_DEFAULT

def style_note(note, lang):
    label = "Note 👉🏼" if lang == 'en' else "Nota 👉🏼"
    return f"**{label}:** _{note}_"

def render_meta(parts, meta_kind):
    meta = f"_{' | '.join(parts)}_"
    prefix = f"{EMOJIS.get(meta_kind, '')} " if (EMOJI_IN_META and meta_kind in EMOJIS) else ""
    if META_STYLE == "blockquote": return f"> {prefix}{meta}"
    elif META_STYLE == "inline_code": return f"{prefix}`{meta}`"
    else: return f"{prefix}{meta}"

def make_entry_key(meta_kind, pos_label, text, note):
    norm_pos = (pos_label or '').replace('–','-').replace('—','-')
    base = f"{meta_kind}|{norm_pos}|{(text or '').strip()}|{(note or '').strip()}"
    return sha1_hex(base)

def extract_existing_keys_from_md(md_path: Path):
    try:
        data = md_path.read_text(encoding='utf-8', errors='ignore').splitlines()
    except FileNotFoundError:
        return set()

    embedded = set()
    for line in data:
        m = re.search(r'<!--\s*key:([0-9a-f]{40})\s*-->', line)
        if m: embedded.add(m.group(1))
    if embedded: return embedded

    keys = set()
    current_bullet = None
    for line in data:
        if line.startswith("- "):
            current_bullet = line[2:].strip()
        elif line.startswith("> "):
            meta_line = line
            meta_kind = "Highlight"
            if "🟧" in meta_line or re.search(r'_\s*(Note|Nota)\b', meta_line): meta_kind = "Note"
            elif "🟩" in meta_line or re.search(r'_\s*Bookmark\b', meta_line): meta_kind = "Bookmark"
            pm = re.search(r'Pos\s+(\d+(?:[–-]\d+)?)', meta_line)
            pos_label = f"Pos {pm.group(1)}" if pm else ""
            note_text = ""
            bullet_text = ""
            if current_bullet:
                nm = re.search(r'—\s+\*\*(?:Note|Nota)[^:]*:\*\*\s+_(.+?)_', current_bullet)
                if nm: note_text = nm.group(1).strip()
                bullet_text = re.sub(r'\s+—\s+\*\*(?:Note|Nota)[^:]*:\*\*\s+_.+?_', '', current_bullet).strip()
            key = make_entry_key(meta_kind, pos_label, bullet_text, note_text)
            keys.add(key)
            current_bullet = None
    return keys

def render_header(title, author, items, source_filename):
    lang = detect_lang_for_book(title)
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
    return "\n".join(lines)

def render_entries(items, title):
    lang = detect_lang_for_book(title)
    kind_map = {
        'en': {'Highlight':'Highlight','Note':'Note','Bookmark':'Bookmark', 'Page':'Page'},
        'es': {'Highlight':'Subrayado','Note':'Nota','Bookmark':'Marcador', 'Page':'Página'}
    }[lang]
    out_lines = []
    first = True
    for it in items:
        if not first: out_lines.append("")
        first = False

        text = (it.get('text') or '').strip()
        note = (it.get('note_text') or '').strip()
        meta_kind = 'Note' if note else it.get('kind','Highlight')

        # bullet
        main = text or ""
        if it['kind'] == 'Bookmark' and not main:
            if it.get('page_num') is not None:
                main = f"Bookmark at Page {it['page_num']}"
            elif it.get('pos_label'):
                main = f"Bookmark at {it['pos_label']}"
            else:
                main = "(Bookmark)"
        if note:
            label = "Note 👉🏼" if lang == 'en' else "Nota 👉🏼"
            main += f" — **{label}:** _{note}_"
        out_lines.append(f"- {main}")

        # meta
        parts = [kind_map.get(meta_kind, meta_kind)]
        if it.get('page_num') is not None:
            parts.append(f"{kind_map['Page']} {it['page_num']}")
        if it.get('pos_label'):
            parts.append(it['pos_label'])
        if it.get('added'):
            parts.append(it['added'])
        out_lines.append(render_meta(parts, meta_kind))

        if ENTRY_SEPARATOR:
            out_lines.append("")
            out_lines.append(ENTRY_SEPARATOR)
            out_lines.append("")

    return "\n".join(out_lines)

def main():
    file = find_latest_clippings()
    backup_path = backup_clippings(file)

    content = file.read_text(encoding='utf-8', errors='ignore')
    books = parse_entries(content)

    total_books = total_high = total_notes = total_bookm = 0
    updated_files = []
    total_appended = 0
    total_skipped = 0

    for (title, author), items in books.items():
        paired = pair_notes(items)
        paired.sort(key=lambda it: (it.get('pos_start') if it.get('pos_start') is not None else 10**12,
                                    it.get('page_num') if it.get('page_num') is not None else 10**12,
                                    it.get('added') or ""))

        out_path = OUTPUT_DIR / f"{safe_name(title)}.md"
        exists = out_path.exists()

        # Extract existing keys from current file (if any)
        existing_keys = extract_existing_keys_from_md(out_path)

        # Build list of new items and their keys
        new_items = []
        for it in paired:
            meta_kind = 'Note' if it.get('note_text') else it.get('kind','Highlight')
            key = make_entry_key(meta_kind, it.get('pos_label'), (it.get('text') or '').strip(), (it.get('note_text') or '').strip())
            if key not in existing_keys:
                new_items.append((key, it))
                existing_keys.add(key)
            else:
                total_skipped += 1

        if not exists:
            # First time for this book: write full header + all items, embedding keys.
            header = render_header(title, author, paired, source_filename=file.name)
            rendered = render_entries(paired, title).splitlines()
            # inject keys after each meta line
            out_lines, idx = [], 0
            for ln in rendered:
                out_lines.append(ln)
                if ln.startswith("> "):
                    # compute key for matching entry at same order
                    it = paired[idx]
                    meta_kind = 'Note' if it.get('note_text') else it.get('kind','Highlight')
                    key = make_entry_key(meta_kind, it.get('pos_label'), (it.get('text') or '').strip(), (it.get('note_text') or '').strip())
                    out_lines[-1] = ln + f"  <!-- key:{key} -->"
                    idx += 1
            out_path.write_text(header + "\n".join(out_lines) + "\n", encoding='utf-8')
            total_appended += len(paired)
        else:
            if new_items:
                with open(out_path, 'a', encoding='utf-8') as f:
                    f.write("\n\n<!-- appended " + datetime.now().strftime('%Y-%m-%d %H:%M') + " -->\n\n")
                    rendered = render_entries([it for _, it in new_items], title).splitlines()
                    out_lines = []
                    idx = 0
                    for ln in rendered:
                        out_lines.append(ln)
                        if ln.startswith("> "):
                            key = new_items[idx][0]
                            out_lines[-1] = ln + f"  <!-- key:{key} -->"
                            idx += 1
                    f.write("\n".join(out_lines) + "\n")
                total_appended += len(new_items)

        total_books += 1
        total_high += sum(1 for it in paired if it['kind']=='Highlight')
        total_notes += sum(1 for it in paired if (it.get('meta_override_kind')=='Note' or it['kind']=='Note'))
        total_bookm += sum(1 for it in paired if it['kind']=='Bookmark')
        updated_files.append(out_path.name)

    LOG_DIR.mkdir(exist_ok=True)
    with open(LOG_DIR/'last_run.txt', 'a', encoding='utf-8') as lf:
        lf.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} • Books:{total_books} • Highlights:{total_high} • Notes:{total_notes} • Bookmarks:{total_bookm} • "
                 f"Appended:{total_appended} • Duplicates skipped:{total_skipped} • Source:{file.name} • Backup:{backup_path.name}\n")

    print(f"📚 Parsed {total_books} book(s) • {total_high} highlights • {total_notes} notes • {total_bookm} bookmarks")
    print(f"➕ Appended: {total_appended} • ⏭️ Skipped duplicates: {total_skipped}")
    print(f"💾 Backup: {backup_path.name}")
    print(f"📂 Source: {file.name}")
    if updated_files: print('✅ Updated:', ' | '.join(updated_files))

if __name__ == '__main__':
    main()
