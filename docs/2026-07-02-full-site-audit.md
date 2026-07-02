# Auditoría técnica, visual, de accesibilidad, SEO/GEO y seguridad — Clip Harbor for Kindle

Fecha: 2026-07-02
Alcance: `web/` (producto activo, publicado en GitHub Pages), `.github/workflows/deploy-pages.yml`, `README.md`. No se ha vuelto a auditar `cli/*.py` (congelado, ver `CLAUDE.md`).

Orden: crítico → alto → medio → menor. "Crítico/Alto" = afecta a todos los usuarios o supone un riesgo real; "Medio" = degrada la experiencia en casos comunes; "Menor" = pulido.

---

## Crítico

### 1. No hay `robots.txt`, `sitemap.xml`, meta description, Open Graph ni `<meta name="description">`
`web/index.html` solo tiene `<title>`. No hay descripción, no hay `og:title`/`og:description`/`og:image`, no hay `twitter:card`. Para una herramienta pensada para que la descubra gente buscando "convertir My Clippings.txt a Notion" esto es la pérdida de SEO más grande posible: Google no tiene texto para el snippet, y compartir el link en Slack/WhatsApp/Twitter no genera preview (GEO/AI answer engines como ChatGPT/Perplexity tampoco tienen nada que indexar más allá del body renderizado). Recomendado: añadir `<meta name="description">`, `og:*`, `twitter:card=summary_large_image`, un `robots.txt` simple (`User-agent: *\nAllow: /`) y un `sitemap.xml` de una sola URL.

### 2. No hay favicon
Sin `<link rel="icon">` ni fichero `favicon.ico`/`favicon.svg`. El navegador muestra el icono roto por defecto en pestañas y marcadores — impacto de marca y de percepción de "sitio terminado" en cada visita.

### 3. ✅ `lang="es"` fijo en `<html>` pese a que la UI cambia de idioma dinámicamente
`index.html:2` fija `lang="es"` en el HTML estático, pero `app.js` (`applyLang`) sí actualiza `document.documentElement.lang` en tiempo de ejecución — **excepto en la primera carga**, porque `index.html` se sirve con `lang="es"` incluso cuando `detectInitialLang()` va a elegir inglés basado en el navegador. Un usuario angloparlante con lector de pantalla activado en el primer render (antes de que `applyLang(currentLang)` se ejecute al final de `app.js`) oirá el contenido pronunciado con reglas fonéticas españolas por un instante, y cualquier snapshot/cache/CDN que sirva el HTML pre-JS (crawlers, algunos previsualizadores de link) verá siempre `lang="es"` sin importar el idioma real detectado. Esto también es una señal de SEO internacional incorrecta (Google usa `lang` para indexación por idioma). Fix: mover la detección de idioma inicial a un script inline en `<head>` que fije `lang` antes del primer paint, o aceptar que el SSR estático siempre anuncia español y documentarlo.

**Implementado (2026-07-02):** nuevo `web/lang-init.js`, cargado como `<script src="lang-init.js">` justo en el `<head>` (no inline, para no romper la CSP del punto 6), fija `document.documentElement.lang` antes del primer paint usando la misma lógica que `detectInitialLang()`.

### 4. Vendor de terceros (`jszip.min.js`) cargado sin Subresource Integrity (SRI) — y sin `defer`/`async`
`index.html:38`: `<script src="vendor/jszip.min.js"></script>`. Al estar vendorizado localmente (no es un CDN externo) el riesgo de supply-chain vía CDN comprometido no aplica directamente, pero: (a) no hay forma de verificar en el pipeline de build/CI que el fichero vendorizado no ha sido alterado accidental o maliciosamente antes del commit — un `integrity` hash en el `<script>` (o al menos un check en CI que compare el hash contra el publicado por el autor de JSZip) cerraría ese hueco; (b) el script bloquea el parseo del HTML porque no tiene `defer`, y como está antes del `<script type="module">`, retrasa innecesariamente el primer render en conexiones lentas (más relevante en móvil).

---

## Alto

