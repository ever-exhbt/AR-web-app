import * as THREE from 'three';
import { mindFile, targets, getTargetIndex } from 'virtual:ar-targets';
import experiencesData from '../../content/experiences.json';
import { TargetExperience } from '../content/types.js';
import { ExperienceManager, LoadedExperience } from '../content/experience-manager.js';
import { ScreenController } from '../ui/screens.js';
import { resolveAssetUrl } from '../utils/assets.js';

const experiences = experiencesData as Record<string, TargetExperience>;

export async function startCameraAR(
  container: HTMLElement,
  screens: ScreenController,
  onFpsUpdate: (fps: number) => void,
  onTargetChange: (targetId: string, anchorIndex: number) => void
) {
  screens.setStatus('LOADING ENGINE...', 'scanning');

  // Dynamic import MindAR (lazy chunk)
  // @ts-ignore
  const { MindARThree } = await import('mind-ar/dist/mindar-image-three.prod.js');

  screens.setStatus('REQUESTING CAMERA...', 'scanning');
  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: resolveAssetUrl(mindFile),
    maxTrack: 1,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no'
  });

  const { renderer, scene, camera } = mindarThree;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(2, 4, 3);
  scene.add(dirLight);

  const activeLoadedExperiences: Map<string, LoadedExperience> = new Map();

  const experienceManager = new ExperienceManager(experiences, {
    maxCacheSize: 3,
    onTimeMeasured: (targetId, timeMs) => {
      console.log(`[Metrics] Time-to-first-content for '${targetId}': ${timeMs}ms`);
    }
  });

  let currentTrackedTarget: string | null = null;
  let isTabHidden = false;

  // Tab visibility listener
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isTabHidden = true;
      activeLoadedExperiences.forEach((exp) => exp.pause());
    } else {
      isTabHidden = false;
      if (currentTrackedTarget) {
        const exp = activeLoadedExperiences.get(currentTrackedTarget);
        exp?.play();
      }
    }
  });

  // Dynamically register anchors from virtual:ar-targets
  for (const target of targets) {
    const anchorIndex = getTargetIndex(target.id);
    if (anchorIndex === -1) continue;

    const anchor = mindarThree.addAnchor(anchorIndex);
    const expConfig = experiences[target.id];

    anchor.onTargetFound = async () => {
      currentTrackedTarget = target.id;
      // 100% full-bleed camera feed immersion
      screens.showFound(
        expConfig?.infoCard?.heading || `Ever WebAR: ${target.id}`,
        expConfig?.infoCard?.body || `Anchor #${anchorIndex} locked. 3D augmentation active.`
      );
      onTargetChange(target.id, anchorIndex);

      // Strict per-target lazy loading + progressive reveal
      const loadedExp = await experienceManager.loadTargetExperience(target.id, anchor.group);
      activeLoadedExperiences.set(target.id, loadedExp);
    };

    anchor.onTargetLost = () => {
      if (currentTrackedTarget === target.id) {
        currentTrackedTarget = null;
      }
      screens.showLost();

      const loadedExp = activeLoadedExperiences.get(target.id);
      if (loadedExp) {
        loadedExp.pause();
      }
    };
  }

  // FPS Tracker
  let frameCount = 0;
  let lastFpsTime = performance.now();

  // Render loop
  let lastTime = performance.now();
  renderer.setAnimationLoop(() => {
    if (isTabHidden) return;

    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    activeLoadedExperiences.forEach((exp) => exp.update(delta));
    renderer.render(scene, camera);

    frameCount++;
    if (now - lastFpsTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      onFpsUpdate(fps);
      frameCount = 0;
      lastFpsTime = now;
    }
  });

  // Start AR Session
  await mindarThree.start();
  screens.setStatus('SCANNING...', 'scanning');
}
