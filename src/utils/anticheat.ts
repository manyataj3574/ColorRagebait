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

// Clear local ban
export function clearLocalBan() {
  try {
    localStorage.removeItem(STORAGE_KEY_BAN);
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

// Detect active userscript injection or automated browser drivers
// (Intentionally excludes regular extensions like AdBlock, translators, dark mode, or mobile WebViews)
export function scanForExtensionsAndCheats(): { detected: boolean; reason?: string; violationType?: string } {
  const win = window as any;

  // 1. Detect explicit script engine objects (Tampermonkey/Violentmonkey userscript execution)
  if (
    typeof win.GM_setValue !== 'undefined' ||
    typeof win.GM_getValue !== 'undefined' ||
    typeof win.__tampermonkey !== 'undefined' ||
    typeof win.tampermonkey !== 'undefined' ||
    typeof win.violentmonkey !== 'undefined'
  ) {
    return {
      detected: true,
      reason: 'Browser Userscript Injector detected running in window.',
      violationType: 'EXTENSION',
    };
  }

  // 2. Check for automated window bot flags (like Puppeteer/Selenium/Playwright)
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

  return { detected: false };
}

// Anti-cheat watchdog during gameplay
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
  }, 3000);

  return () => {
    clearInterval(intervalId);
  };
}
