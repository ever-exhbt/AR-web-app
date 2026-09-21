import { describe, it, expect } from 'vitest';
import { checkEnvironment } from '../src/ui/detector.js';

describe('Environment & WebView Detector', () => {
  it('does NOT misidentify desktop or mobile Firefox as X / Twitter', () => {
    const firefoxWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';
    const firefoxMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0';
    const firefoxLinux = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
    const firefoxAndroid = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';
    const firefoxIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15';

    [firefoxWindows, firefoxMac, firefoxLinux, firefoxAndroid, firefoxIOS].forEach(ua => {
      const result = checkEnvironment(ua);
      expect(result.isInAppBrowser, `Failed for UA: ${ua}`).toBe(false);
      expect(result.inAppName).toBe('');
    });
  });

  it('correctly detects authentic X / Twitter in-app browsers', () => {
    const xIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 X/10.15.0';
    const twitterAndroid = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 TwitterAndroid';
    const twitterIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone';

    [xIOS, twitterAndroid, twitterIOS].forEach(ua => {
      const result = checkEnvironment(ua);
      expect(result.isInAppBrowser, `Failed for UA: ${ua}`).toBe(true);
      expect(result.inAppName).toBe('X / Twitter');
    });
  });

  it('correctly detects other restricted social in-app browsers', () => {
    expect(checkEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 287.0.0.25.77').inAppName).toBe('Instagram');
    expect(checkEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/415.0.0]').inAppName).toBe('Facebook');
    expect(checkEnvironment('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36 BytedanceWebview TikTok').inAppName).toBe('TikTok');
    expect(checkEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) LinkedInApp/9.28.32').inAppName).toBe('LinkedIn');
  });

  it('identifies standard mobile Safari and Chrome as real browsers', () => {
    const safariIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const chromeAndroid = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

    expect(checkEnvironment(safariIOS).isInAppBrowser).toBe(false);
    expect(checkEnvironment(chromeAndroid).isInAppBrowser).toBe(false);
  });
});
