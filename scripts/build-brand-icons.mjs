import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(await readFile(resolve(root, 'branding/brand.json'), 'utf8'));
const { colors: c, mark: m } = brand;
const paths = (body, accent = body) => `<path d="${m.body}" fill="${body}"/><path d="${m.accent}" fill="${accent}"/>`;
const symbol = (outline, pulse) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.viewBox}">${paths(outline, pulse)}</svg>\n`;
const tile = (maskable = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><rect width="64" height="64" rx="${maskable ? 0 : 12}" fill="${c.ink}"/><g transform="translate(${maskable ? 8 : 2} ${maskable ? 8 : 2}) scale(${maskable ? 2 : 2.5})">${paths(c.paper, c.accent)}</g></svg>\n`;
const write = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); };
const raster = async (svg, size, path) => write(path, await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer());
const assets = resolve(root, 'branding/assets');
const type = JSON.parse(await readFile(resolve(root, 'branding/type-paths.json'), 'utf8'));
const outlinedText = (text, x, baseline, size, color) => `<g fill="${color}" transform="translate(${x} ${baseline}) scale(${size / type.unitsPerEm} ${-size / type.unitsPerEm})">${type.text[text].paths}</g>`;
const wordmarkWidth = 42 + type.text[brand.name].width * 24 / type.unitsPerEm;
const lockup = (dark = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${wordmarkWidth}" height="40" viewBox="0 0 ${wordmarkWidth} 40"><g transform="translate(0 4) scale(1.333333)">${paths(dark ? c.paper : c.ink, dark ? c.accentOnDark : c.accentText)}</g>${outlinedText(brand.name, 42, 29, 24, dark ? c.paper : c.ink)}</svg>\n`;
await write(resolve(assets, 'logo.svg'), lockup());
await write(resolve(assets, 'logo-on-dark.svg'), lockup(true));
await raster(tile(), 256, resolve(assets, 'extension-icon-256.png'));
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${c.paper}"/><g transform="translate(64 56) scale(1.4)">${lockup().replace(/<\/?svg[^>]*>/g, '')}</g>${outlinedText('FHIR selbst', 64, 275, 76, c.ink)}${outlinedText('verstehen und prüfen.', 64, 370, 76, c.accentText)}<g transform="translate(936 191) scale(3.5)">${tile().replace(/<\/?svg[^>]*>/g, '')}</g><path d="M64 512H1136" stroke="${c.mist}" stroke-width="2"/>${outlinedText('Web · VS Code · Open Source', 64, 565, 22, c.ink)}</svg>`;
await write(resolve(assets, 'social.svg'), social);
await write(resolve(assets, 'social.png'), await sharp(Buffer.from(social)).png().toBuffer());

await write(resolve(assets, 'icon.svg'), tile());
await write(resolve(assets, 'mark.svg'), symbol(c.ink, c.accentText));
await write(resolve(assets, 'mark-on-dark.svg'), symbol(c.paper, c.accentOnDark));
await write(resolve(assets, 'mark-mono.svg'), symbol(c.ink));
await write(resolve(assets, 'activity-bar.svg'), symbol(c.paper));
for (const size of [16, 32, 48, 192, 512]) await raster(tile(), size, resolve(assets, `icon-${size}.png`));
await raster(tile(true), 180, resolve(assets, 'apple-icon.png'));
await raster(tile(true), 512, resolve(assets, 'icon-maskable-512.png'));

// PNG-compressed ICO entries: small browser sizes plus a high-resolution fallback.
const sizes = [16, 32, 48, 256];
const images = await Promise.all(sizes.map(size => sharp(Buffer.from(tile())).resize(size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i] % 256; header[entry + 1] = sizes[i] % 256;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await write(resolve(assets, 'favicon.ico'), Buffer.concat([header, ...images]));

const media = resolve(root, 'apps/vscode/media');
for (const [target, source] of [['brand.svg','icon.svg'], ['icon.png','icon-512.png'], ['activity-bar.svg','activity-bar.svg']]) await copyFile(resolve(assets, source), resolve(media, target));
await write(resolve(media, 'package-light.svg'), symbol(c.ink, c.accentText));
await write(resolve(media, 'package-dark.svg'), symbol(c.paper, c.accentOnDark));
const web = resolve(root, 'apps/web');
await mkdir(resolve(web, 'public/brand'), { recursive: true });
await copyFile(resolve(root, 'branding/brand.css'), resolve(web, 'app/brand.css'));
for (const name of ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'logo.svg', 'logo-on-dark.svg', 'social.png']) await copyFile(resolve(assets, name), resolve(web, 'public/brand', name));
for (const [target, source] of [['icon.png','icon-512.png'], ['apple-icon.png','apple-icon.png'], ['favicon.ico','favicon.ico']]) await copyFile(resolve(assets, source), resolve(web, 'app', target));

// The shared React mark also comes from the source geometry, including VS Code webviews.
await write(resolve(root, 'packages/ui/src/brand/BrandMark.tsx'), `// Generated by scripts/build-brand-icons.mjs. Edit branding/brand.json.\nimport type { SVGProps } from "react";\n\nexport function BrandMark(props: SVGProps<SVGSVGElement>) {\n  return <svg viewBox="${m.viewBox}" fill="none" aria-hidden="true" {...props}><path d="${m.body}" fill="currentColor" /><path d="${m.accent}" fill="var(--fhir-brand-accent, ${c.accentText})" /></svg>;\n}\n\nexport function BrandLogo() {\n  return <span className="fhir-brand-lockup"><BrandMark className="fhir-brand-mark" /><span>FHIR-Explorer</span></span>;\n}\n`);

const marketingFlag = process.argv.indexOf('--marketing');
if (marketingFlag !== -1) {
  if (!process.argv[marketingFlag + 1]) throw new Error('--marketing requires the marketing repository path');
  const marketing = resolve(process.argv[marketingFlag + 1]);
  const publicBrand = resolve(marketing, 'public/brand');
  await mkdir(publicBrand, { recursive: true });
  for (const name of ['icon.svg', 'logo.svg', 'logo-on-dark.svg', 'mark.svg', 'mark-on-dark.svg', 'mark-mono.svg', 'icon-16.png', 'icon-32.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) await copyFile(resolve(assets, name), resolve(publicBrand, name));
  await copyFile(resolve(assets, 'icon.svg'), resolve(marketing, 'public/icon.svg'));
  await copyFile(resolve(assets, 'social.png'), resolve(marketing, 'public/og.png'));
  await copyFile(resolve(assets, 'favicon.ico'), resolve(marketing, 'app/favicon.ico'));
  await copyFile(resolve(assets, 'apple-icon.png'), resolve(marketing, 'app/apple-icon.png'));
  await write(resolve(publicBrand, 'brand.json'), JSON.stringify(brand, null, 2) + '\n');
  await copyFile(resolve(root, 'packages/ui/src/brand/BrandMark.tsx'), resolve(marketing, 'components/brand-logo.tsx'));
  await copyFile(resolve(root, 'branding/brand.css'), resolve(marketing, 'app/brand.css'));
  // The preview uses the same licensed font as the approved website wordmark.
  await mkdir(resolve(root, 'branding/fonts'), { recursive: true });
  for (const name of ['Archivo-700-latin.woff2', 'Archivo-OFL.txt']) {
    await copyFile(resolve(marketing, 'public/fonts/brand', name), resolve(root, 'branding/fonts', name));
    await mkdir(resolve(web, 'public/fonts/brand'), { recursive: true });
    await copyFile(resolve(marketing, 'public/fonts/brand', name), resolve(web, 'public/fonts/brand', name));
  }
}
console.log('Brand assets generated from branding/brand.json.');
