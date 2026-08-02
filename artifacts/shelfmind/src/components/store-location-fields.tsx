import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CountrySelect } from "@/components/country-select";
import { LocateFixed, Loader2, MapPin, CheckCircle2 } from "lucide-react";

export interface StoreLocation {
  country: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Address + country + "use my current location" fields for a single store.
 * Country drives the scan-schedule timezone on the backend; latitude/
 * longitude (captured via the browser's geolocation API) are stored for a
 * more precise pin, but are optional -- country alone is enough to get a
 * sensible default timezone.
 */
export function StoreLocationFields({
  value,
  onChange,
  idPrefix = "store-location",
}: {
  value: StoreLocation;
  onChange: (next: StoreLocation) => void;
  idPrefix?: string;
}) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocateError("Location access isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      (err) => {
        setLocateError(err.message || "Couldn't get your location. You can still enter it manually.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-country`}>Country</Label>
        <CountrySelect
          id={`${idPrefix}-country`}
          value={value.country}
          onValueChange={(country) => onChange({ ...value, country })}
        />
        <p className="text-xs text-muted-foreground">
          Sets this store's local timezone, so scan times and schedules match its actual location.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address`}>Address (optional)</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id={`${idPrefix}-address`}
            placeholder="e.g., 12 Grafton Street, Dublin"
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="gap-2"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : value.latitude !== undefined ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
          {value.latitude !== undefined ? "Location captured" : "Use my current location"}
        </Button>
        {locateError && <p className="text-xs text-destructive">{locateError}</p>}
        {value.latitude !== undefined && value.longitude !== undefined && (
          <p className="text-xs text-muted-foreground">
            {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
}
