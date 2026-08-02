/**
 * Per-device settings for automatic camera capture.
 *
 * The backend's auto-scan schedule (see /schedule) only tracks *when* a scan
 * is due for the store (business hours, peak windows, interval) -- it has no
 * concept of a camera or of which shelf a photo belongs to, since historically
 * this project had no camera integration at all (see scan_scheduler.py).
 *
 * Automatic capture is inherently tied to whichever device/camera is plugged
 * into a given browser tab, so these settings live on this device only
 * (localStorage), not on the store's account.
 */
export interface AutoCaptureSettings {
  enabled: boolean;
  shelfId: string;
}

const STORAGE_KEY = "shelfmind-auto-capture-settings";

/** Fired whenever settings are saved, so any mounted capture manager picks up
 * the change immediately without needing a page reload. */
export const AUTO_CAPTURE_SETTINGS_EVENT = "shelfmind:auto-capture-settings-changed";

const DEFAULT_SETTINGS: AutoCaptureSettings = { enabled: false, shelfId: "" };

export function getAutoCaptureSettings(): AutoCaptureSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed?.enabled,
      shelfId: typeof parsed?.shelfId === "string" ? parsed.shelfId : "",
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setAutoCaptureSettings(settings: AutoCaptureSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (private mode, etc.) -- setting simply won't persist across reloads.
  }
  window.dispatchEvent(new CustomEvent(AUTO_CAPTURE_SETTINGS_EVENT, { detail: settings }));
}
