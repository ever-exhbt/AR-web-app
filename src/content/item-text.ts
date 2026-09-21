import * as THREE from 'three';
import { TextItem, RenderableItem } from './types.js';

export function createTextItem(item: TextItem): RenderableItem {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context for text');

  const text = item.text || '';
  const fontSize = item.fontSize || 36;
  const textColor = item.color || '#ffffff';
  const bgColor = item.backgroundColor || 'rgba(13, 17, 23, 0.85)';
  const alignment = item.align || 'center';

  // HiDPI scale factor for crisp text on mobile
  const scaleFactor = 2;
  ctx.font = `600 ${fontSize * scaleFactor}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const paddingX = 24 * scaleFactor;
  const paddingY = 16 * scaleFactor;

  canvas.width = Math.max(textWidth + paddingX * 2, 256);
  canvas.height = (fontSize * scaleFactor) + paddingY * 2;

  // Re-apply font after resizing canvas
  ctx.font = `600 ${fontSize * scaleFactor}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';

  // Draw rounded pill background
  ctx.fillStyle = bgColor;
  const radius = 12 * scaleFactor;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = 'rgba(240, 246, 252, 0.15)';
  ctx.lineWidth = 2 * scaleFactor;
  ctx.stroke();

  // Draw text
  ctx.fillStyle = textColor;
  let textX = canvas.width / 2;
  if (alignment === 'left') {
    ctx.textAlign = 'left';
    textX = paddingX;
  } else if (alignment === 'right') {
    ctx.textAlign = 'right';
    textX = canvas.width - paddingX;
  } else {
    ctx.textAlign = 'center';
  }
  ctx.fillText(text, textX, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const targetWidth = item.width !== undefined ? item.width : 0.8;
  const aspect = canvas.height / canvas.width;
  const planeHeight = targetWidth * aspect;

  const geometry = new THREE.PlaneGeometry(targetWidth, planeHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
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
