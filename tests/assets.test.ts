import { describe, it, expect } from 'vitest';
import { resolveAssetUrl } from '../src/utils/assets.js';

describe('Asset URL Resolution', () => {
  it('resolves paths dynamically against active import.meta.env.BASE_URL', () => {
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;

    expect(resolveAssetUrl('/content/assets/sample-model.glb')).toBe(`${cleanBase}content/assets/sample-model.glb`);
    expect(resolveAssetUrl('sample-target.png')).toBe(`${cleanBase}sample-target.png`);
    expect(resolveAssetUrl('/sw.js')).toBe(`${cleanBase}sw.js`);
  });

  it('correctly formats URLs when base is root /', () => {
    expect(resolveAssetUrl('/content/assets/sample-model.glb', '/')).toBe('/content/assets/sample-model.glb');
    expect(resolveAssetUrl('sample-target.png', '/')).toBe('/sample-target.png');
    expect(resolveAssetUrl('/sw.js', '/')).toBe('/sw.js');
  });

  it('correctly formats URLs when base is GitHub Pages subpath /AR-web-app/', () => {
    expect(resolveAssetUrl('/content/assets/sample-model.glb', '/AR-web-app/')).toBe('/AR-web-app/content/assets/sample-model.glb');
    expect(resolveAssetUrl('sample-target.png', '/AR-web-app/')).toBe('/AR-web-app/sample-target.png');
    expect(resolveAssetUrl('/sw.js', '/AR-web-app/')).toBe('/AR-web-app/sw.js');
    expect(resolveAssetUrl('targets.mind', '/AR-web-app/')).toBe('/AR-web-app/targets.mind');
  });

  it('preserves external and data/blob URLs untouched regardless of base', () => {
    expect(resolveAssetUrl('https://example.com/model.glb')).toBe('https://example.com/model.glb');
    expect(resolveAssetUrl('http://cdn.org/video.mp4')).toBe('http://cdn.org/video.mp4');
    expect(resolveAssetUrl('blob:http://localhost/1234')).toBe('blob:http://localhost/1234');
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('handles empty input gracefully', () => {
    expect(resolveAssetUrl('')).toBe('');
  });
});
