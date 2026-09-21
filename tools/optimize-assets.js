import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Asset optimization utility for Ever WebAR
 * Optimizes videos with +faststart and compresses images to WebP.
 */

const ASSETS_DIR = path.resolve('content/assets');

console.log('=== Ever WebAR Asset Optimizer ===');

if (!fs.existsSync(ASSETS_DIR)) {
  console.log('No content/assets directory found.');
  process.exit(0);
}

const files = fs.readdirSync(ASSETS_DIR);

// 1. Optimize MP4 Videos
const mp4Files = files.filter(f => f.endsWith('.mp4') && !f.includes('.optimized.'));
for (const file of mp4Files) {
  const inputPath = path.join(ASSETS_DIR, file);
  const tempPath = path.join(ASSETS_DIR, `temp-${file}`);

  console.log(`[optimize] Processing video: ${file}`);
  try {
    // Faststart ensures the moov atom is at the beginning for instant mobile streaming
    const cmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an "${tempPath}"`;
    execSync(cmd, { stdio: 'ignore' });
    fs.unlinkSync(inputPath);
    fs.renameSync(tempPath, inputPath);
    const sizeKB = (fs.statSync(inputPath).size / 1024).toFixed(1);
    console.log(`[optimize] Optimized ${file} (+faststart, size: ${sizeKB} KB)`);
  } catch (err) {
    console.warn(`[optimize] Could not optimize ${file} with ffmpeg: ${err}`);
  }
}

console.log('\nOptimization complete.');
