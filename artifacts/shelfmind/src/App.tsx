import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth";
import { NewScanSessionProvider } from "@/lib/new-scan-session";
import { AutoScanCaptureManager } from "@/components/auto-scan-capture-manager";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Shelves from "@/pages/shelves";
import ShelfDetail from "@/pages/shelf-detail";
import NewScan from "@/pages/new-scan";
import Alerts from "@/pages/alerts";
import Analytics from "@/pages/analytics";
import StoreReport from "@/pages/store-report";
import Assistant from "@/pages/assistant";
import Login from "@/pages/login";
import Profile from "@/pages/profile";
import Stores from "@/pages/stores";
import StoreComparison from "@/pages/store-comparison";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import { Loader2 } from "lucide-react";
import React from "react";

const queryClient = new QueryClient();

function FullScreenLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    // NewScanSessionProvider lives here, above the <Switch>, so it is never
    // unmounted when the user navigates between tabs -- only the matched
    // route component below it swaps out. This is what keeps an in-progress
    // or completed scan alive when the person leaves the Scan tab and comes
    // back. See src/lib/new-scan-session.tsx for details.
    <NewScanSessionProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/shelves" component={Shelves} />
          <Route path="/shelves/:id" component={ShelfDetail} />
          <Route path="/scan" component={NewScan} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/report" component={StoreReport} />
          <Route path="/assistant" component={Assistant} />
          <Route path="/profile" component={Profile} />
          <Route path="/stores" component={Stores} />
          <Route path="/stores/compare" component={StoreComparison} />
          <Route component={NotFound} />
        </Switch>
        <AutoScanCaptureManager />
      </Layout>
    </NewScanSessionProvider>
  );
}

function Gate() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;

  return (
    <Switch>
      <Route path="/login">
        {session ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route>
        {session ? <AuthenticatedApp /> : <Redirect to="/login" />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="shelfmind-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Gate />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
