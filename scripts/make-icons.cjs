// Renders the install icons (PNG) from the HydroStab mark (docs/brand/logo-a2/a2-symbol-colour.svg).
// Run after changing the logo:  node scripts/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mark = fs.readFileSync(path.join(root, 'docs/brand/logo-a2/a2-symbol-colour.svg'), 'utf8');
const out = (n) => path.join(root, 'public', n);
const PAPER = '#E7EBE5';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  // full-bleed square tile (the system rounds the corners); 'fill' = share of the tile the mark's 256 box takes
  const shot = async (size, fill, file) => {
    await p.setViewportSize({ width: size, height: size });
    const s = Math.round(size * fill);
    await p.setContent(`<html><body style="margin:0;background:${PAPER};display:grid;place-items:center;width:${size}px;height:${size}px">
      ${mark.replace('<svg', `<svg width="${s}" height="${s}"`)}</body></html>`);
    await p.screenshot({ path: out(file) });
  };
  await shot(192, 0.86, 'pwa-192.png');
  await shot(512, 0.86, 'pwa-512.png');
  await shot(512, 0.66, 'pwa-maskable-512.png'); // inside the safe zone for round / squircle masks
  await shot(180, 0.82, 'apple-touch-icon.png');
  await b.close();
  console.log('icons written');
})();
