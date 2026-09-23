import * as THREE from 'three';
import { ImageItem, RenderableItem } from './types.js';
import { resolveAssetUrl } from '../utils/assets.js';
import { loadAssetChunks, ChunkProgressCallback, LoadedChunkAsset } from '../utils/chunk-loader.js';

export async function createImageItem(
  item: ImageItem,
  onProgress?: ChunkProgressCallback
): Promise<RenderableItem> {
  const imageUrl = resolveAssetUrl(item.src);
  let chunkAsset: LoadedChunkAsset | null = null;
  let targetUrl = imageUrl;

  try {
    chunkAsset = await loadAssetChunks(imageUrl, onProgress);
    targetUrl = chunkAsset.blobUrl;
  } catch (err) {
    console.warn(`[item-image] Chunk streaming fallback for '${imageUrl}':`, err);
  }

  const loader = new THREE.TextureLoader();
  const texture = await new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      targetUrl,
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
      if (chunkAsset) chunkAsset.dispose();
    }
  };
}
