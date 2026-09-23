import * as THREE from 'three';
import { mindFile, targets, getTargetIndex } from 'virtual:ar-targets';
import experiencesData from '../../content/experiences.json';
import { TargetExperience } from '../content/types.js';
import { ExperienceManager, LoadedExperience } from '../content/experience-manager.js';
import { ScreenController } from '../ui/screens.js';
import { resolveAssetUrl } from '../utils/assets.js';

import { PoseStabilizer } from './pose-stabilizer.js';

const experiences = experiencesData as unknown as Record<string, TargetExperience>;

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
    uiError: 'no',
    // OneEuroFilter at CV tracking level (tames raw matrix jitter without lag)
    filterMinCF: 0.0005,
    filterBeta: 10,
    warmupTolerance: 5,
    missTolerance: 5
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

  interface StabilizedAnchor {
    anchor: any;
    presentationGroup: THREE.Group;
    stabilizer: PoseStabilizer;
  }

  const stabilizedAnchors: StabilizedAnchor[] = [];
  const _tempPos = new THREE.Vector3();
  const _tempQuat = new THREE.Quaternion();
  const _tempScale = new THREE.Vector3();

  // Dynamically register anchors from virtual:ar-targets
  for (const target of targets) {
    const anchorIndex = getTargetIndex(target.id);
    if (anchorIndex === -1) continue;

    const anchor = mindarThree.addAnchor(anchorIndex);
    const expConfig = experiences[target.id];

    // Smooth presentation group decoupled from discrete camera ticks
    const presentationGroup = new THREE.Group();
    presentationGroup.visible = false;
    scene.add(presentationGroup);

    const stabilizer = new PoseStabilizer({
      deadbandDist: 0.001,
      deadbandAngle: 0.12 * Math.PI / 180,
      posLerpSpeed: 25,
      rotLerpSpeed: 25,
      fastCatchupDist: 0.06,
      fastCatchupAngle: 8 * Math.PI / 180
    });

    stabilizedAnchors.push({ anchor, presentationGroup, stabilizer });

    anchor.onTargetFound = async () => {
      currentTrackedTarget = target.id;
      onTargetChange(target.id, anchorIndex);

      stabilizer.reset();
      presentationGroup.visible = true;

      const heading = expConfig?.infoCard?.heading || `Ever WebAR: ${target.id}`;
      const body = expConfig?.infoCard?.body || `Anchor #${anchorIndex} locked. 3D augmentation active.`;
      const isReady = experienceManager.hasTargetLoaded(target.id);

      // Show Found state (with loading spinner if assets are still buffering/downloading)
      screens.showFound(heading, body, isReady);

      // Strict per-target lazy loading + progressive reveal
      const loadedExp = await experienceManager.loadTargetExperience(
        target.id,
        presentationGroup,
        (_percent, message) => {
          if (currentTrackedTarget === target.id && !experienceManager.hasTargetLoaded(target.id)) {
            screens.showAssetLoading(message);
          }
        }
      );
      activeLoadedExperiences.set(target.id, loadedExp);

      // When all chunks in all target assets finish loading, transition UI to fully locked state
      loadedExp.whenLoaded.then(() => {
        if (currentTrackedTarget === target.id) {
          screens.showFound(heading, body, true);
        }
      });
    };

    anchor.onTargetLost = () => {
      if (currentTrackedTarget === target.id) {
        currentTrackedTarget = null;
      }
      screens.showLost();
      presentationGroup.visible = false;
      stabilizer.reset();

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

    // Continuous 60Hz pose stabilization (smooths discrete ~20Hz tracking judder)
    for (let i = 0; i < stabilizedAnchors.length; i++) {
      const entry = stabilizedAnchors[i];
      if (entry.anchor.group.visible) {
        entry.presentationGroup.visible = true;
        entry.anchor.group.matrix.decompose(_tempPos, _tempQuat, _tempScale);
        entry.stabilizer.update(_tempPos, _tempQuat, _tempScale, delta);

        entry.presentationGroup.position.copy(entry.stabilizer.currentPos);
        entry.presentationGroup.quaternion.copy(entry.stabilizer.currentQuat);
        entry.presentationGroup.scale.copy(entry.stabilizer.currentScale);
      } else {
        entry.presentationGroup.visible = false;
        entry.stabilizer.reset();
      }
    }

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
