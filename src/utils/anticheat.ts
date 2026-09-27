const STORAGE_KEY_DEVICE_ID = 'coco_device_fingerprint_v1';
const STORAGE_KEY_BAN = 'coco_device_banned_flag';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Generate or retrieve unique device fingerprint
export function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!deviceId) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let canvasSig = 'canvas_off';
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('COCO_AC_FINGERPRINT_V2', 2, 15);
        canvasSig = canvas.toDataURL().slice(-30);
      }

      const screenSig = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const navSig = `${navigator.hardwareConcurrency || 4}-${navigator.language || 'en'}`;
      const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      deviceId = `DEV-${btoa(`${screenSig}-${navSig}-${randomSeed}-${canvasSig}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 28).toUpperCase()}`;
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

// Report and execute server device + IP ban
export async function reportAndBanDevice(
  studentId: string,
  reason: string,
  violationType: string = 'SYNTHETIC_CLICK'
): Promise<void> {
  markDeviceBannedLocally(reason);
  const deviceId = getDeviceId();

  try {
    await fetch(`${API_BASE}/api/anticheat/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({
        deviceId,
        studentId,
        reason,
        violationType,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('Failed to send ban report to server:', err);
  }
}

// Check if a native browser function has been modified or hooked
function isNativeFunctionHooked(fn: any): boolean {
  try {
    if (!fn) return false;
    const str = Function.prototype.toString.call(fn);
    return !str.includes('[native code]');
  } catch {
    return true;
  }
}

// Hardware Audio Clock for Speedhack Detection
let audioCtx: AudioContext | null = null;
let lastAudioCheckTime = 0;
let lastPerfCheckTime = 0;

export function checkSpeedhackClockSkew(): { detected: boolean; reason?: string } {
  try {
    if (typeof window.AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
      return { detected: false };
    }

    if (!audioCtx) {
      const AudioConstructor = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioConstructor();
      lastAudioCheckTime = audioCtx.currentTime;
      lastPerfCheckTime = performance.now();
      return { detected: false };
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const currentAudioTime = audioCtx.currentTime;
    const currentPerfTime = performance.now();

    const audioElapsedSec = currentAudioTime - lastAudioCheckTime;
    const perfElapsedSec = (currentPerfTime - lastPerfCheckTime) / 1000;

    // Only test if at least 1.5 seconds has elapsed
    if (audioElapsedSec >= 1.5 && perfElapsedSec >= 1.5) {
      const ratio = perfElapsedSec / audioElapsedSec;
      lastAudioCheckTime = currentAudioTime;
      lastPerfCheckTime = currentPerfTime;

      // If wall/perf clock runs 1.4x faster or slower than hardware audio clock -> Speedhack active!
      if (ratio > 1.45 || ratio < 0.65) {
        return {
          detected: true,
          reason: `Speedhack clock manipulation detected: Time dilation ratio ${ratio.toFixed(2)}x deviates from hardware clock.`,
        };
      }
    }
  } catch {
    // Ignore audio clock errors
  }

  return { detected: false };
}

// Detect browser extensions, userscripts, auto-clickers, and DOM injectors
export function scanForExtensionsAndCheats(): { detected: boolean; reason?: string; violationType?: string } {
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
      violationType: 'EXTENSION',
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
          violationType: 'EXTENSION',
        };
      }
    }

    // Check for extension injected elements
    if (
      document.querySelector('[id*="tampermonkey"]') ||
      document.querySelector('[class*="violentmonkey"]') ||
      document.querySelector('[data-extension-id]') ||
      document.querySelector('[id*="autoclick"]') ||
      document.querySelector('[class*="autoclick"]')
    ) {
      return {
        detected: true,
        reason: 'Automated Browser Extension / Auto-Clicker DOM element detected.',
        violationType: 'EXTENSION',
      };
    }
  } catch {
    // Ignore DOM issues
  }

  // 3. Check for hooked native APIs
  if (isNativeFunctionHooked(window.fetch)) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: window.fetch has been modified/hooked.',
      violationType: 'EXTENSION',
    };
  }

  if (isNativeFunctionHooked(EventTarget.prototype.addEventListener)) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: addEventListener prototype has been altered.',
      violationType: 'EXTENSION',
    };
  }

  if (isNativeFunctionHooked(HTMLButtonElement.prototype.click)) {
    return {
      detected: true,
      reason: 'Browser Extension Detected: button.click prototype has been modified.',
      violationType: 'EXTENSION',
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
      violationType: 'SYNTHETIC_CLICK',
    };
  }

  // 5. Check hardware audio clock skew for speedhacks
  const speedCheck = checkSpeedhackClockSkew();
  if (speedCheck.detected) {
    return {
      detected: true,
      reason: speedCheck.reason,
      violationType: 'SPEEDHACK',
    };
  }

  return { detected: false };
}

// Continuous anti-cheat watchdog during gameplay
export function startAntiCheatWatchdog(
  studentId: string,
  onBanned: (reason: string) => void
): () => void {
  const intervalId = window.setInterval(() => {
    const scan = scanForExtensionsAndCheats();
    if (scan.detected && scan.reason) {
      clearInterval(intervalId);
      reportAndBanDevice(studentId, scan.reason, scan.violationType || 'EXTENSION');
      onBanned(scan.reason);
    }
  }, 1200);

  return () => {
    clearInterval(intervalId);
  };
}
