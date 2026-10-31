import sharp from 'sharp';
const svg = await (await import('node:fs/promises')).readFile('public/icon.svg');
await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
// maskable: full-bleed background with the mark inside the safe zone
const inner = await sharp(svg).resize(380, 380).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#1F3A31' } }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512.png');
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#E9EDE7"/></svg>`);
const mark = await sharp(svg).resize(300, 300).png().toBuffer();
await sharp(og).composite([{ input: mark, gravity: 'center' }]).png().toFile('public/og.png');
console.log('icons ok');
