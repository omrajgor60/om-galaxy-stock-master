import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useMode } from "@/contexts/ModeContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Store,
  LayoutDashboard,
  ScanBarcode,
  ShoppingCart,
  Users,
  Package,
  UserCog,
  FileText,
  Download,
  Bell,
  Wifi,
  WifiOff,
  Menu,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  ArrowRightLeft,
  BarChart3,
  ArrowDown,
  Shield,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const adminLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: ScanBarcode },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { to: "/incoming-stock", label: "Incoming Stock", icon: ArrowDown },
  { to: "/outlet-reports", label: "Reports", icon: BarChart3 },
  { to: "/outlets", label: "Outlets", icon: Store },
  { to: "/staff", label: "Staff", icon: UserCog },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/export", label: "Export", icon: Download },
];

const staffLinks = [
  { to: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: ScanBarcode },
  { to: "/sales", label: "Record Sale", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { to: "/incoming-stock", label: "Incoming Stock", icon: ArrowDown },
  { to: "/outlet-reports", label: "Reports", icon: BarChart3 },
  { to: "/requests", label: "My Requests", icon: FileText },
  { to: "/report-issue", label: "Report Issue", icon: MessageSquare },
];

function SyncIndicator() {
  const { isOnline, lastSyncTime, pendingChanges } = useOnlineStatus();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-online" />
          ) : (
            <WifiOff className="h-4 w-4 text-offline animate-pulse" />
          )}
          <span className="hidden sm:inline text-xs">
            {isOnline ? "Connected" : `Offline (${pendingChanges} pending)`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="h-2 w-2 rounded-full bg-online glow-success" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-offline animate-pulse" />
            )}
            <span className="font-medium">{isOnline ? "Online" : "Offline"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>
              Last synced:{" "}
              {lastSyncTime ? formatDistanceToNow(lastSyncTime, { addSuffix: true }) : "Never"}
            </p>
            {pendingChanges > 0 && (
              <p className="text-warning mt-1">
                {pendingChanges} change{pendingChanges > 1 ? "s" : ""} pending sync
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      <Button
        variant={mode === "admin" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-3 gap-1.5"
        onClick={() => setMode("admin")}
      >
        <Shield className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Admin</span>
      </Button>
      <Button
        variant={mode === "staff" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-3 gap-1.5"
        onClick={() => setMode("staff")}
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Staff</span>
      </Button>
    </div>
  );
}

function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "stock_alert":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Bell className="h-4 w-4 text-info" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No notifications</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    notification.is_read ? "bg-muted/30" : "bg-muted"
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NavLinks({ links, isMobile = false }: { links: typeof adminLinks; isMobile?: boolean }) {
  const location = useLocation();

  return (
    <nav className={cn("space-y-1", isMobile && "px-2")}>
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = location.pathname === link.to;

        return (
          <NavLink
            key={link.to}
            to={link.to}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="h-5 w-5" />
            {link.label}
            {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function AppLayout() {
  const { mode, isAdmin } = useMode();
  const links = isAdmin ? adminLinks : staffLinks;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg gradient-primary">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gradient">Om Galaxy</h1>
              <p className="text-xs text-muted-foreground">Stock Taker</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4 px-3">
          <NavLinks links={links} />
        </ScrollArea>

        {/* Mode Info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              {isAdmin ? <Shield className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{isAdmin ? "Administrator" : "Staff Member"}</p>
              <Badge variant="outline" className="text-xs">
                {mode === "admin" ? "Admin" : "Staff"}
              </Badge>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center justify-between h-full px-4">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                <div className="p-4 border-b border-sidebar-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg gradient-primary">
                      <Store className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="font-bold text-lg text-gradient">Om Galaxy</h1>
                      <p className="text-xs text-muted-foreground">Stock Taker</p>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 py-4">
                  <NavLinks links={links} isMobile />
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="hidden lg:block" />

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <SyncIndicator />
              <ModeToggle />
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
