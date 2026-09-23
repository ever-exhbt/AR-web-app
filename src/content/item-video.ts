import * as THREE from 'three';
import { VideoItem, RenderableItem } from './types.js';
import { resolveAssetUrl } from '../utils/assets.js';
import { loadAssetChunks, ChunkProgressCallback, LoadedChunkAsset } from '../utils/chunk-loader.js';

export async function createVideoItem(
  item: VideoItem,
  onProgress?: ChunkProgressCallback
): Promise<RenderableItem> {
  const group = new THREE.Group();
  const rawVideoUrl = resolveAssetUrl(item.src);

  // 1. Download all chunks of the target video asset first
  let chunkAsset: LoadedChunkAsset | null = null;
  let videoSrc = rawVideoUrl;

  try {
    chunkAsset = await loadAssetChunks(rawVideoUrl, onProgress);
    videoSrc = chunkAsset.blobUrl;
  } catch (err) {
    console.warn(`[item-video] Chunk streaming fallback for '${rawVideoUrl}':`, err);
  }

  // Create video element
  const video = document.createElement('video');
  video.src = videoSrc;
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.muted = true;
  video.loop = item.loop !== false;
  video.preload = 'auto'; // Load for detected target only

  // Video Texture
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const targetWidth = item.width !== undefined ? item.width : 0.8;
  let aspect = 9 / 16; // default fallback aspect

  const planeGeo = new THREE.PlaneGeometry(targetWidth, targetWidth * aspect);
  const videoMat = new THREE.MeshBasicMaterial({
    map: videoTexture,
    transparent: true
  });
  const planeMesh = new THREE.Mesh(planeGeo, videoMat);
  group.add(planeMesh);

  // If poster is provided, load poster texture for instant visual
  let posterTexture: THREE.Texture | null = null;
  let posterMesh: THREE.Mesh | null = null;
  if (item.poster) {
    const texLoader = new THREE.TextureLoader();
    posterTexture = await new Promise<THREE.Texture>((resolve) => {
      texLoader.load(resolveAssetUrl(item.poster!), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      });
    });
    const posterMat = new THREE.MeshBasicMaterial({ map: posterTexture, transparent: true });
    posterMesh = new THREE.Mesh(planeGeo, posterMat);
    posterMesh.position.z = 0.001; // Slightly in front until video starts playing
    group.add(posterMesh);
  }

  // Once video metadata arrives, adjust geometry aspect ratio
  video.addEventListener('loadedmetadata', () => {
    if (video.videoWidth && video.videoHeight) {
      aspect = video.videoHeight / video.videoWidth;
      planeMesh.geometry.dispose();
      planeMesh.geometry = new THREE.PlaneGeometry(targetWidth, targetWidth * aspect);
      if (posterMesh) {
        posterMesh.geometry = planeMesh.geometry;
      }
    }
  });

  // Wait for initial video frame data so the video texture is ready
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      let resolved = false;
      const onReady = () => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onReady);
        resolve();
      };
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
      video.addEventListener('error', onReady);
      setTimeout(onReady, 2500);
    });
  }

  // When playback starts, hide poster
  video.addEventListener('playing', () => {
    if (posterMesh) {
      posterMesh.visible = false;
    }
  });

  // Apply transforms
  if (item.position) group.position.set(item.position[0], item.position[1], item.position[2]);
  if (item.rotation) {
    group.rotation.set(
      THREE.MathUtils.degToRad(item.rotation[0]),
      THREE.MathUtils.degToRad(item.rotation[1]),
      THREE.MathUtils.degToRad(item.rotation[2])
    );
  }
  if (item.scale) {
    if (typeof item.scale === 'number') group.scale.setScalar(item.scale);
    else group.scale.set(item.scale[0], item.scale[1], item.scale[2]);
  }

  return {
    object3d: group,
    play: () => {
      video.play().catch(() => {
        // Handle browser autoplay policy if needed
      });
    },
    pause: () => {
      video.pause();
    },
    dispose: () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      planeMesh.geometry.dispose();
      videoMat.dispose();
      videoTexture.dispose();
      if (posterTexture) posterTexture.dispose();
      if (chunkAsset) chunkAsset.dispose();
    }
  };
}
