import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  scanTargets,
  isSlugSafe,
  validateTargets,
  computeCombinedHash
} from '../tools/compile-targets/compile.js';


const TEST_DIR = path.resolve('tests/fixture-targets');
const TEST_EXP_PATH = path.resolve('tests/fixture-experiences.json');

describe('Target Pipeline & Manifest Generation', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(TEST_EXP_PATH)) {
      fs.unlinkSync(TEST_EXP_PATH);
    }
  });

  it('validates slug-safe target IDs correctly', () => {
    expect(isSlugSafe('spring-poster')).toBe(true);
    expect(isSlugSafe('business-card-01')).toBe(true);
    expect(isSlugSafe('sample-target')).toBe(true);

    // Invalid slug IDs
    expect(isSlugSafe('Spring-Poster')).toBe(false); // uppercase
    expect(isSlugSafe('business_card')).toBe(false);  // underscore
    expect(isSlugSafe('poster with spaces')).toBe(false);
    expect(isSlugSafe('poster!@#')).toBe(false);
  });

  it('scans and sorts targets alphabetically for deterministic ordering', () => {
    // Write out-of-order dummy target image files
    fs.writeFileSync(path.join(TEST_DIR, 'zebra-card.png'), 'fake-png-data-1');
    fs.writeFileSync(path.join(TEST_DIR, 'alpha-poster.jpg'), 'fake-jpg-data-2');
    fs.writeFileSync(path.join(TEST_DIR, 'beta-card.jpeg'), 'fake-jpeg-data-3');
    fs.writeFileSync(path.join(TEST_DIR, 'ignore-me.txt'), 'not-an-image');

    const targets = scanTargets(TEST_DIR);

    // Only valid image extensions should be scanned
    expect(targets.length).toBe(3);

    // Must be sorted alphabetically by filename stem
    expect(targets[0].id).toBe('alpha-poster');
    expect(targets[1].id).toBe('beta-card');
    expect(targets[2].id).toBe('zebra-card');

    // SHA-256 hashes must be generated and non-empty
    expect(targets[0].hash).toHaveLength(12);
    expect(targets[1].hash).toHaveLength(12);
    expect(targets[2].hash).toHaveLength(12);
  });

  it('detects duplicate ID collisions', () => {
    // If someone has card.png and card.jpg in targets/
    const mockTargets = [
      { id: 'card', filename: 'card.png', fullPath: '', hash: '123' },
      { id: 'card', filename: 'card.jpg', fullPath: '', hash: '456' }
    ];

    const report = validateTargets(mockTargets, TEST_EXP_PATH);
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.includes('collision'))).toBe(true);
  });

  it('reports error when an experience entry has no matching image', () => {
    const mockTargets = [
      { id: 'target-a', filename: 'target-a.png', fullPath: '', hash: '111' }
    ];

    fs.writeFileSync(
      TEST_EXP_PATH,
      JSON.stringify({
        'target-a': { title: 'Target A' },
        'missing-target-b': { title: 'Target B' } // missing in targets
      })
    );

    const report = validateTargets(mockTargets, TEST_EXP_PATH);
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.includes('missing-target-b'))).toBe(true);
  });

  it('reports warning when a target image has no matching experience entry', () => {
    const mockTargets = [
      { id: 'target-a', filename: 'target-a.png', fullPath: '', hash: '111' },
      { id: 'unconfigured-target', filename: 'unconfigured-target.png', fullPath: '', hash: '222' }
    ];

    fs.writeFileSync(
      TEST_EXP_PATH,
      JSON.stringify({
        'target-a': { title: 'Target A' }
      })
    );

    const report = validateTargets(mockTargets, TEST_EXP_PATH);
    expect(report.valid).toBe(true); // warnings do not invalidate build
    expect(report.warnings.some(w => w.includes('unconfigured-target'))).toBe(true);
  });

  it('computes deterministic combined hashes and invalidates on content change', () => {
    const targetsV1 = [
      { id: 'card-a', filename: 'card-a.png', fullPath: '', hash: 'abc123' },
      { id: 'card-b', filename: 'card-b.png', fullPath: '', hash: 'def456' }
    ];

    const hash1 = computeCombinedHash(targetsV1);
    const hash2 = computeCombinedHash(targetsV1);
    expect(hash1).toBe(hash2); // Deterministic

    // If one file changes content (hash changes):
    const targetsV2 = [
      { id: 'card-a', filename: 'card-a.png', fullPath: '', hash: 'abc999' },
      { id: 'card-b', filename: 'card-b.png', fullPath: '', hash: 'def456' }
    ];
    const hash3 = computeCombinedHash(targetsV2);
    expect(hash3).not.toBe(hash1); // Cache invalidated
  });

  it('resolves target index without hardcoding', () => {
    const manifest = {
      mindFile: '/targets.test.mind',
      targets: [
        { index: 0, id: 'business-card', source: 'business-card.png', width: 800, height: 600, hash: 'h1' },
        { index: 1, id: 'spring-poster', source: 'spring-poster.jpg', width: 1200, height: 1600, hash: 'h2' }
      ]
    };

    function getTargetIndex(id: string): number {
      const t = manifest.targets.find(item => item.id === id);
      return t ? t.index : -1;
    }

    expect(getTargetIndex('business-card')).toBe(0);
    expect(getTargetIndex('spring-poster')).toBe(1);
    expect(getTargetIndex('non-existent')).toBe(-1);
  });
});
