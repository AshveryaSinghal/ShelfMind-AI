import { useEffect, useRef, useState } from "react";
import { useGetSchedule, useUpdateSchedule, getGetScheduleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Trash2, CheckCircle2, Globe, Camera, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getAutoCaptureSettings, setAutoCaptureSettings } from "@/lib/auto-scan-settings";

interface PeakWindowDraft {
  start: string;
  end: string;
}

export function AutoScanScheduleCard() {
  const { data: schedule, isLoading } = useGetSchedule();
  const updateSchedule = useUpdateSchedule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("21:00");
  const [peakWindows, setPeakWindows] = useState<PeakWindowDraft[]>([]);
  const [weekendPeakWindows, setWeekendPeakWindows] = useState<PeakWindowDraft[]>([]);
  const [useSeparateWeekendHours, setUseSeparateWeekendHours] = useState(false);
  const [peakInterval, setPeakInterval] = useState(15);
  const [offpeakInterval, setOffpeakInterval] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Per-device settings: whether this browser/camera should actually
  // capture and upload photos automatically, and which shelf to attribute
  // them to. Stored locally (not on the store account) since it's tied to
  // whichever camera is plugged into this specific device.
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [autoCaptureShelfId, setAutoCaptureShelfId] = useState("");
  const [deviceSaved, setDeviceSaved] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "checking" | "granted" | "denied">("idle");
  const permissionStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const stored = getAutoCaptureSettings();
    setAutoCaptureEnabled(stored.enabled);
    setAutoCaptureShelfId(stored.shelfId);
  }, []);

  const testCameraPermission = async () => {
    setCameraStatus("checking");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("denied");
        return;
      }
      // This is the one and only prompt the browser will show: once granted
      // for this site, future captures reuse it silently.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStreamRef.current = stream;
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus("granted");
    } catch {
      setCameraStatus("denied");
    }
  };

  const handleSaveDeviceSettings = () => {
    const next = { enabled: autoCaptureEnabled, shelfId: autoCaptureShelfId.trim() };
    setAutoCaptureSettings(next);
    setDeviceSaved(true);
    toast({
      title: next.enabled ? "Automatic capture enabled" : "Automatic capture disabled",
      description: next.enabled
        ? `This device will silently capture and scan shelf ${next.shelfId || "(not set)"} on the schedule below, as long as this tab stays open.`
        : "This device will no longer capture photos automatically.",
    });
  };

  useEffect(() => {
    if (!schedule) return;
    setEnabled(schedule.enabled);
    setOpeningTime(schedule.opening_time);
    setClosingTime(schedule.closing_time);
    setPeakWindows(schedule.peak_windows ?? []);
    setWeekendPeakWindows(schedule.weekend_peak_windows ?? []);
    setUseSeparateWeekendHours((schedule.weekend_peak_windows ?? []).length > 0);
    setPeakInterval(schedule.peak_interval_minutes);
    setOffpeakInterval(schedule.offpeak_interval_minutes);
  }, [schedule]);

  const addPeakWindow = () => setPeakWindows((w) => [...w, { start: "11:00", end: "14:00" }]);
  const removePeakWindow = (index: number) => setPeakWindows((w) => w.filter((_, i) => i !== index));
  const updatePeakWindow = (index: number, field: keyof PeakWindowDraft, value: string) =>
    setPeakWindows((w) => w.map((win, i) => (i === index ? { ...win, [field]: value } : win)));

  const addWeekendPeakWindow = () => setWeekendPeakWindows((w) => [...w, { start: "11:00", end: "14:00" }]);
  const removeWeekendPeakWindow = (index: number) => setWeekendPeakWindows((w) => w.filter((_, i) => i !== index));
  const updateWeekendPeakWindow = (index: number, field: keyof PeakWindowDraft, value: string) =>
    setWeekendPeakWindows((w) => w.map((win, i) => (i === index ? { ...win, [field]: value } : win)));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateSchedule.mutateAsync({
        data: {
          enabled,
          // No timezone here -- the backend always uses the timezone tied
          // to your profile/country, so there's nothing to set separately.
          opening_time: openingTime,
          closing_time: closingTime,
          peak_windows: peakWindows,
          weekend_peak_windows: useSeparateWeekendHours ? weekendPeakWindows : [],
          peak_interval_minutes: peakInterval,
          offpeak_interval_minutes: offpeakInterval,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetScheduleQueryKey() });
      setSaved(true);
      toast({ title: "Auto scan schedule updated", description: "Your scan schedule has been saved." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the scan schedule.");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto Scan Scheduler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto Scan Scheduler</CardTitle>
        <CardDescription>
          Sets how often a scan is due. More often during peak hours, less often outside business hours.
          By default this just reminds staff to scan. Turn on automatic capture below to have a connected
          camera do it by itself instead.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSave}>
        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {saved && !error && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Schedule saved.</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="auto-scan-enabled" className="text-sm font-medium">Enable auto-scan schedule</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Disable to pause all scheduling for this store.</p>
            </div>
            <Switch id="auto-scan-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span>
              Store hours below use your profile's timezone{schedule?.timezone ? ` (${schedule.timezone})` : ""}.
              Change it from <Link href="/profile"><span className="text-primary hover:underline cursor-pointer">Profile → Country</span></Link>, not here.
            </span>
          </div>

          <div className="space-y-4 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-capture-enabled" className="text-sm font-medium flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Automatic capture (this device)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When on, this device's camera captures and scans a photo by itself on the schedule
                  below, no clicking, no re-prompting. This setting only applies to this browser/device,
                  since it's tied to whatever camera is plugged in here.
                </p>
              </div>
              <Switch id="auto-capture-enabled" checked={autoCaptureEnabled} onCheckedChange={setAutoCaptureEnabled} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-capture-shelf">Shelf ID to scan automatically</Label>
              <Input
                id="auto-capture-shelf"
                placeholder="e.g., AISLE-14-A"
                value={autoCaptureShelfId}
                onChange={(e) => setAutoCaptureShelfId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Every automatic capture on this device is uploaded and scanned under this shelf ID.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={testCameraPermission} disabled={cameraStatus === "checking"}>
                {cameraStatus === "checking" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5 mr-2" />
                )}
                Test camera access
              </Button>
              {cameraStatus === "granted" && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Camera permission granted
                </span>
              )}
              {cameraStatus === "denied" && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Camera access unavailable or denied
                </span>
              )}
              <Button type="button" size="sm" onClick={handleSaveDeviceSettings} className="ml-auto">
                Save device settings
              </Button>
            </div>
            {deviceSaved && (
              <p className="text-xs text-muted-foreground">
                Saved. The browser will only ask for camera permission once. After that,
                captures happen silently in the background while this tab is open.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening-time">Store Opening Time</Label>
              <Input id="opening-time" type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing-time">Store Closing Time</Label>
              <Input id="closing-time" type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Peak Hours {useSeparateWeekendHours ? "(Weekdays)" : ""}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPeakWindow} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add window
              </Button>
            </div>
            {peakWindows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No peak windows set. Every business hour uses the off-peak interval.</p>
            ) : (
              <div className="space-y-2">
                {peakWindows.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" value={w.start} onChange={(e) => updatePeakWindow(i, "start", e.target.value)} />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input type="time" value={w.end} onChange={(e) => updatePeakWindow(i, "end", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePeakWindow(i)} aria-label="Remove peak window">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="separate-weekend-hours" className="text-sm font-medium">
                Use different peak hours on weekends
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Off by default. Weekends use the same peak windows as weekdays. Turn this on if Saturday
                and Sunday actually get busy at different times.
              </p>
            </div>
            <Switch
              id="separate-weekend-hours"
              checked={useSeparateWeekendHours}
              onCheckedChange={setUseSeparateWeekendHours}
            />
          </div>

          {useSeparateWeekendHours && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Peak Hours (Weekends)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addWeekendPeakWindow} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add window
                </Button>
              </div>
              {weekendPeakWindows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No weekend peak windows set yet. Weekends will keep using the weekday peak windows above
                  until you add one here.
                </p>
              ) : (
                <div className="space-y-2">
                  {weekendPeakWindows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" value={w.start} onChange={(e) => updateWeekendPeakWindow(i, "start", e.target.value)} />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input type="time" value={w.end} onChange={(e) => updateWeekendPeakWindow(i, "end", e.target.value)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeWeekendPeakWindow(i)} aria-label="Remove weekend peak window">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peak-interval">Peak interval (minutes)</Label>
              <Input
                id="peak-interval"
                type="number"
                min={1}
                value={peakInterval}
                onChange={(e) => setPeakInterval(Number(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">Recommended: 15 to 20 minutes</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offpeak-interval">Off-peak interval (minutes)</Label>
              <Input
                id="offpeak-interval"
                type="number"
                min={1}
                value={offpeakInterval}
                onChange={(e) => setOffpeakInterval(Number(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">Recommended: 60 to 120 minutes</p>
            </div>
          </div>

          {schedule?.current_interval_minutes != null ? (
            <p className="text-xs text-muted-foreground">
              Right now, the next reminder would be scheduled every {schedule.current_interval_minutes} minute(s).
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Outside business hours (or disabled) right now. No reminders will fire.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={updateSchedule.isPending}>
            {updateSchedule.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Schedule
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
