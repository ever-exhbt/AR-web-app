import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelItem, RenderableItem } from './types.js';
import { resolveAssetUrl } from '../utils/assets.js';

let sharedLoader: GLTFLoader | null = null;

async function getGLTFLoader(): Promise<GLTFLoader> {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
    // Lazy Draco & meshopt support can be hooked if models require them
  }
  return sharedLoader;
}

export async function createModelItem(item: ModelItem): Promise<RenderableItem> {
  const loader = await getGLTFLoader();
  const modelUrl = resolveAssetUrl(item.src);

  const gltf = await new Promise<any>((resolve, reject) => {
    loader.load(
      modelUrl,
      (g) => resolve(g),
      undefined,
      (err) => reject(new Error(`Failed to load 3D model '${modelUrl}': ${err}`))
    );
  });

  const modelRoot = gltf.scene as THREE.Group;

  // Auto-fit model to target width
  const bbox = new THREE.Box3().setFromObject(modelRoot);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const targetFitScale = maxDim > 0 ? 1 / maxDim : 1;

  // User scale modifier
  const userScale = item.scale !== undefined ? item.scale : 1;
  const containerGroup = new THREE.Group();

  if (typeof userScale === 'number') {
    modelRoot.scale.setScalar(targetFitScale * userScale);
  } else {
    modelRoot.scale.set(
      targetFitScale * userScale[0],
      targetFitScale * userScale[1],
      targetFitScale * userScale[2]
    );
  }

  // Center model anchor origin
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  modelRoot.position.sub(center.multiply(modelRoot.scale));

  containerGroup.add(modelRoot);

  // Apply transforms to container
  if (item.position) {
    containerGroup.position.set(item.position[0], item.position[1], item.position[2]);
  }
  if (item.rotation) {
    containerGroup.rotation.set(
      THREE.MathUtils.degToRad(item.rotation[0]),
      THREE.MathUtils.degToRad(item.rotation[1]),
      THREE.MathUtils.degToRad(item.rotation[2])
    );
  }

  // Animation handling
  let mixer: THREE.AnimationMixer | null = null;
  let activeAction: THREE.AnimationAction | null = null;

  if (gltf.animations && gltf.animations.length > 0 && item.animation) {
    mixer = new THREE.AnimationMixer(modelRoot);
    let clip: THREE.AnimationClip | undefined;

    if (item.animation === 'auto') {
      clip = gltf.animations[0];
    } else {
      clip = gltf.animations.find((c: THREE.AnimationClip) => c.name === item.animation);
    }

    if (clip) {
      activeAction = mixer.clipAction(clip);
      activeAction.play();
    }
  }

  return {
    object3d: containerGroup,
    play: () => {
      if (activeAction) activeAction.paused = false;
    },
    pause: () => {
      if (activeAction) activeAction.paused = true;
    },
    update: (delta: number) => {
      if (mixer) mixer.update(delta);
    },
    dispose: () => {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(modelRoot);
      }
      modelRoot.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
    }
  };
}
