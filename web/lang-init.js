// Sets the real document language before first paint — detectInitialLang()
// in strings.js runs too late (after app.js loads as a module) to avoid a
// flash of the wrong document language for screen readers and crawlers.
// Kept as its own external file (not an inline <script>) so the page's CSP
// can stay at script-src 'self' without an 'unsafe-inline' exception.
(function () {
  var saved = localStorage.getItem('uiLang');
  var lang = saved === 'es' || saved === 'en'
    ? saved
    : (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es');
  document.documentElement.lang = lang;
})();
