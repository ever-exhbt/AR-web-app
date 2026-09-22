import { copyCurrentUrl } from './detector.js';

export type ScreenState = 'landing' | 'scanning' | 'found' | 'error' | 'preview';

export type ErrorType =
  | 'permission-denied'
  | 'insecure-context'
  | 'in-app-browser'
  | 'no-camera'
  | 'network-error';

export interface ErrorDetails {
  type: ErrorType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  showPreviewFallback?: boolean;
}

export class ScreenController {
  private elLanding = document.getElementById('screen-landing') as HTMLElement;
  private elScanning = document.getElementById('screen-scanning') as HTMLElement;
  private elFoundCard = document.getElementById('info-card-container') as HTMLElement;
  private elErrorScreen = document.getElementById('screen-error') as HTMLElement;
  private elStatus = document.getElementById('status-indicator') as HTMLElement;
  private elAnnouncer = document.getElementById('screen-reader-announcer') as HTMLElement;

  // Error screen elements
  private elErrorTitle = document.getElementById('error-title') as HTMLElement;
  private elErrorMessage = document.getElementById('error-message') as HTMLElement;
  private elErrorActionBtn = document.getElementById('btn-error-action') as HTMLButtonElement;
  private elErrorPreviewBtn = document.getElementById('btn-error-preview') as HTMLButtonElement;

  // Target asset loading spinner
  private elAssetSpinner = document.getElementById('target-asset-spinner') as HTMLElement | null;
  private elSpinnerText = document.getElementById('spinner-text') as HTMLElement | null;

  private currentState: ScreenState = 'landing';

  constructor() {
    // Setup error preview button click
    if (this.elErrorPreviewBtn) {
      this.elErrorPreviewBtn.addEventListener('click', () => {
        window.location.search = '?preview=sample-target&debug=1';
      });
    }
  }

  /**
   * Announces state changes to screen readers via aria-live
   */
  public announce(message: string) {
    if (this.elAnnouncer) {
      this.elAnnouncer.textContent = message;
    }
  }

  /**
   * Sets top status badge state and text
   */
  public setStatus(text: string, state: 'standby' | 'scanning' | 'locked' | 'error' | 'preview' = 'standby') {
    if (!this.elStatus) return;
    this.elStatus.textContent = text;
    this.elStatus.className = `mode-badge mode-${state}`;
  }

  /**
   * Displays the Landing Screen
   */
  public showLanding() {
    this.currentState = 'landing';
    this.hideAll();
    this.elLanding.classList.remove('hidden');
    this.setStatus('STANDBY', 'standby');
    this.announce('Ready. Tap Start AR Experience to begin.');
  }

  /**
   * Displays the Scanning Reticle
   */
  public showScanning() {
    this.currentState = 'scanning';
    this.hideAll();
    this.elScanning.classList.remove('hidden');
    this.setStatus('SCANNING...', 'scanning');
    this.announce('Scanning for registered tracking target.');
  }

  /**
   * Displays the Found State (Camera fills 100% full-bleed, sleek info card shown).
   * If isFullyLoaded is false, triggers the asset loading spinner HUD while displaying target info.
   */
  public showFound(title: string, body: string, isFullyLoaded: boolean = true) {
    this.currentState = 'found';
    // Scanning box disappears completely -> 100% camera feed immersion
    this.elScanning.classList.add('hidden');
    this.elLanding.classList.add('hidden');
    this.elErrorScreen.classList.add('hidden');

    const headingEl = document.getElementById('card-heading');
    const bodyEl = document.getElementById('card-body');
    if (headingEl) headingEl.textContent = title;

    if (!isFullyLoaded) {
      if (bodyEl) bodyEl.textContent = 'Loading augmented content...';
      this.showAssetLoading('Loading AR content...');
      this.setStatus('LOADING...', 'scanning');
      this.announce(`Target found: ${title}. Loading content.`);
    } else {
      if (bodyEl) bodyEl.textContent = body;
      this.hideAssetLoading();
      this.setStatus('TARGET FOUND', 'locked');
      this.announce(`Target locked: ${title}`);
    }

    this.elFoundCard.classList.remove('hidden');
  }

  /**
   * Shows the dedicated asset loading spinner HUD
   */
  public showAssetLoading(message: string = 'Loading AR content...') {
    if (this.elAssetSpinner) {
      if (this.elSpinnerText) this.elSpinnerText.textContent = message;
      this.elAssetSpinner.classList.remove('hidden');
    }
  }

