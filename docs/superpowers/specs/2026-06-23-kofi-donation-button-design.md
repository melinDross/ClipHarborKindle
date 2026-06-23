# Botón de donación Ko-fi en el header — Design Spec

Fecha: 2026-06-23

## Contexto y motivación

Añadir un punto de entrada visible para que quien use la web del exportador pueda apoyar el proyecto económicamente, vía Ko-fi. No hay cuenta de Ko-fi creada todavía, así que esta ronda deja el enlace como placeholder explícito, listo para sustituir por la URL real cuando exista.

## Cambios en `web/index.html`

El `<header class="nav">` pasa de tener dos hijos directos (el `<span>` del título y `.lang-switch`) a tres, agrupando los dos elementos de la derecha bajo un nuevo `<div class="header-actions">` para no romper el `justify-content: space-between` ya existente entre título y "todo lo demás":

```html
<header class="nav">
  <span>📚 Kindle → Notion Exporter</span>
  <div class="header-actions">
    <!-- TODO: sustituir TU_USUARIO_AQUI por el usuario real de Ko-fi cuando exista la cuenta -->
    <a id="kofi-link" class="kofi-link" href="https://ko-fi.com/TU_USUARIO_AQUI" target="_blank" rel="noopener noreferrer">
      <img src="vendor/kofi-badge.png" alt="Support me on Ko-fi" class="kofi-badge">
    </a>
    <div class="lang-switch">
      <button id="lang-es" class="lang-button" type="button">🇪🇸 ES</button>
      <button id="lang-en" class="lang-button" type="button">🇬🇧 EN</button>
    </div>
  </div>
</header>
```

Nada cambia en `web/app.js` — no hay lógica asociada a este botón, es un enlace estático.

## Imagen vendorizada

Siguiendo el mismo criterio que con JSZip (`web/vendor/jszip.min.js`, vendorizado en vez de cargado desde CDN), el badge oficial de Ko-fi se descarga una vez y se guarda en `web/vendor/kofi-badge.png`. El header no debe depender de que `storage.ko-fi.com` esté disponible para renderizar correctamente.

## Accesibilidad e internacionalización

- `alt="Support me on Ko-fi"` queda **fijo en inglés**, sin pasar por `web/strings.js` — el badge visual de Ko-fi ya trae texto en inglés incrustado en la imagen, así que traducir solo el `alt` generaría inconsistencia entre lo que se lee y lo que se ve.
- `target="_blank" rel="noopener noreferrer"` por buena práctica de seguridad al abrir un enlace externo en pestaña nueva (evita que la página de destino pueda acceder a `window.opener`).

## Cambios en `web/style.css`

Nuevas reglas:

```css
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kofi-badge {
  height: 28px;
  width: auto;
  display: block;
}
```

`.lang-switch` no cambia (mantiene su `display: flex; gap: 4px;` ya existente) — simplemente queda anidado un nivel más, dentro de `.header-actions`.

## Testing

Sin test automatizado — es markup y CSS estático sin lógica de negocio. Verificación manual visual en navegador: el badge se renderiza, el enlace abre `ko-fi.com` en pestaña nueva, y el header no se rompe en una sola fila a los anchos de viewport ya soportados por el resto de la UI.

## Fuera de alcance (explícitamente, para esta ronda)

- Sustituir la URL placeholder por la cuenta real de Ko-fi (pendiente de que el usuario cree la cuenta).
- Cualquier lógica de tracking/analytics sobre clics en el botón.
- Soporte para otras plataformas de donación (Buy Me a Coffee, GitHub Sponsors, PayPal.me) — se eligió Ko-fi explícitamente para esta ronda.
