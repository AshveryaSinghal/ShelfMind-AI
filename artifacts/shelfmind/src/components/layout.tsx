import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { BarChart2, LayoutDashboard, List, Camera, Bell, FileText, MessageSquare, Menu, LogOut, Store, UserCog, LineChart } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shelves", label: "Shelves", icon: List },
  { href: "/scan", label: "New Scan", icon: Camera },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/report", label: "Store Report", icon: FileText },
  { href: "/stores", label: "My Stores", icon: Store },
  { href: "/assistant", label: "AI Assistant", icon: MessageSquare },
];

function BrandMark() {
  return (
    <div className="h-14 flex items-center px-4 border-b border-sidebar-border font-semibold text-lg gap-2 text-sidebar-primary-foreground shrink-0">
      <BarChart2 className="w-5 h-5 text-sidebar-primary" />
      ShelfMind AI
    </div>
  );
}

function NavLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { session, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const activeLabel = NAV_ITEMS.find(
    (item) => location === item.href || (item.href !== "/" && location.startsWith(item.href)),
  )?.label ?? "ShelfMind AI";

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      {/* Sidebar — permanent on desktop, hidden on mobile/tablet in favor of the drawer below */}
      <aside className="hidden md:flex w-56 lg:w-64 border-r bg-sidebar text-sidebar-foreground shrink-0 flex-col">
        <BrandMark />
        <NavLinks location={location} />
        {session && (
          <div className="p-3 border-t border-sidebar-border">
            <Link href="/stores">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-sidebar-foreground/70 rounded-md hover:bg-sidebar-accent/50 hover:text-sidebar-foreground cursor-pointer">
                <Store className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate" title={session.storeName}>{session.storeName}</span>
              </div>
            </Link>
          </div>
        )}
      </aside>

      {/* Mobile / tablet nav drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandMark />
          <NavLinks location={location} onNavigate={() => setMobileNavOpen(false)} />
          {session && (
            <div className="p-3 border-t border-sidebar-border">
              <Link href="/stores" onClick={() => setMobileNavOpen(false)}>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-sidebar-foreground/70 rounded-md hover:bg-sidebar-accent/50 hover:text-sidebar-foreground cursor-pointer">
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" title={session.storeName}>{session.storeName}</span>
                </div>
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between gap-2 px-3 sm:px-6 border-b bg-card shrink-0">
          <div className="flex items-center gap-2 min-w-0 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-medium truncate">{activeLabel}</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="hidden sm:inline max-w-[10rem] truncate">{session.username}</span>
                    <LogOut className="w-4 h-4 sm:hidden" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{session.username}</span>
                      <span className="text-xs font-normal text-muted-foreground truncate">{session.storeName}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserCog className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/stores")}>
                    <Store className="w-4 h-4 mr-2" />
                    My Stores
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-background">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
