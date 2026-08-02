import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Store, Plus, MapPin, CheckCircle2, Loader2, LineChart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listMyStores, addStore, switchStore, type OwnedStore } from "@/lib/stores";
import { StoreLocationFields, type StoreLocation } from "@/components/store-location-fields";
import { useToast } from "@/hooks/use-toast";

export default function Stores() {
  const { session, applyAccessToken } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [stores, setStores] = useState<OwnedStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreLocation, setNewStoreLocation] = useState<StoreLocation>({ country: "IN", address: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadStores = async () => {
    try {
      const data = await listMyStores(session?.accessToken);
      setStores(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load stores.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  const handleSwitch = async (store: OwnedStore) => {
    setSwitchingId(store.id);
    try {
      const result = await switchStore(session?.accessToken, store.id);
      applyAccessToken(result.access_token);
      toast({ title: `Switched to ${result.store_name}`, description: "This store is now active." });
      navigate("/");
    } catch (err) {
      toast({
        title: "Couldn't switch store",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newStoreName.trim()) {
      setAddError("Store name is required.");
      return;
    }
    setAdding(true);
    try {
      const created = await addStore(session?.accessToken, {
        store_name: newStoreName.trim(),
        country: newStoreLocation.country,
        address: newStoreLocation.address || undefined,
        latitude: newStoreLocation.latitude,
        longitude: newStoreLocation.longitude,
      });
      setDialogOpen(false);
      setNewStoreName("");
      setNewStoreLocation({ country: "IN", address: "" });
      await loadStores();
      toast({ title: "Store added", description: `${created.name} is now part of your account.` });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add store.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Stores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All the stores and branches under your account. Switch between them or add a new one.
          </p>
        </div>
        <div className="flex gap-2">
          {stores.length > 1 && (
            <Button variant="outline" onClick={() => navigate("/stores/compare")} className="gap-2">
              <LineChart className="w-4 h-4" />
              Compare Stores
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new store</DialogTitle>
                <DialogDescription>
                  Add another branch to your account, for example a second store in a different city or country.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStore} className="space-y-4">
                {addError && (
                  <Alert variant="destructive">
                    <AlertDescription>{addError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-store-name">Store name</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-store-name"
                      placeholder="e.g., Dublin Branch"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <StoreLocationFields
                  idPrefix="new-store"
                  value={newStoreLocation}
                  onChange={setNewStoreLocation}
                />
                <DialogFooter>
                  <Button type="submit" disabled={adding} className="gap-2">
                    {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add Store
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => {
            const isActive = store.id === session?.storeId;
            return (
              <Card key={store.id} className={isActive ? "border-primary" : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Store className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{store.name}</span>
                    </CardTitle>
                    {isActive && (
                      <Badge className="gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </Badge>
                    )}
                  </div>
                  {(store.address || store.country) && (
                    <CardDescription className="flex items-start gap-1.5 text-xs">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="truncate">
                        {[store.address, store.country].filter(Boolean).join(", ")}
                      </span>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{store.timezone}</span>
                  <Button
                    size="sm"
                    variant={isActive ? "secondary" : "outline"}
                    disabled={isActive || switchingId === store.id}
                    onClick={() => handleSwitch(store)}
                  >
                    {switchingId === store.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isActive ? (
                      "Viewing"
                    ) : (
                      "Switch to this store"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
