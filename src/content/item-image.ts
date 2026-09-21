import * as THREE from 'three';
import { ImageItem, RenderableItem } from './types.js';
import { resolveAssetUrl } from '../utils/assets.js';

export async function createImageItem(item: ImageItem): Promise<RenderableItem> {
  const loader = new THREE.TextureLoader();
  const imageUrl = resolveAssetUrl(item.src);

  const texture = await new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      (err) => reject(new Error(`Failed to load image at '${imageUrl}': ${err}`))
    );
  });

  const img = texture.image;
  const imageAspect = (img && img.naturalHeight && img.naturalWidth)
    ? img.naturalHeight / img.naturalWidth
    : 1;

  const targetWidth = item.width !== undefined ? item.width : 0.8;
  const planeHeight = targetWidth * imageAspect;

  const geometry = new THREE.PlaneGeometry(targetWidth, planeHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Apply transforms
  if (item.position) mesh.position.set(item.position[0], item.position[1], item.position[2]);
  if (item.rotation) {
    mesh.rotation.set(
      THREE.MathUtils.degToRad(item.rotation[0]),
      THREE.MathUtils.degToRad(item.rotation[1]),
      THREE.MathUtils.degToRad(item.rotation[2])
    );
  }
  if (item.scale) {
    if (typeof item.scale === 'number') mesh.scale.setScalar(item.scale);
    else mesh.scale.set(item.scale[0], item.scale[1], item.scale[2]);
  }

  return {
    object3d: mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}