### 5. ✅ `dropZone.innerHTML = t('dropZone')` — vector de XSS si `STRINGS` deja de ser 100% estático
`app.js:85`. Hoy `STRINGS` es un objeto hardcodeado en `strings.js`, así que no hay inyección posible *ahora*. Pero es un patrón fragil: cualquier futura feature que permita que ese string incluya datos derivados del fichero del usuario (p. ej. un mensaje de error que incluya el nombre del fichero, o una futura i18n cargada por fetch) reintroduciría XSS de forma silenciosa porque el código ya usa `innerHTML` en vez de `textContent` + nodos separados para el `<br>`. Recomendado: reemplazar por dos nodos de texto separados por un `<br>` creado explícitamente, o al menos dejar un comentario de advertencia junto a `STRINGS` prohibiendo interpolar datos de usuario ahí.

**Implementado (2026-07-02):** nueva función `setDropZoneText()` en `app.js` que construye el contenido con `textContent`/`createElement('br')` en vez de `innerHTML`, eliminando el sink de XSS.

### 6. ✅ Sin `Content-Security-Policy`
No hay meta-tag CSP ni cabecera (GitHub Pages no permite cabeceras custom fácilmente, pero sí se puede poner `<meta http-equiv="Content-Security-Policy">`). Dado el punto 5 y que el proyecto procesa ficheros arbitrarios del usuario en el cliente, una CSP restrictiva (`default-src 'self'; script-src 'self'; object-src 'none'`) sería defensa en profundidad barata y sin coste funcional real, ya que no hay scripts externos ni inline necesarios.

**Implementado (2026-07-02):** `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'">` en `web/index.html`. Verificado en navegador (Playwright) que la app sigue funcionando end-to-end sin violaciones de CSP en consola.

### 7. Contraste de color no verificado — texto secundario y estados
`style.css`: el color base `#222` sobre blanco es correcto (~16:1), pero `.lang-button` en estado no-activo usa borde `#ccc` sobre fondo blanco (bajo contraste para usuarios con baja visión al identificar el botón, aunque el texto en sí es `#222`/negro — ok). Más relevante: `.error` usa `#8a1f1f` sobre `#fde8e8` (contraste ~5.2:1, pasa AA para texto normal pero raspando) y no se ha verificado si pasa en modo alto contraste de SO. No es bloqueante pero merece una pasada con una herramienta de contraste (axe/Lighthouse) antes de dar la web por accesible.

### 8. ✅ No hay manejo de `prefers-color-scheme` ni modo oscuro
Toda la hoja de estilos asume fondo blanco fijo. En 2026 una parte significativa de usuarios de móvil navega con modo oscuro de sistema forzado por el navegador (Safari/Chrome "auto-dark" en algunos Android), lo que puede producir combinaciones de color no probadas e ilegibles si el navegador reescribe colores automáticamente sin que la web lo controle explícitamente.

**Implementado (2026-07-02):** bloque `@media (prefers-color-scheme: dark)` en `web/style.css` cubriendo fondo, texto, botones, drop-zone, mensajes de error/procesando y lista de libros.

### 9. Falta manejo de fichero sin `File System Access` para móvil / Safari iOS
El flujo depende de drag-and-drop (`dragover`/`drop`) como interacción principal sugerida visualmente ("Arrastra aquí tu..."), pero en móvil no existe drag-and-drop de ficheros del sistema de archivos al navegador de la misma manera. El copy no se adapta: en pantallas táctiles debería priorizarse el texto "haz clic para seleccionar" y ocultar/reescribir la referencia a "arrastra", ya que confunde a quien usa el Kindle→móvil como flujo típico (exportar `My Clippings.txt` por AirDrop/compartir y abrirlo desde el móvil).

### 10. Botón de "Descargar todo (.zip)" y "Descargar" individual no verifican soporte de descarga en Safari iOS
`link.download` no funciona de forma fiable en Safari para iOS en todas las versiones (abre el fichero en una nueva pestaña en vez de descargarlo). No hay fallback ni mensaje explicando qué hacer si la descarga no se dispara sola (p. ej. "mantén pulsado para guardar"). Dado que gran parte del público objetivo maneja el fichero desde el propio Kindle/móvil, este es un caso de uso central sin cubrir, no un edge case.

