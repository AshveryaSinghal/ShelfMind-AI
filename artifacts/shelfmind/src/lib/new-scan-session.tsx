import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { ScanResult } from "@workspace/api-client-react";

/**
 * In-memory "session" for the New Scan page (selected image, shelf id,
 * notes, in-flight scan progress, and the last result / severe alert).
 *
 * This is intentionally NOT local state inside the NewScan page component.
 * The app's router unmounts the page whenever the user navigates to a
 * different tab, which used to wipe out the uploaded image and results the
 * instant someone left the Scan tab -- even mid-scan. By lifting the state
 * up into a provider that lives above the router's <Switch> (see
 * AuthenticatedApp in App.tsx), the state -- and any scan poll that's still
 * running in the background -- survives switching tabs. It only resets when
 * the user explicitly starts a new scan / clears the image, or when the
 * whole app reloads (nothing here touches localStorage/sessionStorage on
 * purpose, per the "until the website is reloaded" requirement).
 */

export interface SevereAlertInfo {
  shelfId: string;
  priority: string;
  reason: string;
  recommendation: string;
}

interface NewScanSessionValue {
  file: File | null;
  preview: string | null;
  previewFailed: boolean;
  shelfId: string;
  notes: string;
  isScanning: boolean;
  scanStage: string | null;
  result: ScanResult | null;
  severeAlert: SevereAlertInfo | null;

  setShelfId: (v: string) => void;
  setNotes: (v: string) => void;
  setPreviewFailed: (v: boolean) => void;
  setIsScanning: (v: boolean) => void;
  setScanStage: (v: string | null) => void;
  setResult: (v: ScanResult | null) => void;
  setSevereAlert: (v: SevereAlertInfo | null) => void;
  /** Selects a new image (from file picker, drag/drop, or camera capture). */
  selectFile: (file: File, previewUrl: string) => void;
  /** Clears the selected image/result, e.g. to start a fresh scan. */
  clearScan: () => void;
}

const NewScanSessionContext = createContext<NewScanSessionValue | undefined>(undefined);

export function NewScanSessionProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [shelfId, setShelfId] = useState("");
  const [notes, setNotes] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [severeAlert, setSevereAlert] = useState<SevereAlertInfo | null>(null);

  const selectFile = useCallback((newFile: File, previewUrl: string) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = previewUrl;
    setFile(newFile);
    setPreview(previewUrl);
    setResult(null);
    setPreviewFailed(false);
  }, []);

  const clearScan = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setFile(null);
    setPreview(null);
    setPreviewFailed(false);
    setResult(null);
  }, []);

  const value: NewScanSessionValue = {
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
  };

  return <NewScanSessionContext.Provider value={value}>{children}</NewScanSessionContext.Provider>;
}

export function useNewScanSession() {
  const ctx = useContext(NewScanSessionContext);
  if (!ctx) throw new Error("useNewScanSession must be used within a NewScanSessionProvider");
  return ctx;
}
