import { AlertTriangle, Info, AlertCircle, ShieldAlert } from "lucide-react";

export function getHealthColorClass(score: number): string {
  if (score > 85) return "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800";
  if (score > 70) return "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
  if (score > 50) return "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  if (score > 30) return "text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-800";
  return "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800";
}

export function getRestockingPriorityColorClass(priority: string): string {
  const p = priority?.toLowerCase() || "";
  if (p === "critical") return "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800";
  if (p === "high") return "text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-800";
  if (p === "medium") return "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  if (p === "low") return "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800";
  return "text-muted-foreground bg-muted border-border";
}

export function getAlertSeverityColorClass(severity: string): string {
  const s = severity?.toLowerCase() || "";
  if (s === "critical") return "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800";
  if (s === "warning") return "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  if (s === "info") return "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
  return "text-muted-foreground bg-muted border-border";
}

export function AlertIcon({ severity, className = "" }: { severity: string, className?: string }) {
  const s = severity?.toLowerCase() || "";
  if (s === "critical") return <ShieldAlert className={`text-red-600 dark:text-red-400 ${className}`} />;
  if (s === "warning") return <AlertTriangle className={`text-amber-600 dark:text-amber-400 ${className}`} />;
  if (s === "info") return <Info className={`text-blue-600 dark:text-blue-400 ${className}`} />;
  return <AlertCircle className={`text-muted-foreground ${className}`} />;
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string | null | undefined, timeZone?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return dateStr;
  }
}
