// Baut aus der lesbaren Quelle (src) die veröffentlichte, unleserliche index.html (out)
// Aufruf: node build.js <quelle/index.html> <ziel/index.html>
const fs = require('fs');
const JO = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');

const [src, out] = process.argv.slice(2);
const BANNER = "/* (c) 2026 Dennis Hermann, Hermann's Repair, Bremen. Alle Rechte vorbehalten. Nutzung, Kopie oder Weitergabe nur mit schriftlicher Erlaubnis. */\n";

(async () => {
  let html = fs.readFileSync(src, 'utf8');
  let n = 0;
  html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => {
    n++;
    const ob = JO.obfuscate(code, {
      compact: true, target: 'browser', seed: 7,
      identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
      stringArray: true, stringArrayThreshold: 0.8, stringArrayRotate: true, stringArrayShuffle: true,
      stringArrayWrappersCount: 1, stringArrayEncoding: [],
      controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false,
      transformObjectKeys: false, unicodeEscapeSequence: false, numbersToExpressions: false,
      splitStrings: false, simplify: true
    }).getObfuscatedCode();
    return '<script>' + BANNER + ob.replace(/<\/script/gi, '<\\/script') + '</script>';
  });
  html = await minify(html, { collapseWhitespace: true, conservativeCollapse: true, removeComments: true, minifyCSS: true, minifyJS: false, keepClosingSlash: true });
  html = html.replace('<head>', "<head><!-- (c) 2026 Dennis Hermann, Hermann's Repair. Alle Rechte vorbehalten. -->");
  fs.writeFileSync(out, html);
  console.log(`ok: ${n} Skript(e), ${fs.statSync(src).size} -> ${fs.statSync(out).size} Bytes`);
})().catch(e => { console.error(e); process.exit(1); });
