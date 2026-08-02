import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { BarChart2, Loader2, Eye, EyeOff, Store, User, Lock, Mail, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, ApiError, checkUsernameAvailability } from "@/lib/auth";
import { StoreLocationFields, type StoreLocation } from "@/components/store-location-fields";

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="pl-9 pr-9"
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function Login() {
  const { login, signup } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupUsername, setSignupUsername] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<{
    status: "idle" | "checking" | "available" | "taken";
    reason: string | null;
    suggestions: string[];
  }>({ status: "idle", reason: null, suggestions: [] });
  const usernameCheckSeq = useRef(0);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupStoreName, setSignupStoreName] = useState("");
  const [signupLocation, setSignupLocation] = useState<StoreLocation>({ country: "IN", address: "" });
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  useEffect(() => {
    const username = signupUsername.trim();
    if (username.length < 3) {
      setUsernameCheck({ status: "idle", reason: null, suggestions: [] });
      return;
    }
    setUsernameCheck((prev) => ({ ...prev, status: "checking" }));
    const seq = ++usernameCheckSeq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(username);
        if (usernameCheckSeq.current !== seq) return; // a newer keystroke won this race
        setUsernameCheck({
          status: result.available ? "available" : "taken",
          reason: result.reason,
          suggestions: result.suggestions,
        });
      } catch {
        if (usernameCheckSeq.current !== seq) return;
        setUsernameCheck({ status: "idle", reason: null, suggestions: [] });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [signupUsername]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(loginUsername.trim(), loginPassword);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (signupPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!signupStoreName.trim()) {
      setError("Store name is required.");
      return;
    }
    if (!signupEmail.trim()) {
      setError("Email is required.");
      return;
    }
    if (usernameCheck.status === "taken") {
      setError(usernameCheck.reason || "That username is already taken.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(
        signupUsername.trim(),
        signupPassword,
        signupStoreName.trim(),
        signupEmail.trim(),
        signupLocation.country,
        { address: signupLocation.address, latitude: signupLocation.latitude, longitude: signupLocation.longitude },
      );
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.suggestions.length) {
          setUsernameCheck({ status: "taken", reason: err.message, suggestions: err.suggestions });
        }
      } else {
        setError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart2 className="w-7 h-7 text-primary" />
            ShelfMind AI
          </div>
          <p className="text-muted-foreground text-sm">
            Sign in to your store, or create a new store account.
          </p>
        </div>

        <Card>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "login" | "signup"); setError(null); }}>
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login" className="mt-0">
                <CardDescription className="mb-4">
                  Log in to see only your store's scans, shelves, and alerts.
                </CardDescription>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        autoComplete="username"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <PasswordInput
                      id="login-password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      autoComplete="current-password"
                    />
                    <div className="text-right">
                      <Link href="/forgot-password">
                        <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                          Forgot password?
                        </span>
                      </Link>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Log In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <CardDescription className="mb-4">
                  Create your account and your first store. You can add more
                  stores/branches to the same account later.
                </CardDescription>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-store">Store Name</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-store"
                        placeholder="e.g., Downtown Store 1"
                        value={signupStoreName}
                        onChange={(e) => setSignupStoreName(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-username"
                        placeholder="3-32 characters"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                        autoComplete="username"
                        className="pl-9 pr-9"
                        aria-invalid={usernameCheck.status === "taken"}
                        required
                      />
                      {usernameCheck.status === "checking" && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {usernameCheck.status === "available" && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                      )}
                      {usernameCheck.status === "taken" && (
                        <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                      )}
                    </div>
                    {usernameCheck.status === "taken" && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-destructive">
                          "{signupUsername.trim()}" is already taken.
                          {usernameCheck.suggestions.length > 0 && " Try one of these instead:"}
                        </p>
                        {usernameCheck.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {usernameCheck.suggestions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSignupUsername(s)}
                                className="text-xs px-2 py-1 rounded-full border border-input bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {usernameCheck.status === "available" && (
                      <p className="text-xs text-green-600">"{signupUsername.trim()}" is available.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        autoComplete="email"
                        className="pl-9"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      One account per email, used for sign-in recovery and store notifications.
                    </p>
                  </div>
                  <StoreLocationFields
                    idPrefix="signup"
                    value={signupLocation}
                    onChange={setSignupLocation}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <PasswordInput
                      id="signup-password"
                      value={signupPassword}
                      onChange={setSignupPassword}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <PasswordInput
                      id="signup-confirm-password"
                      value={signupConfirmPassword}
                      onChange={setSignupConfirmPassword}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || usernameCheck.status === "checking" || usernameCheck.status === "taken"}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
