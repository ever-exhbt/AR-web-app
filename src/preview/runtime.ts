import * as THREE from 'three';
import { targets, getTargetInfo } from 'virtual:ar-targets';
import experiencesData from '../../content/experiences.json';
import { TargetExperience } from '../content/types.js';
import { ExperienceManager, LoadedExperience } from '../content/experience-manager.js';
import { ScreenController } from '../ui/screens.js';
import { resolveAssetUrl } from '../utils/assets.js';

const experiences = experiencesData as unknown as Record<string, TargetExperience>;

export async function startPreview(
  container: HTMLElement,
  screens: ScreenController,
  targetId?: string,
  onFpsUpdate?: (fps: number) => void
) {
  const target = (targetId && getTargetInfo(targetId)) || targets[0];
  const activeId = target ? target.id : 'sample-target';
  const expConfig = experiences[activeId];

  screens.setStatus(`PREVIEW: ${activeId}`, 'preview');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, -1.2, 1.8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(2, 4, 3);
  scene.add(dirLight);

  // Target Reference Plane
  const targetAspect = target ? target.height / target.width : 1.25;
  const textureLoader = new THREE.TextureLoader();
  const textureUrl = target ? resolveAssetUrl(target.source) : resolveAssetUrl('sample-target.png');

  const texture = await new Promise<THREE.Texture>((resolve) => {
    textureLoader.load(textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    });
  });

  const planeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, targetAspect),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  scene.add(planeMesh);

  // Anchor Group attached to plane
  const contentAnchorGroup = new THREE.Group();
  scene.add(contentAnchorGroup);

  const experienceManager = new ExperienceManager(experiences, { maxCacheSize: 3 });
  const heading = expConfig?.infoCard?.heading || `Ever WebAR: ${activeId}`;
  const body = expConfig?.infoCard?.body || `Preview mode active. Dimensions: ${target?.width}x${target?.height}.`;

  // Show loading spinner while preview assets buffer
  screens.showFound(heading, body, false);

  const loadedExp: LoadedExperience = await experienceManager.loadTargetExperience(
    activeId,
    contentAnchorGroup,
    (_percent, message) => {
      screens.showAssetLoading(message);
    }
  );
  loadedExp.whenLoaded.then(() => {
    screens.showFound(heading, body, true);
  });

  // Orbital touch/mouse interaction
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  const targetRotation = { x: 0, y: 0 };

  window.addEventListener('pointerdown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    targetRotation.y += deltaX * 0.008;
    targetRotation.x += deltaY * 0.008;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('pointerup', () => {
    isDragging = false;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let frameCount = 0;
  let lastFpsTime = performance.now();
  let lastTime = performance.now();

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    // Smooth inertia
    planeMesh.rotation.y += (targetRotation.y - planeMesh.rotation.y) * 0.1;
    planeMesh.rotation.x += (targetRotation.x - planeMesh.rotation.x) * 0.1;
    contentAnchorGroup.rotation.y = planeMesh.rotation.y;
    contentAnchorGroup.rotation.x = planeMesh.rotation.x;

    loadedExp.update(delta);
    renderer.render(scene, camera);

    if (onFpsUpdate) {
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        onFpsUpdate(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }
    }
  }

  renderLoop();
}
