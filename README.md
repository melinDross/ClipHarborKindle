# Kindle Enhanced Clippings Exporter# 
Exporta súper detallado tu archivo MyClippings.txt en Notion (.md)

Este paquete incluye:
- `parse_kindle.py`: convierte `My Clippings.txt` (o `MyClippings_YYYYMMDD.txt`) en **Markdown por libro** dentro de `Books/`.
- Lo usarás junto con un Atajo (Shortcuts) en macOS para automatizar la copia del archivo desde el Kindle.

## Uso rápido
1) Copia ambos archivos a `~/Documents/KindleClippings/`
2) Conecta el Kindle por USB.
3) Copia `My Clippings.txt` desde `/Volumes/Kindle/documents/` a `~/Documents/KindleClippings/MyClippings_YYYYMMDD.txt`
4) En Terminal:  
   ```bash
   cd ~/Documents/KindleClippings
   python3 parse_kindle.py
   ```
5) Revisa `Books/` para ver los `.md` generados.
6) Importa esos `.md` a Notion (Import → Markdown & CSV).

## Consejos
- Si también lees en iPhone, copia las notas desde la app Kindle (Notebook → Compartir → Copiar) y pégalas al final del `.md` del libro correspondiente.
- Vacía `My Clippings.txt` de vez en cuando desde el Kindle para no duplicar entradas.

--------------------------
--------------------------

# Notion Scribe (Kindle Clippings → Markdown)

Exporta subrayados y notas de Kindle a Markdown **Notion-friendly**.  
Versión estable: **1.1e** — sin dedupe, con backups automáticos de *My Clippings.txt*.

---

## 📦 Qué genera
- Un `.md` por libro en `Books/`:
  - Cabecera con autor, número de highlights/notas/bookmarks y fecha de procesado.
  - Anotaciones en viñetas, con notas asociadas unidas al subrayado.
  - Meta en blockquote, estilo:  
    `> 🟦 Highlight | Page 12 | Pos 345–350 | 2024-06-13 22:38`
- Copia de seguridad del fichero original en `backups/` (por ejemplo: `My Clippings_20251023_1530.txt`).
- Log de ejecución en `logs/last_run.txt`.

---

## ✅ Requisitos
- **Python 3.9+** (recomendado 3.10 o superior)
- Un archivo `My Clippings.txt` (exportado del Kindle)

No se requieren dependencias externas (`pip install` innecesario).

---

## 🗂️ Estructura del proyecto
~/Documents/KindleClippings/
├─ parse_kindle_notion_v1_1e.py
├─ README.md
├─ CHANGELOG.md
├─ Books/
├─ backups/
├─ logs/
└─ My Clippings.txt (o My Clippings_YYYYMMDD.txt)

> El script busca el archivo **en la misma carpeta** desde la que se ejecuta.

---

## 🍎 macOS — instalación y uso

1️⃣ Crear la carpeta del proyecto  
```bash
mkdir -p ~/Documents/KindleClippings
cd ~/Documents/KindleClippings

2️⃣ Copiar el script parse_kindle_notion_v1_1e.py dentro de esa carpeta.

3️⃣ Conectar el Kindle → copiar
/Volumes/Kindle/documents/My Clippings.txt
a ~/Documents/KindleClippings/

4️⃣ Ejecutar
python3 parse_kindle_notion_v1_1e.py

5️⃣ Resultados:
	•	Markdown por libro en Books/
	•	Backup en backups/
	•	Log en logs/last_run.txt

💡 Automatización opcional: crea un atajo con la app Shortcuts para copiar el archivo del Kindle y lanzar el parser automáticamente.


## 🪟 Windows — instalación y uso

1️⃣ Instalar Python
Descarga desde python.org y marca “Add Python to PATH” durante la instalación.

2️⃣ Crear la carpeta

mkdir "$env:USERPROFILE\Documents\KindleClippings"
cd "$env:USERPROFILE\Documents\KindleClippings"

3️⃣ Copiar el script y el My Clippings.txt del Kindle (E:\documents\My Clippings.txt) a esa carpeta.

4️⃣ Ejecutar

python .\parse_kindle_notion_v1_1e.py

5️⃣ Ver resultados:
	•	.md por libro → Books\
	•	Copia de seguridad → backups\
	•	Log → logs\last_run.txt

## 📥 Llevarlo a Notion

### A) Import manual (simple y gratis)
1. En Notion → **Import → Markdown & CSV**
2. Arrastra la carpeta `Books/`.
3. Notion crea una página por cada `.md`.

### B) Semiauto gratis con Notion Importer
1. Descarga la app **Notion Importer** (oficial).  
2. Elige `Books/` como carpeta de entrada.  
3. Habilita “auto-import new files”.  
4. Si no lo hace automático, abre Importer y haz *batch import* manualmente.

🧭 Más adelante podrás pasar al “modo Pro” con la **API de Notion**, que crea o actualiza páginas automáticamente.

---

## 🧪 Formato y comportamiento

- **Notas y subrayados unidos:**  
  `— **Note 👉🏼:** _texto de la nota_`
- **Idioma:** etiquetas en inglés por defecto.  
- **Fechas:** formato compacto `YYYY-MM-DD HH:MM`.

---

## 🧯 Problemas comunes

- **“No 'My Clippings.txt' found”**  
  Asegúrate de que el archivo está en la misma carpeta desde donde ejecutas el script.

- **macOS no copia desde `/Volumes/Kindle`**  
  Entra en *System Settings → Privacy & Security → Full Disk Access*  
  y da acceso a **Shortcuts**, **Terminal** y **Finder**.

- **Caracteres extraños o acentos**  
  Guarda el archivo en codificación **UTF-8** antes de procesarlo.

---

**Notion Scribe** — from highlights to insights ✨
