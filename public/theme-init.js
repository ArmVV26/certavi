// Runs before the page is drawn (a blocking <script> in index.html, an own file because the CSP
// forbids inline scripts): puts data-theme and data-mono on <html> from the saved settings, so the
// first frame already has the right colours, also in no-colour mode. The module script of the app
// (main.tsx) runs later, and initTheme() there does the same again.
// It repeats the logic of src/theme/theme.ts; src/theme/themeInit.test.ts keeps both in step.
// Plain old JavaScript: no build step touches this file.
(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem('certavi.theme');
    var dark =
      theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (localStorage.getItem('certavi.mono') === 'on') root.setAttribute('data-mono', '');
  } catch {
    // Storage or matchMedia not available: initTheme() applies the defaults once the app starts.
  }
})();
