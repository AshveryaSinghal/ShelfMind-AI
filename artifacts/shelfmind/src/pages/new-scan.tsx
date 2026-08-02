import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, Image as ImageIcon, X, Loader2, CheckCircle2, AlertTriangle, Camera, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useNewScanSession } from "@/lib/new-scan-session";
import {
  ScanResult,
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
} from "@workspace/api-client-react";
import { getCompareStoresQueryKey } from "@/lib/stores";
import { formatPercentage, getHealthColorClass, getRestockingPriorityColorClass } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const CRITICAL_PRIORITIES = new Set(["Critical", "High"]);

const isBrowserUndecodableImage = (f: File): boolean => {
  const name = f.name.toLowerCase();
  return (
    f.type === "image/heic" ||
    f.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
};

export default function NewScan() {
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Persisted across tab navigation -- see src/lib/new-scan-session.tsx.
  // This state lives in a provider above the router, so leaving the Scan
  // tab and coming back (or an in-flight scan finishing while the user is
  // elsewhere) no longer wipes out the image/results.
  const {
    file,
    preview,
    previewFailed,
    shelfId,
    notes,
    isScanning,
    scanStage,
    result,
    severeAlert,
    setShelfId,
    setNotes,
    setPreviewFailed,
    setIsScanning,
    setScanStage,
    setResult,
    setSevereAlert,
    selectFile,
    clearScan,
  } = useNewScanSession();

  const [modelUnavailable, setModelUnavailable] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
    fetch(`${apiBase}/api/shelfmind/health`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.model_configured === false) setModelUnavailable(true);
      })
      .catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const openCamera = useCallback(async (mode: "environment" | "user" = facingMode) => {
    setCameraError(null);
    setIsCameraOpen(true);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access isn't supported in this browser. Use the upload option instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFacingMode(mode);
    } catch (err) {
      setCameraError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access or use the upload option instead."
          : "Couldn't access the camera. Use the upload option instead.",
      );
    }
  }, [facingMode, stopCamera]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setIsCameraOpen(false);
    setCameraError(null);
  }, [stopCamera]);

  const switchCamera = () => openCamera(facingMode === "environment" ? "user" : "environment");

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const captured = new File([blob], `shelf-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      selectFile(captured, URL.createObjectURL(captured));
      closeCamera();
    }, "image/jpeg", 0.92);
  };

  useEffect(() => stopCamera, [stopCamera]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      selectFile(selected, URL.createObjectURL(selected));
      if (isBrowserUndecodableImage(selected)) setPreviewFailed(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      if (selected.type.startsWith("image/") || isBrowserUndecodableImage(selected)) {
        selectFile(selected, URL.createObjectURL(selected));
        if (isBrowserUndecodableImage(selected)) setPreviewFailed(true);
      }
    }
  };

  const recommendationFor = (priority: string): string => {
    switch (priority) {
      case "Critical":
        return "Restock immediately. This shelf is severely under-stocked.";
      case "High":
        return "Schedule restocking as soon as possible today.";
      case "Medium":
        return "Plan a restock during the next regular cycle.";
      default:
        return "No action needed right now. Keep monitoring.";
    }
  };

  const clearImage = () => {
    clearScan();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pollScanJob = async (apiBase: string, jobId: string): Promise<ScanResult> => {
    const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined;
    const POLL_INTERVAL_MS = 800;
    const MAX_POLLS = 225; // ~3 minutes at 800ms/poll, generous for a cold-started detector

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const res = await fetch(`${apiBase}/api/shelfmind/scan/jobs/${encodeURIComponent(jobId)}`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `Could not check scan status (${res.status})`);
      }
      const job = await res.json();

      if (job.status === "COMPLETED") return job.result as ScanResult;
      if (job.status === "FAILED") throw new Error(job.error || "Scan processing failed.");

      // Still PENDING or PROCESSING -- update the status label and wait.
      setScanStage(job.status === "PROCESSING" ? "Analyzing shelf image..." : "Waiting in queue...");
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error("Scan is taking longer than expected. Check back shortly on the shelf's history.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({ title: "Image required", description: "Please upload an image of the shelf.", variant: "destructive" });
      return;
    }
    if (!shelfId.trim()) {
      toast({ title: "Shelf ID required", description: "Please enter an identifier for this shelf.", variant: "destructive" });
      return;
    }

    setIsScanning(true);
    setResult(null);
    setScanStage("Uploading image...");

    const formData = new FormData();
    formData.append("image", file);
    if (notes) formData.append("notes", notes);

    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/shelfmind/scan/${encodeURIComponent(shelfId)}`, {
        method: "POST",
        headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.detail || body?.message;
        if (res.status === 503) {
          setModelUnavailable(true);
          toast({
            title: "No Detection Model Configured",
            description: detail || "No trained detection model is available. Scanning is disabled until one is configured.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(detail || `Scan failed with status ${res.status}`);
      }

      // The API returns immediately with a job_id -- the actual detection
      // + analytics pipeline runs in a background worker. Poll for it.
      const { job_id: jobId } = await res.json();
      setScanStage("Waiting in queue...");
      const data = await pollScanJob(apiBase, jobId);
      setResult(data);

      // A scan can change: this shelf's current alerts (raised or cleared),
      // the store-wide alert list, the shelves list (health/occupancy/alert
      // count badges), the dashboard aggregates, this shelf's own
      // history/alert-history/comparison, and every units-sold estimate
      // derived from this shelf's counts (store sales estimate, demand/peak
      // hours analytics, and the cross-store comparison page). Invalidate
      // all of them so every page reflects the new scan immediately instead
      // of showing stale cached data until some unrelated remount happens
      // to refetch it.
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

      const priority = data.restocking.priority;
      if (CRITICAL_PRIORITIES.has(priority)) {
        setSevereAlert({
          shelfId,
          priority,
          reason: data.restocking.reason,
          recommendation: recommendationFor(priority),
        });
      } else {
        toast({
          title: "Scan Complete",
          description: `Successfully analyzed shelf ${shelfId}. Score: ${data.health.score.toFixed(1)}`,
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Scan Error",
        description: error instanceof Error ? error.message : "An error occurred while analyzing the image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
      setScanStage(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Scan</h1>
        <p className="text-muted-foreground mt-1">Upload a shelf image for instant AI analysis.</p>
      </div>

      {modelUnavailable && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">No detection model configured</p>
              <p className="text-muted-foreground mt-1">
                Scanning is disabled until a trained detection model is installed on the server.
                No analytics will be fabricated in the meantime.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Scan Details</CardTitle>
              <CardDescription>Provide the image and identifying information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shelfId">Shelf ID <span className="text-red-500">*</span></Label>
                <Input
                  id="shelfId"
                  placeholder="e.g., AISLE-14-A"
                  value={shelfId}
                  onChange={(e) => setShelfId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Shelf Image <span className="text-red-500">*</span></Label>

                {!preview ? (
                  <div className="space-y-3">
                    <div
                      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 sm:p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[180px] sm:min-h-[200px]"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="font-medium mb-1 text-center">Tap to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground text-center">
                        JPG, PNG, WEBP, BMP, JFIF, HEIC/HEIF up to 10MB
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.heic,.heif"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => openCamera()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Use Camera
                    </Button>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border bg-muted group">
                    {previewFailed ? (
                      <div className="w-full h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/40">
                        <ImageIcon className="h-10 w-10" />
                        <p className="text-sm font-medium text-foreground px-4 text-center truncate max-w-full">
                          {file?.name}
                        </p>
                        <p className="text-xs px-4 text-center">
                          Preview isn't available for this format in this browser, but it will
                          still be processed normally.
                        </p>
                      </div>
                    ) : (
                      <img
                        src={preview}
                        alt="Shelf preview"
                        className="w-full h-auto object-cover max-h-[300px]"
                        onError={() => setPreviewFailed(true)}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button type="button" variant="destructive" size="sm" onClick={clearImage}>
                        <X className="h-4 w-4 mr-2" /> Remove Image
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any context about this scan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isScanning || !file || !shelfId || modelUnavailable}>
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {scanStage || "Running detection model..."}
                  </>
                ) : modelUnavailable ? (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    No Model Configured
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Process Image
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {result ? (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Analysis Complete
                </CardTitle>
                <Badge variant="outline" className={getHealthColorClass(result.health.score)}>
                  {result.health.label} ({Math.round(result.health.score)})
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-md p-3 border">
                  <div className="text-xs text-muted-foreground mb-1">Occupancy</div>
                  <div className="text-xl font-bold">{formatPercentage(result.occupancy.shelf_occupancy_pct)}</div>
                </div>
                <div className="bg-background rounded-md p-3 border">
                  <div className="text-xs text-muted-foreground mb-1">Empty Space</div>
                  <div className="text-xl font-bold">{formatPercentage(result.occupancy.empty_space_pct)}</div>
                </div>
                <div className="bg-background rounded-md p-3 border">
                  <div className="text-xs text-muted-foreground mb-1">Items Detected</div>
                  <div className="text-xl font-bold">{result.detection.count}</div>
                </div>
                <div className="bg-background rounded-md p-3 border">
                  <div className="text-xs text-muted-foreground mb-1">Restock Priority</div>
                  <div className="font-bold">
                    <Badge variant="outline" className={getRestockingPriorityColorClass(result.restocking.priority)}>
                      {result.restocking.priority}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center justify-between">
                  Action Required
                  {result.alerts.length > 0 && (
                    <Badge variant="destructive" className="ml-2 rounded-full px-2 py-0">
                      {result.alerts.length} Alerts
                    </Badge>
                  )}
                </h4>
                <div className="text-sm bg-background p-3 rounded-md border text-muted-foreground">
                  {result.restocking.reason}
                </div>
              </div>

              {result.report && (
                <div>
                  <h4 className="font-semibold mb-2">Automated Report</h4>
                  <div className="text-sm bg-background p-4 rounded-md border prose prose-sm dark:prose-invert">
                    <p>{result.report}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="h-full min-h-[400px] border-2 border-dashed rounded-xl border-muted flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/10">
            {isScanning ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="font-medium text-foreground">{scanStage || "Running the detection model..."}</p>
                <p className="text-sm mt-2 max-w-xs">Detecting products, analyzing gaps, and computing health score.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-50">
                <ImageIcon className="h-16 w-16 mb-4" />
                <p className="font-medium text-lg">Awaiting Image</p>
                <p className="text-sm max-w-[250px] mt-2">Upload a scan to see occupancy metrics, health scores, and restocking recommendations.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live camera capture */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => (open ? openCamera() : closeCamera())}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Capture Shelf Photo</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-[4/3] w-full flex items-center justify-center">
            {cameraError ? (
              <div className="text-center text-sm text-white p-6">{cameraError}</div>
            ) : (
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex items-center justify-between gap-2 p-4">
            <Button type="button" variant="ghost" onClick={closeCamera}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={switchCamera} disabled={!!cameraError} title="Switch camera">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button type="button" onClick={capturePhoto} disabled={!!cameraError}>
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Critical/High severity alert — Medium/Low use the normal toast above */}
      <AlertDialog open={!!severeAlert} onOpenChange={(open) => !open && setSevereAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {severeAlert?.priority} Shelf Alert
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left pt-2">
                <p className="text-foreground">
                  Shelf <span className="font-semibold">{severeAlert?.shelfId}</span> requires immediate restocking.
                </p>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium text-foreground">Priority: </span>
                    <Badge variant="destructive">{severeAlert?.priority}</Badge>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Reason:</p>
                    <p>{severeAlert?.reason}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Recommendation:</p>
                    <p>{severeAlert?.recommendation}</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSevereAlert(null)}>Acknowledge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
