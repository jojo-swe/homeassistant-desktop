const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
const outDir = path.join(__dirname, '..', 'assets');

async function generate() {
  // Generate favicon.png (32x32)
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(outDir, 'favicon.png'));
  console.log('Generated favicon.png (32x32)');

  // Generate IconWin.png (16x16) and IconWin@2x.png (32x32)
  await sharp(svgPath)
    .resize(16, 16)
    .png()
    .toFile(path.join(outDir, 'IconWin.png'));
  console.log('Generated IconWin.png (16x16)');

  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(outDir, 'IconWin@2x.png'));
  console.log('Generated IconWin@2x.png (32x32)');

  // Generate macOS template icons (monochrome)
  const templateSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <path d="M256 120 L376 200 L376 360 L336 360 L336 224 L256 168 L176 224 L176 360 L136 360 L136 200 Z" fill="black"/>
      <rect x="232" y="280" width="48" height="80" rx="4" fill="black"/>
    </svg>`
  );

  await sharp(templateSvg)
    .resize(16, 16)
    .png()
    .toFile(path.join(outDir, 'IconTemplate.png'));
  console.log('Generated IconTemplate.png (16x16)');

  await sharp(templateSvg)
    .resize(32, 32)
    .png()
    .toFile(path.join(outDir, 'IconTemplate@2x.png'));
  console.log('Generated IconTemplate@2x.png (32x32)');

  // Generate large icon for packaging (512x512)
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(path.join(outDir, 'icon.png'));
  console.log('Generated icon.png (512x512)');

  console.log('All icons generated successfully.');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
