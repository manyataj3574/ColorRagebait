const STORAGE_KEY_DEVICE_ID = 'coco_device_fingerprint_v1';
const STORAGE_KEY_BAN = 'coco_device_banned_flag';

// Generate or retrieve unique device fingerprint
export function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!deviceId) {
      // Build a hardware-linked fingerprint hash
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let canvasSig = 'canvas_off';
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('COCO_AC_FINGERPRINT', 2, 15);
        canvasSig = canvas.toDataURL().slice(-30);
      }

      const screenSig = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      deviceId = `DEV-${btoa(`${screenSig}-${randomSeed}-${canvasSig}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24).toUpperCase()}`;
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, deviceId);
    }
    return deviceId;
  } catch {
    return 'DEV-FALLBACK-FINGERPRINT';
  }
}

// Check local ban
export function isDeviceBannedLocally(): { banned: boolean; reason?: string; bannedAt?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BAN);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.banned) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return { banned: false };
}

// Persist ban locally
export function markDeviceBannedLocally(reason: string) {
  try {
    const data = {
      banned: true,
      reason,
      bannedAt: new Date().toISOString(),
      deviceId: getDeviceId(),
    };
    localStorage.setItem(STORAGE_KEY_BAN, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

// Report and execute server device ban
export async function reportAndBanDevice(studentId: string, reason: string): Promise<void> {
  markDeviceBannedLocally(reason);
  const deviceId = getDeviceId();

  try {
    await fetch('/api/anticheat/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        studentId,
        reason,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('Failed to send ban report to server:', err);
  }
}

// Check if native functions have been hooked / monkey-patched by an extension
function isNativeFunctionHooked(fn: any): boolean {
  try {
    if (!fn) return false;
    const str = Function.prototype.toString.call(fn);
    return !str.includes('[native code]');
  } catch {
    return true;
  }
}

// Detect browser extensions, userscripts, auto-clickers, and DOM injectors
export function scanForExtensionsAndCheats(): { detected: boolean; reason?: string } {
  const win = window as any;

  // 1. Detect Tampermonkey / Greasemonkey / Violentmonkey global objects
  if (
    typeof win.GM !== 'undefined' ||
    typeof win.GM_info !== 'undefined' ||
    typeof win.GM_setValue !== 'undefined' ||
    typeof win.GM_getValue !== 'undefined' ||
    typeof win.GM_xmlhttpRequest !== 'undefined' ||
    typeof win.__tampermonkey !== 'undefined' ||
    typeof win.tampermonkey !== 'undefined' ||
    typeof win.violentmonkey !== 'undefined' ||
    typeof win.unsafeWindow !== 'undefined'
  ) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: Tampermonkey / Greasemonkey Userscript Injector found in runtime window.',
    };
  }

  // 2. Check for extension scripts or content scripts in DOM
  try {
    const scripts = document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || '';
      if (
        src.startsWith('chrome-extension://') ||
        src.startsWith('moz-extension://') ||
        src.startsWith('safari-extension://')
      ) {
        return {
          detected: true,
          reason: `Browser Extension Script Injected: ${src.substring(0, 45)}...`,
        };
      }
    }

    // Check for extension injected elements
    if (
      document.querySelector('[id*="tampermonkey"]') ||
      document.querySelector('[class*="violentmonkey"]') ||
      document.querySelector('[data-extension-id]') ||
      document.querySelector('[id*="autoclick"]')
    ) {
      return {
        detected: true,
        reason: 'Automated Browser Extension / Auto-Clicker DOM element detected.',
      };
    }
  } catch {
    // Ignore DOM query issues
  }

  // 3. Check for hooked native APIs (Extensions frequently hook fetch, setTimeout, addEventListener)
  if (isNativeFunctionHooked(window.fetch)) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: window.fetch has been modified/hooked.',
    };
  }

  if (isNativeFunctionHooked(EventTarget.prototype.addEventListener)) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: addEventListener prototype has been altered.',
    };
  }

  if (isNativeFunctionHooked(Function.prototype.toString)) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: Function.prototype.toString has been spoofed.',
    };
  }

  // 4. Check for automated window bot flags (like Puppeteer/Selenium/Playwright)
  if (
    navigator.webdriver ||
    win.__webdriver_script_fn ||
    win.__fxdriver_unwrapped ||
    win._phantom ||
    win.callPhantom ||
    win.__nightmare
  ) {
    return {
      detected: true,
      reason: 'Headless Browser Automation / WebDriver bot detected.',
    };
  }

  return { detected: false };
}

// Anti-Cheat validation helpers
export const ANTI_CHEAT = {
  MIN_BUTTON_CLICK_DELAY_MS: 300, // 300ms button click enable delay
  MIN_HUMAN_REACTION_MS: 160,     // Physical human limit for Stroop color cognition
  MAX_SUB_200MS_STRIKES: 2,       // More than 2 superhuman strikes = cheat
};