  /**
   * Hides the asset loading spinner HUD
   */
  public hideAssetLoading() {
    if (this.elAssetSpinner) {
      this.elAssetSpinner.classList.add('hidden');
    }
  }

  /**
   * Called when target is lost
   */
  public showLost() {
    if (this.currentState === 'error') return;
    this.hideAssetLoading();
    this.elFoundCard.classList.add('hidden');
    this.elScanning.classList.remove('hidden');
    this.setStatus('SCANNING...', 'scanning');
    this.announce('Target lost. Resumed scanning.');
  }

  /**
   * Displays actionable error screen
   */
  public showError(details: ErrorDetails) {
    this.currentState = 'error';
    this.hideAll();
    this.elErrorScreen.classList.remove('hidden');
    this.setStatus('ERROR', 'error');

    if (this.elErrorTitle) this.elErrorTitle.textContent = details.title;
    if (this.elErrorMessage) this.elErrorMessage.textContent = details.message;

    if (details.actionLabel && details.onAction && this.elErrorActionBtn) {
      this.elErrorActionBtn.textContent = details.actionLabel;
      this.elErrorActionBtn.classList.remove('hidden');
      this.elErrorActionBtn.onclick = details.onAction;
    } else if (this.elErrorActionBtn) {
      this.elErrorActionBtn.classList.add('hidden');
    }

    if (this.elErrorPreviewBtn) {
      if (details.showPreviewFallback !== false) {
        this.elErrorPreviewBtn.classList.remove('hidden');
      } else {
        this.elErrorPreviewBtn.classList.add('hidden');
      }
    }

    this.announce(`Error: ${details.title}. ${details.message}`);
  }

  /**
   * Helper to construct error descriptions per spec section 6
   */
  public showCameraPermissionError(onRetry: () => void) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const instructions = isIOS
      ? "Camera permission was denied. Tap the 'AA' icon in Safari's address bar, select 'Website Settings', allow Camera, then tap Try Again."
      : "Camera permission was denied. Tap the padlock/tune icon in your browser's address bar, reset camera permission to 'Allow', then tap Try Again.";

    this.showError({
      type: 'permission-denied',
      title: 'Camera Access Blocked',
      message: instructions,
      actionLabel: 'Try Again',
      onAction: onRetry,
      showPreviewFallback: true
    });
  }

  public showInsecureContextError() {
    this.showError({
      type: 'insecure-context',
      title: 'HTTPS Required',
      message: 'WebAR camera access requires a secure HTTPS context. Please open this page over https:// or through a secure tunnel.',
      actionLabel: 'Reload with HTTPS',
      onAction: () => {
        window.location.protocol = 'https:';
      },
      showPreviewFallback: true
    });
  }

  public showInAppBrowserError(inAppName: string) {
    this.showError({
      type: 'in-app-browser',
      title: `${inAppName} Browser Detected`,
      message: `${inAppName}'s in-app browser blocks WebAR camera access. Please open this page in Safari or Chrome to experience AR.`,
      actionLabel: 'Copy Page Link',
      onAction: async () => {
        const copied = await copyCurrentUrl();
        if (copied && this.elErrorActionBtn) {
          const original = this.elErrorActionBtn.textContent;
          this.elErrorActionBtn.textContent = 'Link Copied to Clipboard!';
          setTimeout(() => {
            this.elErrorActionBtn.textContent = original;
          }, 2500);
        }
      },
      showPreviewFallback: true
    });
  }

  public showNoCameraError() {
    this.showError({
      type: 'no-camera',
      title: 'No Camera Detected',
      message: 'No supported camera hardware or video input stream was found on this device.',
      actionLabel: 'Open 3D Preview',
      onAction: () => {
        window.location.search = '?preview=sample-target&debug=1';
      },
      showPreviewFallback: false
    });
  }

  public showNetworkError(resourceName: string, onRetry: () => void) {
    this.showError({
      type: 'network-error',
      title: 'Network Download Failed',
      message: `Could not load ${resourceName}. Please check your internet connection and try again.`,
      actionLabel: 'Retry Download',
      onAction: onRetry,
      showPreviewFallback: true
    });
  }

  private hideAll() {
    this.hideAssetLoading();
    this.elLanding.classList.add('hidden');
    this.elScanning.classList.add('hidden');
    this.elFoundCard.classList.add('hidden');
    this.elErrorScreen.classList.add('hidden');
  }
}
