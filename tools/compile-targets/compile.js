import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createCanvas, loadImage } from 'canvas';
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';

export const COMPILER_VERSION = '1.2.5';
export const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * Validates slug safety (lowercase letters, numbers, hyphens)
 */
export function isSlugSafe(id) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

/**
 * Scans targets directory, validates filenames, and sorts alphabetically for deterministic order.
 */
export function scanTargets(targetsDir = path.resolve('targets')) {
  if (!fs.existsSync(targetsDir)) {
    return [];
  }
  const files = fs.readdirSync(targetsDir);
  const targetFiles = files.filter(f => VALID_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  // Deterministic alphabetical sorting by filename stem
  targetFiles.sort((a, b) => {
    const stemA = path.basename(a, path.extname(a)).toLowerCase();
    const stemB = path.basename(b, path.extname(b)).toLowerCase();
    return stemA.localeCompare(stemB);
  });

  return targetFiles.map(file => {
    const fullPath = path.join(targetsDir, file);
    const ext = path.extname(file);
    const id = path.basename(file, ext);
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
    return {
      id,
      filename: file,
      fullPath,
      hash
    };
  });
}

/**
 * Validates targets against experiences.json and checks image constraints.
 */
export function validateTargets(
  targets,
  experiencesPath = path.resolve('content/experiences.json')
) {
  const errors = [];
  const warnings = [];
  const idSet = new Set();

  // 1. Check for ID collisions and slug safety
  for (const target of targets) {
    if (idSet.has(target.id)) {
      errors.push(`Target ID collision detected: duplicate ID '${target.id}'. Filenames must have unique stems.`);
    }
    idSet.add(target.id);

    if (!isSlugSafe(target.id)) {
      warnings.push(`Target ID '${target.id}' is not slug-safe. Use lowercase alphanumeric characters and hyphens only.`);
    }
  }

  // 2. Check experiences.json cross-reference
  if (fs.existsSync(experiencesPath)) {
    try {
      const expContent = fs.readFileSync(experiencesPath, 'utf8');
      const experiences = JSON.parse(expContent);
      const expIds = Object.keys(experiences);

      // Check for entries in experiences.json with no matching image
      for (const expId of expIds) {
        if (!idSet.has(expId)) {
          errors.push(`Entry '${expId}' in experiences.json has no matching tracking image in targets/.`);
        }
      }

      // Check for targets with no entry in experiences.json
      for (const target of targets) {
        if (!expIds.includes(target.id)) {
          warnings.push(`Target '${target.id}' has no entry in experiences.json. It will be compiled, but display nothing in production.`);
        }
      }
    } catch (err) {
      warnings.push(`Could not read experiences.json: ${err.message}`);
    }
  }

  // 3. Large collection warning
  if (targets.length > 10) {
    warnings.push(
      `Large target count (${targets.length} targets). Note that .mind bundle size grows linearly with target count, impacting mobile initial load time.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Prints clear, actionable validation messages and tips
 */
export function printValidationReport(report) {
  if (report.warnings.length > 0) {
    console.warn('\n[compile-targets] WARNINGS:');
    report.warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  }
  if (report.errors.length > 0) {
    console.error('\n[compile-targets] ERRORS:');
    report.errors.forEach(e => console.error(`  ✖ ${e}`));
  }
  if (report.warnings.length > 0 || report.errors.length > 0) {
    console.log('\n[compile-targets] TIP FOR BEST AR TRACKING:');
    console.log('  • High local contrast and sharp geometric corners produce the strongest feature anchors.');
    console.log('  • Avoid repetitive patterns, large blank/solid color zones, or glossy reflections.');
    console.log('  • Ensure target short dimension is at least 500px for robust feature detection.\n');
  }
}

/**
 * Generates combined content hash
 */
export function computeCombinedHash(targets) {
  return crypto
    .createHash('sha256')
    .update(`v=${COMPILER_VERSION}|` + targets.map(t => `${t.id}:${t.hash}`).join('|'))
    .digest('hex')
    .slice(0, 8);
}

/**
 * Compiles all targets into a single .mind file with incremental caching
 */
export async function compileTargets({
  targetsDir = path.resolve('targets'),
  outDir = path.resolve('public'),
  cacheDir = path.resolve('.cache/mind-targets'),
  experiencesPath = path.resolve('content/experiences.json'),
  force = false
} = {}) {
  const targets = scanTargets(targetsDir);
  if (targets.length === 0) {
    console.warn('[compile-targets] No tracking images found in', targetsDir);
    return null;
  }

  // Validate
  const validation = validateTargets(targets, experiencesPath);
  printValidationReport(validation);
  if (!validation.valid) {
    throw new Error(`[compile-targets] Target validation failed with ${validation.errors.length} error(s).`);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const combinedHash = computeCombinedHash(targets);
  const mindFilename = `targets.${combinedHash}.mind`;
  const mindPath = path.join(outDir, mindFilename);
  const manifestPath = path.join(outDir, 'targets-manifest.json');
  const cacheFilePath = path.join(cacheDir, 'cache.json');

  // Check incremental cache
  if (!force && fs.existsSync(cacheFilePath) && fs.existsSync(mindPath)) {
    try {
      const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      if (cacheData.combinedHash === combinedHash && cacheData.mindFilename === mindFilename) {
        console.log(`[compile-targets] Cache hit: targets are up to date (${mindFilename}, hash: ${combinedHash}).`);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return { manifest, cached: true, mindFilename };
      }
    } catch {
      // Cache read error, proceed to compile
    }
  }

  console.log(`[compile-targets] Compiling ${targets.length} target(s): ${targets.map(t => t.id).join(', ')}...`);

  // Load and validate images
  const images = [];
  const targetManifestList = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const img = await loadImage(target.fullPath);
    if (Math.min(img.width, img.height) < 500) {
      console.warn(`[compile-targets] Warning: Target '${target.id}' is ${img.width}x${img.height} (< 500px on short edge). May track poorly.`);
    }

    images.push(img);
    targetManifestList.push({
      index: i,
      id: target.id,
      source: target.filename,
      width: img.width,
      height: img.height,
      hash: target.hash
    });
  }

  const startTime = Date.now();
  const compiler = new OfflineCompiler();
  await compiler.compileImageTargets(images, (progress) => {
    process.stdout.write(`\r[compile-targets] Progress: ${Math.round(progress)}%`);
  });
  console.log('');

  const buffer = compiler.exportData();

  // Clean up any old targets.*.mind in public/
  const existingFiles = fs.readdirSync(outDir);
  for (const file of existingFiles) {
    if (file.startsWith('targets.') && file.endsWith('.mind') && file !== mindFilename) {
      fs.unlinkSync(path.join(outDir, file));
    }
  }

  fs.writeFileSync(mindPath, Buffer.from(buffer));
  const mindSizeKB = (buffer.byteLength / 1024).toFixed(1);
  console.log(`[compile-targets] Created: ${mindFilename} (${mindSizeKB} KB) in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  const manifest = {
    mindFile: `/${mindFilename}`,
    targets: targetManifestList
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[compile-targets] Manifest written to ${manifestPath}`);

  // Write cache file
  fs.writeFileSync(
    cacheFilePath,
    JSON.stringify(
      {
        combinedHash,
        mindFilename,
        targets: targetManifestList,
        timestamp: Date.now()
      },
      null,
      2
    )
  );

  return { manifest, cached: false, mindFilename };
}

// CLI runner
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('compile')) {
  compileTargets().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
