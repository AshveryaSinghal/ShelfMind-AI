import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSchedule,
  getGetScheduleQueryKey,
  getListAlertsQueryKey,
  getListShelvesQueryKey,
  getGetDashboardQueryKey,
  getGetShelfHistoryQueryKey,
  getGetShelfAlertHistoryQueryKey,
  getCompareShelfScansQueryKey,
  getGetShelfSalesEstimateQueryKey,
  getGetStoreSalesEstimateQueryKey,
  getGetDemandAnalyticsQueryKey,
  getGetAnalyticsReportQueryKey,
  getGetPeakHoursQueryKey,
  type ScanResult,
} from "@workspace/api-client-react";
import { useAuth, apiBase } from "@/lib/auth";
import { getCompareStoresQueryKey } from "@/lib/stores";
import {
  AUTO_CAPTURE_SETTINGS_EVENT,
  getAutoCaptureSettings,
  type AutoCaptureSettings,
} from "@/lib/auto-scan-settings";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, X, AlertTriangle } from "lucide-react";

// Matches the backend scheduler's own poll tick (TICK_SECONDS in
// scan_scheduler.py) so this stays in step with the server's due/not-due logic.
const POLL_MS = 60_000;
const POPUP_AUTO_DISMISS_MS = 30_000;

// Temporary diagnostic logging -- prefixed so it's easy to filter in
// DevTools (type "auto-scan" into the console filter box).
const LOG = (...args: unknown[]) => console.log("[auto-scan]", ...args);

type PopupState =
  | { kind: "captured"; shelfId: string }
  | { kind: "complete"; shelfId: string; score: number; priority: string }
  | { kind: "error"; message: string }
  | null;

/**
 * Mounted once near the root of the authenticated app so it keeps running no
 * matter which page the user is on. It does nothing unless auto-capture has
 * been turned on for this device (Profile → Auto Scan Scheduler).
 */
