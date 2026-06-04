# Notion Scribe — Kindle Clippings Exporter

> Exporta subrayados y notas de Kindle a Markdown **Notion-friendly**.  
> Versión estable: **1.1e** — con backups automáticos y sin dedupe.

---

## 📦 Qué genera

- Un `.md` por libro en `Books/`:
  - Cabecera con autor, número de highlights/notas/bookmarks y fecha de procesado.
  - Anotaciones en viñetas, con notas asociadas unidas al subrayado.
  - Meta en blockquote:  
    `> 🟦 Highlight | Page 12 | Pos 345–350 | 2024-06-13 22:38`
- Copia de seguridad del fichero original en `backups/` (p. ej.: `My Clippings_20251023_1530.txt`).
- Log de ejecución en `logs/last_run.txt`.

---

## ✅ Requisitos

- **Python 3.9+** (recomendado 3.10 o superior)
- Un archivo `My Clippings.txt` exportado del Kindle

No se requieren dependencias externas — `pip install` innecesario.

---

## 🗂️ Estructura del proyecto

```
~/Documents/KindleClippings/
├─ parse_kindle_notion_v1_1e.py
├─ README.md
├─ Books/
├─ backups/
├─ logs/
└─ My Clippings.txt (o My Clippings_YYYYMMDD.txt)
```

> El script busca el archivo **en la misma carpeta** desde la que se ejecuta.

---

## 🍎 macOS — instalación y uso

**1️⃣ Crear la carpeta del proyecto**
```bash
mkdir -p ~/Documents/KindleClippings
cd ~/Documents/KindleClippings
```

**2️⃣** Copiar `parse_kindle_notion_v1_1e.py` dentro de esa carpeta.

**3️⃣** Conectar el Kindle → copiar  
`/Volumes/Kindle/documents/My Clippings.txt`  
a `~/Documents/KindleClippings/`

**4️⃣ Ejecutar**
```bash
python3 parse_kindle_notion_v1_1e.py
```

**5️⃣ Resultados:**
- Markdown por libro en `Books/`
- Backup en `backups/`
- Log en `logs/last_run.txt`

> 💡 **Automatización opcional:** crea un atajo con la app Shortcuts para copiar el archivo del Kindle y lanzar el parser automáticamente.

---

## 🪟 Windows — instalación y uso

**1️⃣ Instalar Python**  
Descarga desde [python.org](https://python.org) y marca "Add Python to PATH" durante la instalación.

**2️⃣ Crear la carpeta**
```powershell
mkdir "$env:USERPROFILE\Documents\KindleClippings"
cd "$env:USERPROFILE\Documents\KindleClippings"
```

**3️⃣** Copiar el script y `My Clippings.txt` del Kindle (`E:\documents\My Clippings.txt`) a esa carpeta.

**4️⃣ Ejecutar**
```powershell
python .\parse_kindle_notion_v1_1e.py
```

**5️⃣ Ver resultados:**
- `.md` por libro → `Books\`
- Copia de seguridad → `backups\`
- Log → `logs\last_run.txt`

---

## 📥 Llevarlo a Notion

### A) Import manual (simple y gratis)
1. En Notion → **Import → Markdown & CSV**
2. Arrastra la carpeta `Books/`.
3. Notion crea una página por cada `.md`.

### B) Semiauto gratis con Notion Importer
1. Descarga la app **Notion Importer** (oficial).
2. Elige `Books/` como carpeta de entrada.
3. Habilita "auto-import new files".
4. Si no lo hace automático, abre Importer y haz *batch import* manualmente.

> 🧭 Más adelante podrás pasar al "modo Pro" con la **API de Notion**, que crea o actualiza páginas automáticamente.

---

## 🧪 Formato de salida

### Ejemplo de archivo `.md` generado

```markdown
# Blood, Sweat, and Pixels  
🖋️ Author: Jason Schreier  
🔖 Highlights: 42 | Notes: 7 | Bookmarks: 2  
📌 Processed: 2025-10-23 02:03  
📂 Source: My Clippings_20251022.txt  

---

- "Sounds like a miracle that this game was even made." — **Note 👉🏼:** _Con todos los imprevistos..._  
> 🟧 Note | Page 6 | Pos 46–48 | 2024-06-13 22:28  

---

- Developers everywhere talk about how hard it is to make games.  
> 🟦 Highlight | Page 6 | Pos 49–50 | 2024-06-13 22:38
```

### Emojis de tipo
| Emoji | Tipo |
|-------|------|
| 🟦 | Highlight |
| 🟧 | Note |
| 🟩 | Bookmark |

### Notas y subrayados unidos
Las notas asociadas a un subrayado se integran directamente debajo de él:  
`— **Note 👉🏼:** _texto de la nota_`  
Si no hay highlight asociado, se exportan como entradas independientes.

### Multiidioma
- Idioma base configurable (`OUTPUT_LANG_DEFAULT`).
- Permite asignar idioma por libro:
  ```python
  PER_BOOK_LANG = {"Hábitos atómicos": "es"}
  ```
- Traduce dinámicamente etiquetas (`Highlight` → `Subrayado`, etc.).

---

## 🧯 Problemas comunes

**"No 'My Clippings.txt' found"**  
Asegúrate de que el archivo está en la misma carpeta desde donde ejecutas el script.

**macOS no copia desde `/Volumes/Kindle`**  
Ve a *System Settings → Privacy & Security → Full Disk Access* y da acceso a **Shortcuts**, **Terminal** y **Finder**.

**Caracteres extraños o acentos**  
Guarda el archivo en codificación **UTF-8** antes de procesarlo.

---

## 📋 Changelog

### v1.1e — "Backup Edition" *(Estable)* — 2025-10-23

Base: `1.1d` | Foco: exportación fiable + backups automáticos.

**Novedades:**
- Backup automático antes de cada procesado → `backups/My Clippings_YYYYMMDD_HHMM.txt`
- Log de ejecución en `logs/last_run.txt`:
  ```
  2025-10-23 02:03:14 • Books:12 • Highlights:243 • Notes:37 • Bookmarks:5 • Source:My Clippings_20251022.txt • Backup:My Clippings_20251023_0159.txt
  ```

**Estado de funcionalidades:**

| Categoría | Estado |
|-----------|--------|
| Dedupe | ❌ Desactivado |
| Backup automático | ✅ Activo |
| Pairing notas/subrayados | ✅ Activo |
| Multiidioma (EN/ES) | ✅ Configurable |
| Logs de ejecución | ✅ Activo |
| Dependencias externas | 🚫 Ninguna |
| Compatibilidad Notion | ✅ Óptima |

### Historial de versiones

| Versión | Cambios principales |
|---------|---------------------|
| **1.1d** | Estable sin backups ni dedupe. |
| **1.1e** | Añade backups automáticos; conserva estructura Notion. |
| **1.2** *(cancelada)* | Introdujo dedupe y diff; descartada por inestabilidad. |

---

*Notion Scribe — from highlights to insights ✨*
