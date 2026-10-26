// Generates every app icon from the logo mark. Run: npm run icons
//   iOS:     one 1024x1024 PNG (iOS rounds the corners itself, so no transparency and no corners)
//   Android: legacy square + round icons for old phones, plus an adaptive icon
//            (foreground mark on a green background) for Android 8+ and themed icons for 13+.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const GREEN = '#1D5C4C';
const root = path.resolve(import.meta.dirname, '..');

// Same geometry as src/components/Logo.tsx: two open arcs and a dot, in a 100x100 box.
const arc = (r, gap = 40) => {
  const a = (gap * Math.PI) / 180;
  const x = (50 + r * Math.cos(a)).toFixed(2);
  return `M ${x} ${(50 - r * Math.sin(a)).toFixed(2)} A ${r} ${r} 0 1 0 ${x} ${(50 + r * Math.sin(a)).toFixed(2)}`;
};
const mark = (color) => `
  <path d="${arc(38)}" stroke="${color}" stroke-width="9" stroke-linecap="round" fill="none"/>
  <path d="${arc(21)}" stroke="${color}" stroke-width="9" stroke-linecap="round" fill="none" opacity="0.7"/>
  <circle cx="52" cy="50" r="5.5" fill="${color}"/>`;

/** The mark centered on a square canvas. `width` is how many canvas pixels the mark should span. */
const centered = (size, width, color) => {
  const scale = width / 91; // the mark is about 91 units wide
  // +4 shifts it right so the whole shape (open on the right) looks centered
  return `<g transform="translate(${size / 2} ${size / 2}) scale(${scale}) translate(-50 -50) translate(4 0)">${mark(color)}</g>`;
};

const svg = (size, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`);
const png = async (file, buf, size) => {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(buf).resize(size, size).png().toFile(file);
};

// Source image kept in the repo (open it in a browser to preview).
const SOURCE = `<rect width="1024" height="1024" fill="${GREEN}"/>${centered(1024, 560, '#FFFFFF')}`;
await writeFile(path.join(root, 'assets/app-icon.svg'), svg(1024, SOURCE));

// ── iOS ──
const iosDir = path.join(root, 'ios/CoachConnect/Images.xcassets/AppIcon.appiconset');
await sharp(svg(1024, SOURCE)).flatten({ background: GREEN }).removeAlpha().png().toFile(path.join(iosDir, 'AppIcon-1024.png'));
await writeFile(
  path.join(iosDir, 'Contents.json'),
  JSON.stringify({ images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
);

// ── Android ──
const res = path.join(root, 'android/app/src/main/res');
const density = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, mult] of Object.entries(density)) {
  const dir = path.join(res, `mipmap-${name}`);
  const legacy = Math.round(48 * mult);
  const adaptive = Math.round(108 * mult);
  const S = 512; // draw big, shrink for sharp edges
  // legacy square icon (rounded corners) and round icon
  await png(path.join(dir, 'ic_launcher.png'), svg(S, `<rect width="${S}" height="${S}" rx="${S * 0.2}" fill="${GREEN}"/>${centered(S, S * 0.56, '#FFFFFF')}`), legacy);
  await png(path.join(dir, 'ic_launcher_round.png'), svg(S, `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="${GREEN}"/>${centered(S, S * 0.52, '#FFFFFF')}`), legacy);
  // adaptive foreground: transparent, mark must stay inside the central 61% (the "safe zone")
  await png(path.join(dir, 'ic_launcher_foreground.png'), svg(S, centered(S, S * 0.5, '#FFFFFF')), adaptive);
}
await mkdir(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
await writeFile(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptiveXml);
await writeFile(path.join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptiveXml);
await writeFile(
  path.join(res, 'values/colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Coach Connect green (same as theme.colors.primary) -->
    <color name="launch_background">${GREEN}</color>
    <color name="ic_launcher_background">${GREEN}</color>
</resources>
`,
);
console.log('Icons written: assets/app-icon.svg, iOS AppIcon-1024.png, Android mipmaps + adaptive icon');
