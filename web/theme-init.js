// Applies a saved manual light/dark choice before first paint, same reasoning
// as lang-init.js: doing this in app.js (a module, loaded late) would cause a
// flash of the wrong theme. No saved choice means no class is added here, so
// the page falls back to the prefers-color-scheme rules in style.css and
// keeps following the OS setting live.
(function () {
  var saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.classList.add('theme-' + saved);
  }
})();
