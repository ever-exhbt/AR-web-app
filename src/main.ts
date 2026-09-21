import { ScreenController } from './ui/screens.js';
import { checkEnvironment } from './ui/detector.js';

// UI Controller
const screens = new ScreenController();
const container = document.getElementById('ar-container') as HTMLElement;
const btnStartAR = document.getElementById('btn-start-ar') as HTMLButtonElement;
const btnStartPreview = document.getElementById('btn-start-preview') as HTMLButtonElement;
const debugHud = document.getElementById('debug-hud') as HTMLElement;
const hudFps = document.getElementById('hud-fps') as HTMLElement;
const hudTarget = document.getElementById('hud-target') as HTMLElement;
const hudStatus = document.getElementById('hud-status') as HTMLElement;

// Environment & Dev Gating
const isDev = import.meta.env.DEV;

// URL parameters
const params = new URLSearchParams(window.location.search);
const isDebug = isDev && params.get('debug') === '1';
const previewTargetId = isDev ? params.get('preview') : null;

if (!isDev && btnStartPreview) {
  // Gate preview button in production
  btnStartPreview.classList.add('hidden');
}

if (isDebug) {
  debugHud.classList.remove('hidden');
}

function handleFpsUpdate(fps: number) {
  if (hudFps) hudFps.textContent = `FPS: ${fps}`;
}

function handleTargetChange(targetId: string, anchorIndex: number) {
  if (hudTarget) hudTarget.textContent = `Target: ${targetId} [#${anchorIndex}]`;
  if (hudStatus) hudStatus.textContent = 'Status: found';
}

/**
 * Lazy loads and executes Camera AR runtime
 */
async function launchCameraAR() {
  const env = checkEnvironment();

  if (env.isInAppBrowser) {
    screens.showInAppBrowserError(env.inAppName || 'In-App');
    return;
  }

  if (!env.isSecureContext) {
    screens.showInsecureContextError();
    return;
  }

  if (!env.hasCameraSupport) {
    screens.showNoCameraError();
    return;
  }

  screens.showScanning();

  try {
    const { startCameraAR } = await import('./ar/runtime.js');
    await startCameraAR(container, screens, handleFpsUpdate, handleTargetChange);
  } catch (err: any) {
    console.error('AR Launch Error:', err);
    const errorStr = (err && (err.name || err.message)) || String(err);
    if (/NotAllowedError|PermissionDeniedError|permission/i.test(errorStr)) {
      screens.showCameraPermissionError(() => launchCameraAR());
    } else if (/NotFoundError|DevicesNotFoundError/i.test(errorStr)) {
      screens.showNoCameraError();
    } else if (/fetch|network|targets/i.test(errorStr)) {
      screens.showNetworkError('tracking descriptors', () => launchCameraAR());
    } else {
      screens.showError({
        type: 'no-camera',
        title: 'Could Not Start AR',
        message: err.message || 'An error occurred while launching AR.',
        actionLabel: 'Try Again',
        onAction: () => launchCameraAR(),
        showPreviewFallback: true
      });
    }
  }
}

/**
 * Lazy loads and executes 3D Preview runtime
 */
async function launchPreview(targetId?: string) {
  try {
    const { startPreview } = await import('./preview/runtime.js');
    await startPreview(container, screens, targetId, handleFpsUpdate);
  } catch (err: any) {
    console.error('Preview Launch Error:', err);
    screens.showError({
      type: 'no-camera',
      title: 'Preview Load Error',
      message: err.message || 'Could not launch 3D preview mode.',
      actionLabel: 'Reload',
      onAction: () => window.location.reload()
    });
  }
}

// Event Listeners
btnStartAR.addEventListener('click', () => launchCameraAR());
btnStartPreview.addEventListener('click', () => launchPreview('sample-target'));

// Handle auto-preview URL
if (previewTargetId) {
  launchPreview(previewTargetId);
} else {
  // Optional warm-loading: only on fast connections and when saveData is off
  const conn = (navigator as any).connection;
  const isSaveData = conn && conn.saveData;
  const isSlowConnection = conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');

  if (!isSaveData && !isSlowConnection && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      // Quietly prefetch the AR runtime chunk in idle time
      import('./ar/runtime.js').catch(() => {});
    });
  }
}

import { resolveAssetUrl } from './utils/assets.js';

// Register service worker in production for repeat-visit caching of .mind and assets
if (!isDev && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(resolveAssetUrl('sw.js')).catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}