export function AutoScanCaptureManager() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<AutoCaptureSettings>(() => {
    const initial = getAutoCaptureSettings();
    LOG("manager mounted, settings on load:", initial);
    return initial;
  });
  useEffect(() => {
    const onChange = () => {
      const next = getAutoCaptureSettings();
      LOG("settings changed:", next);
      setSettings(next);
    };
    window.addEventListener(AUTO_CAPTURE_SETTINGS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(AUTO_CAPTURE_SETTINGS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const shelfId = settings.shelfId.trim();
  const active = settings.enabled && !!shelfId;

  useEffect(() => {
    LOG("active =", active, "(enabled:", settings.enabled, ", shelfId:", JSON.stringify(shelfId), ")");
  }, [active, settings.enabled, shelfId]);

  // Poll the store's schedule so this stays in sync with whatever peak /
  // off-peak intervals and business hours are configured server-side.
  const { data: schedule, error: scheduleError } = useGetSchedule({
    query: { queryKey: getGetScheduleQueryKey(), enabled: active, refetchInterval: active ? POLL_MS : false },
  });

  useEffect(() => {
    if (scheduleError) LOG("schedule fetch ERROR:", scheduleError);
    else if (schedule) LOG("schedule loaded:", { enabled: schedule.enabled, current_interval_minutes: schedule.current_interval_minutes });
  }, [schedule, scheduleError]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextCaptureAtRef = useRef<number | null>(null);
  const armedIntervalMinutesRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [popup, setPopup] = useState<PopupState>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPopup = useCallback((next: PopupState) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setPopup(next);
    if (next) {
      dismissTimerRef.current = setTimeout(() => setPopup(null), POPUP_AUTO_DISMISS_MS);
    }
  }, []);

  const dismissPopup = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setPopup(null);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) {
      LOG("ensureStream: reusing existing stream");
      return streamRef.current;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      LOG("ensureStream: getUserMedia not supported in this browser/context");
      setCameraDenied(true);
      return null;
    }
    LOG("ensureStream: requesting camera...");
    try {
      // Whatever camera is actually present on this device is what gets used
      // (a laptop webcam here, a rear-facing camera on a phone/tablet, etc.) --
      // "environment" is only a preference, browsers fall back to whatever
      // they have if there's no separate front/back camera to choose from.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraDenied(false);
      LOG("ensureStream: camera granted, tracks:", stream.getVideoTracks().map((t) => t.label));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((e) => LOG("ensureStream: video.play() rejected:", e));
        LOG("ensureStream: video element ready, videoWidth/Height =", videoRef.current.videoWidth, videoRef.current.videoHeight);
      } else {
        LOG("ensureStream: WARNING videoRef.current is null, can't attach stream");
      }
      return stream;
    } catch (err) {
      LOG("ensureStream: getUserMedia FAILED:", err);
      setCameraDenied(true);
      return null;
    }
  }, []);

  // Keep exactly one camera stream warm (one permission prompt, reused for
  // every future capture) for as long as auto-capture stays enabled.
  useEffect(() => {
    if (active) {
      ensureStream();
    } else {
      stopStream();
      nextCaptureAtRef.current = null;
      setCameraDenied(false);
    }
  }, [active, ensureStream, stopStream]);

  useEffect(() => stopStream, [stopStream]);

  const pollScanJob = useCallback(
    async (jobId: string, headers?: Record<string, string>): Promise<ScanResult> => {
      const POLL_INTERVAL_MS = 1500;
      const MAX_POLLS = 120; // ~3 minutes, generous for a cold-started detector

      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        const res = await fetch(`${apiBase()}/api/shelfmind/scan/jobs/${encodeURIComponent(jobId)}`, { headers });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || body?.message || `Could not check scan status (${res.status})`);
        }
        const job = await res.json();

        if (job.status === "COMPLETED") return job.result as ScanResult;
        if (job.status === "FAILED") throw new Error(job.error || "Scan processing failed.");

        LOG("captureAndScan: job", jobId, "status =", job.status, "-- waiting");
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      throw new Error("Scan is taking longer than expected. Check the shelf's history shortly.");
    },
    []
  );

  const captureAndScan = useCallback(async () => {
    LOG("captureAndScan: triggered for shelf", shelfId);
    if (capturingRef.current) {
      LOG("captureAndScan: skipped, a capture is already in progress");
      return;
    }
    if (!shelfId) {
      LOG("captureAndScan: skipped, no shelfId set");
      return;
    }
    const stream = await ensureStream();
    const video = videoRef.current;
    if (!stream) {
      LOG("captureAndScan: aborted, no camera stream available");
      return;
    }
    if (!video) {
      LOG("captureAndScan: aborted, video element not mounted");
      return;
    }
    if (!video.videoWidth) {
      LOG("captureAndScan: aborted, video has no dimensions yet (videoWidth=0) -- camera stream not decoding frames");
      showPopup({ kind: "error", message: "Camera stream isn't ready yet (no video data). Will retry next interval." });
      return;
    }

    capturingRef.current = true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        LOG("captureAndScan: aborted, canvas 2d context unavailable");
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) {
        LOG("captureAndScan: aborted, canvas.toBlob returned null");
        return;
      }
      LOG("captureAndScan: frame captured,", blob.size, "bytes -- uploading to /scan/" + shelfId);

      showPopup({ kind: "captured", shelfId });

      const formData = new FormData();
      formData.append("image", new File([blob], `auto-scan-${Date.now()}.jpg`, { type: "image/jpeg" }));

      const authHeaders = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined;

      const res = await fetch(`${apiBase()}/api/shelfmind/scan/${encodeURIComponent(shelfId)}`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      LOG("captureAndScan: server responded", res.status);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `Auto-scan failed (${res.status})`);
      }

      // /scan/{shelf_id} returns immediately with a job_id -- the actual
      // detection + analytics pipeline runs in a background worker. Poll
      // GET /scan/jobs/{job_id} until it's done, same as new-scan.tsx.
      const { job_id: jobId } = await res.json();
      LOG("captureAndScan: job queued,", jobId, "-- polling for completion");
      const data = await pollScanJob(jobId, authHeaders);
      LOG("captureAndScan: scan complete, health score =", data.health.score);

      // Same cache invalidation as a manual scan (see new-scan.tsx) so every
      // page reflects the new scan immediately, whichever page is open.
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListShelvesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetShelfHistoryQueryKey(shelfId) });
      queryClient.invalidateQueries({ queryKey: getGetShelfAlertHistoryQueryKey(shelfId) });
      queryClient.invalidateQueries({ queryKey: getCompareShelfScansQueryKey(shelfId) });
      queryClient.invalidateQueries({ queryKey: getGetShelfSalesEstimateQueryKey(shelfId) });
      queryClient.invalidateQueries({ queryKey: getGetStoreSalesEstimateQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDemandAnalyticsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalyticsReportQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPeakHoursQueryKey() });
      queryClient.invalidateQueries({ queryKey: getCompareStoresQueryKey() });

      showPopup({ kind: "complete", shelfId, score: data.health.score, priority: data.restocking.priority });
    } catch (err) {
      LOG("captureAndScan: FAILED:", err);
      showPopup({ kind: "error", message: err instanceof Error ? err.message : "Auto-scan failed." });
    } finally {
      capturingRef.current = false;
    }
  }, [shelfId, ensureStream, session?.accessToken, queryClient, showPopup, pollScanJob]);

  // Mirrors AutoScanScheduler._check_store in scan_scheduler.py: don't fire
  // immediately when a store becomes due, wait a full interval first, then
  // fire every time the interval elapses.
  useEffect(() => {
    if (!active) {
      LOG("scheduler: inactive, not starting timer");
      return;
    }
    const intervalMinutes = schedule?.enabled ? schedule?.current_interval_minutes ?? null : null;
    LOG("scheduler: (re)starting timer loop. schedule.enabled =", schedule?.enabled, ", resolved intervalMinutes =", intervalMinutes);

    const tick = () => {
      if (intervalMinutes == null) {
        LOG("tick: no active interval right now (schedule disabled or outside business hours) -- nothing scheduled");
        nextCaptureAtRef.current = null;
        armedIntervalMinutesRef.current = null;
        return;
      }
      const now = Date.now();
      if (nextCaptureAtRef.current == null || armedIntervalMinutesRef.current !== intervalMinutes) {
        nextCaptureAtRef.current = now + intervalMinutes * 60_000;
        armedIntervalMinutesRef.current = intervalMinutes;
        LOG(
          "tick: (re)arming next capture for",
          new Date(nextCaptureAtRef.current).toLocaleTimeString(),
          "(interval =", intervalMinutes, "min)"
        );
        return;
      }
      const secondsLeft = Math.round((nextCaptureAtRef.current - now) / 1000);
      if (now >= nextCaptureAtRef.current) {
        LOG("tick: due now -- firing capture");
        nextCaptureAtRef.current = now + intervalMinutes * 60_000;
        captureAndScan();
      } else {
        LOG("tick: not due yet,", secondsLeft, "second(s) remaining");
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [active, schedule?.enabled, schedule?.current_interval_minutes, captureAndScan]);

  if (!active) return null;

  return (
    <>
      {/* Hidden, always-on preview feed used purely as the capture source. */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {cameraDenied && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-background shadow-lg p-3 flex items-start gap-2 text-sm animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Auto-scan camera unavailable</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Camera access wasn't granted, so automatic capture is paused. Re-enable it from
              Profile → Auto Scan Scheduler.
            </p>
          </div>
        </div>
      )}

      {popup && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            {popup.kind === "error" ? (
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            ) : (
              <Camera className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            )}
            <div className="flex-1 text-sm">
              {popup.kind === "captured" && (
                <>
                  <p className="font-medium">Shelf photo captured</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Automatically captured shelf {popup.shelfId}. Running detection now…
                  </p>
                </>
              )}
              {popup.kind === "complete" && (
                <>
                  <p className="font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Auto-scan complete
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Shelf {popup.shelfId} scored {popup.score.toFixed(1)} ({popup.priority} priority).
                  </p>
                </>
              )}
              {popup.kind === "error" && (
                <>
                  <p className="font-medium">Auto-scan failed</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{popup.message}</p>
                </>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1 shrink-0"
              onClick={dismissPopup}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button type="button" variant="secondary" size="sm" className="w-full mt-3" onClick={dismissPopup}>
            Acknowledge
          </Button>
        </div>
      )}
    </>
  );
}
