export interface EnvironmentCheckResult {
  isSecureContext: boolean;
  hasCameraSupport: boolean;
  isInAppBrowser: boolean;
  inAppName?: string;
  recommendedBrowser: 'Safari' | 'Chrome' | 'Default Browser';
}

/**
 * Checks system capability and detects in-app WebViews that restrict camera access.
 */
export function checkEnvironment(): EnvironmentCheckResult {
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasCamera = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const recommendedBrowser = isIOS ? 'Safari' : 'Chrome';

  let isInApp = false;
  let inAppName = '';

  if (/Instagram/i.test(ua)) {
    isInApp = true;
    inAppName = 'Instagram';
  } else if (/FBAN|FBAV/i.test(ua)) {
    isInApp = true;
    inAppName = 'Facebook';
  } else if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) {
    isInApp = true;
    inAppName = 'TikTok';
  } else if (/LinkedInApp/i.test(ua)) {
    isInApp = true;
    inAppName = 'LinkedIn';
  } else if (/Snapchat/i.test(ua)) {
    isInApp = true;
    inAppName = 'Snapchat';
  } else if (/Twitter|X\//i.test(ua)) {
    isInApp = true;
    inAppName = 'X / Twitter';
  } else if (/MicroMessenger/i.test(ua)) {
    isInApp = true;
    inAppName = 'WeChat';
  }

  return {
    isSecureContext: isSecure,
    hasCameraSupport: hasCamera,
    isInAppBrowser: isInApp,
    inAppName,
    recommendedBrowser
  };
}

/**
 * Copies URL to clipboard with fallback
 */
export async function copyCurrentUrl(): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    }
    const input = document.createElement('input');
    input.value = window.location.href;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return true;
  } catch {
    return false;
  }
}
