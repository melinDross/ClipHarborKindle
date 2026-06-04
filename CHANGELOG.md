# 📚 Kindle Clippings → Notion Parser  
**Proyecto:** parse_kindle_notion.py  
**Autor:** S  
**Versión actual:** 1.1e  
**Fecha:** 2025-10-23  
---

## 🧾 Versión 1.1e — “Backup Edition” (Estable)
**Base:** 1.1d  
**Foco:** exportación fiable + backups automáticos del archivo `My Clippings`.

### 🔧 Funcionalidad Principal
- Procesa automáticamente `My Clippings.txt` o `My Clippings_YYYYMMDD.txt`.
- Genera un archivo `.md` por libro en `/Books/`.
- Formato compatible con **Notion**, con separación limpia entre entradas.
- Sin deduplicado: cada ejecución reescribe los `.md` completos.

### 💾 Backups Automáticos
- Antes de procesar, crea una copia del archivo de clippings en `/backups/`.
- Formato:  
  ```
  My Clippings_YYYYMMDD_HHMM.txt
  ```
- Protege contra pérdidas accidentales y mantiene historial por fecha.

### ✍️ Estructura de Archivos .MD
Ejemplo de salida:
```
# Blood, Sweat, and Pixels  
🖋️ Author: Jason Schreier  
🔖 Highlights: 42 | Notes: 7 | Bookmarks: 2  
📌 Processed: 2025-10-23 02:03  
📂 Source: My Clippings_20251022.txt  

---

- “Sounds like a miracle that this game was even made.” — **Note 👉🏼:** _Con todos los imprevistos..._  
> 🟧 Note | Page 6 | Pos 46–48 | 2024-06-13 22:28  

---

- Developers everywhere talk about how hard it is to make games.  
> 🟦 Highlight | Page 6 | Pos 49–50 | 2024-06-13 22:38
```

### 🧠 Emparejado de Notas
- Las notas asociadas a un subrayado se integran directamente debajo de él.  
- Si no hay highlight asociado, se exportan como entradas independientes.

### 🌍 Soporte Multiidioma
- Idioma base configurable (`OUTPUT_LANG_DEFAULT`).
- Permite asignar idioma por libro:  
  ```python
  PER_BOOK_LANG = {"Hábitos atómicos": "es"}
  ```
- Traduce dinámicamente etiquetas (`Highlight` → `Subrayado`, etc.).

### 🎨 Formato y Estilo
- Metadatos entre guiones bajos `_`:  
  `_Highlight | Page 6 | Pos 49–50 | 2024-06-13 22:38_`
- Emojis:
  - 🟦 Highlight
  - 🟧 Note
  - 🟩 Bookmark
- Meta en **blockquote (`>`)** para legibilidad en Notion.
- Separadores `---` entre anotaciones.

### 🗂️ Logs
- Guarda un registro de ejecución en `/logs/last_run.txt`:  
  ```
  2025-10-23 02:03:14 • Books:12 • Highlights:243 • Notes:37 • Bookmarks:5 • Source:My Clippings_20251022.txt • Backup:My Clippings_20251023_0159.txt
  ```

### 🧩 Diferencias con Versiones Previas
| Versión | Cambios principales |
|----------|--------------------|
| **1.1d** | Estable sin backups ni dedupe. |
| **1.1e** | Añade backups automáticos y conserva estructura Notion. |
| **1.2 (cancelada)** | Introdujo dedupe y diff, descartada por inestabilidad. |

### ✅ Estado Actual
| Categoría | Estado |
|------------|--------|
| Dedupe | ❌ Desactivado |
| Backup automático | ✅ Activo |
| Pairing notas/subrayados | ✅ Activo |
| Multiidioma (EN/ES) | ✅ Configurable |
| Logs de ejecución | ✅ Activo |
| Dependencias externas | 🚫 Ninguna |
| Compatibilidad Notion | ✅ Óptima |

---

**🪶 Resumen:**  
v1.1e consolida la estabilidad lograda en 1.1d e introduce un sistema de respaldo automático, manteniendo el formato más limpio, fiable y compatible con Notion.
