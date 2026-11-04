'use strict';

// Rebuild the settled iOS backdrop once, instead of blurring it on every mount.
// SHARP_MODULE_PATH may point to an existing Sharp installation outside the app.
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'aurora-atmosphere.png');
const destination = path.join(root, 'assets', 'aurora-atmosphere-soft.png');

function boxBlur(input, width, height, channels, boxSize) {
  const half = (boxSize - 1) / 2;
  const horizontal = new Uint32Array(input.length);
  const output = Buffer.allocUnsafe(input.length);
  const clamp = (value, max) => Math.max(0, Math.min(max - 1, value));

  for (let y = 0; y < height; y++) {
    for (let channel = 0; channel < channels; channel++) {
      let sum = 0;
      for (let offset = -half; offset <= half; offset++) sum += input[(y * width + clamp(offset, width)) * channels + channel];
      for (let x = 0; x < width; x++) {
        horizontal[(y * width + x) * channels + channel] = sum;
        sum += input[(y * width + clamp(x + half + 1, width)) * channels + channel]
          - input[(y * width + clamp(x - half, width)) * channels + channel];
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < channels; channel++) {
      let sum = 0;
      for (let offset = -half; offset <= half; offset++) sum += horizontal[(clamp(offset, height) * width + x) * channels + channel];
      for (let y = 0; y < height; y++) {
        output[(y * width + x) * channels + channel] = Math.round(sum / (boxSize * boxSize));
        sum += horizontal[(clamp(y + half + 1, height) * width + x) * channels + channel]
          - horizontal[(clamp(y - half, height) * width + x) * channels + channel];
      }
    }
  }
  return output;
}

async function main() {
  const {data, info} = await sharp(source).raw().toBuffer({resolveWithObject: true});
  // RCTImageBlurUtils uses three edge-extended box convolutions. The source is
  // bundled at scale 1, so the previous blurRadius=12 yields an 11-pixel kernel.
  const radius = 12;
  const boxSize = Math.floor((radius * 3 * Math.sqrt(2 * Math.PI) / 4 + .5) / 2) | 1;
  let result = data;
  for (let pass = 0; pass < 3; pass++) result = boxBlur(result, info.width, info.height, info.channels, boxSize);
  await sharp(result, {raw: {width: info.width, height: info.height, channels: info.channels}})
    .png({compressionLevel: 9}).toFile(destination);
  process.stdout.write(`Prepared ${info.width}x${info.height} backdrop with three ${boxSize}px box passes.\n`);
}

main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
