import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAssetUrl } from '../src/utils/assets.js';

describe('Asset URL Resolution', () => {
  it('resolves root paths correctly when BASE_URL is set to /', () => {
    // Default BASE_URL in test runner is '/'
    expect(resolveAssetUrl('/content/assets/sample-model.glb')).toBe('/content/assets/sample-model.glb');
    expect(resolveAssetUrl('sample-target.png')).toBe('/sample-target.png');
    expect(resolveAssetUrl('/sw.js')).toBe('/sw.js');
  });

  it('preserves external and data/blob URLs untouched', () => {
    expect(resolveAssetUrl('https://example.com/model.glb')).toBe('https://example.com/model.glb');
    expect(resolveAssetUrl('http://cdn.org/video.mp4')).toBe('http://cdn.org/video.mp4');
    expect(resolveAssetUrl('blob:http://localhost/1234')).toBe('blob:http://localhost/1234');
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('handles empty input gracefully', () => {
    expect(resolveAssetUrl('')).toBe('');
  });
});