---

## Medio

### 11. Duplicados de datos ya detectados sin resolver: `Parque_Jurasico.md` / `Parque_Jurásico.md`
Ya documentado en `CLAUDE.md` (mejora pendiente #4) — persisten ambos ficheros en `Books/`. No es código, es limpieza de datos, pero sigue abierto.

### 12. `detectBookLang` / `detectEntryLang` con heurística de palabras clave sin mecanismo de fallback explícito visible al usuario más allá del emoji de aviso
Cuando ningún dato de metadatos matchea (usuario con Kindle en un tercer idioma, p. ej. francés o alemán), el libro se etiqueta en inglés por defecto (`esCount > enCount ? 'es' : 'en'`, empate → 'en') y se muestra el aviso "⚠️ Idioma no reconocido". Correcto como mitigación, pero no hay forma de que el usuario fuerce manualmente el idioma de salida del markdown — sería una mejora de UX razonable (selector de idioma por libro cuando se detecta el aviso).

### 13. ✅ Accesibilidad: foco visual no personalizado
No hay ningún `:focus` / `:focus-visible` custom en `style.css`. Se depende enteramente del estilo de foco por defecto del navegador, lo cual es aceptable pero no verificado — en Safari el anillo de foco por defecto en botones a veces es muy tenue. Merece pasar Lighthouse/axe con navegación por teclado real.

**Implementado (2026-07-02):** regla global `:focus-visible { outline: 3px solid #3366ff; outline-offset: 2px; }` en `web/style.css`.

### 14. Accesibilidad: la etiqueta del `drop-zone` en el HTML estático no coincide con el idioma real hasta que corre JS
`index.html:25` tiene el texto español hardcodeado (`Arrastra aquí tu...`) sin `aria-label` inicial — el `aria-label` se añade solo tras `applyLang()`. Un lector de pantalla que empiece a leer justo tras el DOMContentLoaded pero antes del primer paint de JS podría anunciar contenido sin `aria-label`, cayendo al texto visible (que sí existe, así que el impacto real es bajo, pero es inconsistente con el resto del enfoque i18n).

### 15. `#book-list li` sin indicación de rol/lista semántica reforzada para lectores de pantalla
Es una `<ul>` normal, lo cual es correcto, pero cada `<li>` mezcla texto informativo largo (título, autor, contador de subrayados/notas/marcadores) con un botón de acción sin agrupación semántica (`aria-labelledby` que ligue el botón "Descargar" a qué libro pertenece). Un usuario de lector de pantalla que tabule directamente a los botones "Descargar" sin pasar por el texto oirá solo "Descargar", sin saber de qué libro es cada uno. Recomendado: `aria-label` dinámico en cada `download-one-button` tipo `Descargar {título}`.

### 16. Meta viewport sin `viewport-fit=cover` / no se ha probado en notch/safe-area
`<meta name="viewport" content="width=device-width, initial-scale=1">` está bien pero no incluye pruebas de safe-area para iPhones con notch — el `.nav` con `justify-content: space-between` podría quedar pegado al borde en landscape. Menor pero fácil de arreglar con `padding` + `env(safe-area-inset-*)`.

### 17. Botones de idioma (`lang-button`) son el único punto de entrada táctil pequeño (`padding: 4px 8px`, `font-size: 0.85rem`)
En móvil esto cae por debajo del tamaño de objetivo táctil recomendado (44×44px de Apple HIG / 48×48dp de Material). Con dos botones adyacentes (`gap: 4px`) el riesgo de mistap es real. Igual con `download-one-button` (`padding: 4px 10px`).

### 18. ✅ No hay indicador de progreso/estado durante el parseo de ficheros grandes
`handleFile` no muestra ningún estado de "procesando" mientras `FileReader` lee y `exportBooks` parsea — para un `My Clippings.txt` con miles de entradas (usuarios con Kindles de varios años) el hilo principal puede bloquearse perceptiblemente sin ningún feedback visual, dando sensación de web colgada. El botón de descarga sí tiene estado "Generando…", pero la fase de parseo inicial no.

**Implementado (2026-07-02):** nuevo elemento `#processing-message` (`aria-live="polite"`) mostrado en `handleFile()` antes de parsear, con un `setTimeout(…, 0)` para dar tiempo al navegador a pintar el mensaje antes de que el parseo síncrono bloquee el hilo; strings `processingLabel` en ambos idiomas.

### 19. ✅ `noopener noreferrer` presente en el link de Ko-fi (bien) pero no hay `rel="me"` ni verificación de que el dominio de Ko-fi coincide con el usuario real
Menor, pero dado que es un enlace de donación con dinero de por medio, vale la pena que el propio README o la web declaren explícitamente que ese es el único canal de donación oficial, para blindar contra suplantación si alguien clona el repo.

**Implementado (2026-07-02):** añadido `rel="noopener noreferrer me"` y `title="Official donation link for this project"` al enlace de Ko-fi en `web/index.html`.

### 20. ✅ Falta manejo de error para ficheros que no son `.txt` reales aunque tengan la extensión
El `accept=".txt"` del `<input type="file">` es solo una sugerencia de UI; nada impide (ni debería impedir) subir cualquier fichero renombrado a `.txt`. Los mensajes de error actuales (`processError`, `noHighlights`) ya cubren razonablemente el caso de contenido no reconocible — esto está bien resuelto, se documenta aquí solo para constancia de que sí se revisó.

**Revisado (2026-07-02):** confirmado que no requiere cambios — `processError`/`noHighlights` ya cubren el caso correctamente.

---

## Menor

### 21. ✅ `Books/` (datos de ejemplo/reales del usuario) están commiteados en el repo público
Contiene extractos reales de libros del propio usuario (subrayados y notas personales). Si el repo es público, esto expone lecturas y anotaciones personales. Vale la pena confirmar si es intencional (portfolio) o si deberían moverse a `.gitignore`.

**Revisado (2026-07-02):** falsa alarma — `git ls-files` confirma que `Books/` **no está trackeado por git** (ya cubierto por `.gitignore`; los ficheros que vio la auditoría inicial existen solo en el disco local, no en el repo ni en el historial). No se requiere ninguna acción.

### 22. ✅ `backups/My Clippings_moni.txt` y otros ficheros con nombre de otra persona ("moni") commiteados
Mismo problema que el punto 21 pero más sensible: es un fichero de clippings de otra persona, con nombre propio en el nombre de fichero, en un repo público. Revisar si esto se subió sin querer.

**Revisado (2026-07-02):** falsa alarma — `backups/` tampoco está trackeado por git (mismo caso que el punto 21). No hay datos personales de terceros en el historial del repo. No se requiere ninguna acción.

### 23. ✅ `.DS_Store` commiteados en múltiples carpetas (`web/.DS_Store`, `docs/.DS_Store`, `backups/.DS_Store`, `.superpowers/.DS_Store`)
Ruido de repo sin impacto funcional; añadir `.DS_Store` a `.gitignore` (global o del repo) y limpiar con `git rm --cached`.

**Revisado (2026-07-02):** falsa alarma — `git log --all -- '**/.DS_Store'` no devuelve nada; ningún `.DS_Store` ha estado nunca trackeado. `.gitignore` ya los excluye. No se requiere ninguna acción.

### 24. ✅ `__pycache__/` commiteado
`__pycache__/parse_kindle_notion_v1_2_1_fix.cpython-313.pyc` no debería estar en control de versiones; añadir a `.gitignore`.

**Revisado (2026-07-02):** falsa alarma — `__pycache__/` no está trackeado por git (ya cubierto por `.gitignore`). No se requiere ninguna acción.

### 25. No hay tests end-to-end / de UI, solo unitarios de `parser.js`/`strings.js`
`parser.test.js` y `strings.test.js` cubren bien la lógica pura, pero no hay ningún test (ni siquiera manual documentado) de la interacción real drag&drop/descarga en un navegador real, ni verificación automatizada de accesibilidad (axe-core) en CI.

### 26. Emojis como único indicador visual de estado/tipo (🟦🟧🟩⚠️⬇️)
Usar emoji para transmitir información funcional (tipo de entrada: highlight/nota/marcador) es simpático mobile-friendly, pero dos problemas: (a) el renderizado de emoji varía bastante entre SO/fuente, pudiendo perder legibilidad de significado; (b) para usuarios con lectores de pantalla, un emoji sin texto alternativo se lee con su nombre literal ("cuadrado azul", "cuadrado naranja") sin indicar qué representa — el markdown generado depende únicamente del color para diferenciar tipo de entrada en apps que no rendericen bien viñetas emoji.

### 27. `README.md` no menciona una política de privacidad ni aclara retención cero de forma tan visible como podría en la propia web
La web sí procesa todo en cliente (correcto y ya verificado en el código — no hay ninguna llamada de red saliente del fichero del usuario), pero este dato de confianza tan importante ("tu fichero nunca sale de tu navegador") solo vive en el README, no en la propia interfaz de la web donde el usuario está a punto de soltar un fichero personal. Añadir una línea corta cerca del drop-zone reforzaría confianza y es buena práctica también de cara a SEO/GEO ("procesamiento local", "sin servidor" son términos que motores de búsqueda y answer engines valoran para herramientas de privacidad).

### 28. Cache-busting del workflow de deploy es frágil (`sed` sobre archivos, acoplado a nombres literales)
`.github/workflows/deploy-pages.yml` usa `sed` para inyectar `?v=$SHA` en las referencias a `app.js`, `style.css`, `parser.js`, `strings.js`. Funciona, pero es frágil: cualquier cambio de formato en las comillas o rutas de esos imports rompe el cache-busting silenciosamente (sin fallo de CI, solo deja de añadir el query param). Alternativa más robusta a futuro: usar un hash de contenido real (p. ej. con un pequeño script Node) o un bundler mínimo.

### 29. No hay `Cache-Control` explícito ni versión con hash de contenido para `vendor/jszip.min.js`
El cache-busting del workflow no toca `jszip.min.js` — si ese fichero se actualiza alguna vez, los navegadores con el JS cacheado de larga duración de GitHub Pages podrían servir una versión vieja indefinidamente.

### 30. Falta `<meta name="theme-color">` para navegadores móviles (barra de estado/Chrome Android)
Detalle cosmético de pulido mobile: sin esto, la barra de navegador en Android usa el color por defecto en vez de integrarse con el diseño de la web.

---

## Resumen priorizado (para decidir qué atacar primero)

1. SEO/GEO básico ausente: meta description, OG tags, favicon, robots.txt (puntos 1–2) — alto impacto, bajo esfuerzo. **Pendiente.**
2. ✅ `lang` estático incorrecto en primera carga (punto 3) — impacto en SEO internacional y accesibilidad, esfuerzo bajo. **Hecho.**
3. ✅ Blindar `innerHTML`/añadir CSP como defensa en profundidad (puntos 5–6) — bajo riesgo real hoy, pero barato de cerrar del todo. **Hecho.**
4. Flujo de descarga/drop en móvil e iOS Safari (puntos 9–10) — afecta directamente al caso de uso "exportar desde el Kindle al móvil". **Pendiente.**
5. Accesibilidad: foco visible (✅ hecho, punto 13), `aria-label` en botones de descarga (punto 15, pendiente), tamaño de objetivos táctiles (punto 17, pendiente).
6. Limpieza de repo: `.DS_Store`, `__pycache__`, datos personales de terceros en `backups/` (puntos 21–24) — **revisado, resultó ser falsa alarma: nada de esto está trackeado por git.**
7. Resto: pulido visual (punto 7, pendiente), ✅ dark mode (punto 8), ✅ indicador de progreso (punto 18), ✅ enlace de Ko-fi reforzado (punto 19), mensaje de privacidad en la UI (punto 27, pendiente).

### Estado de implementación (2026-07-02)
Implementados en esta ronda: **3, 5, 6, 8, 13, 18, 19, 20** (más 21–24 revisados y descartados como falsa alarma). Verificado con la suite de tests (`node --test`, 59/59 OK) y con una pasada funcional real en navegador vía Playwright (carga de página, CSP sin violaciones, subida de fichero, parseo y renderizado de resultados end-to-end).
