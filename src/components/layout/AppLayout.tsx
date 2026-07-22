import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useMode } from "@/contexts/ModeContext";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ArrowRightLeft,
  BarChart3,
  ArrowDown,
  Shield,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const adminLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: ScanBarcode },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/master-inventory", label: "Master Items", icon: ScanBarcode },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { to: "/incoming-stock", label: "Incoming", icon: ArrowDown },
  { to: "/outlet-reports", label: "Reports", icon: BarChart3 },
  { to: "/outlets", label: "Outlets", icon: Store },
  { to: "/staff", label: "Staff", icon: UserCog },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/export", label: "Export", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings },
];

const staffLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: ScanBarcode },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { to: "/incoming-stock", label: "Incoming", icon: ArrowDown },
  { to: "/outlet-reports", label: "Reports", icon: BarChart3 },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/report-issue", label: "Report", icon: MessageSquare },
];

function SyncIndicator() {
  const { isOnline, lastSyncTime, pendingChanges } = useOnlineStatus();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "h-10 px-3 gap-2 rounded-xl transition-all",
            isOnline 
              ? "bg-success/10 hover:bg-success/20 text-success" 
              : "bg-destructive/10 hover:bg-destructive/20 text-destructive"
          )}
        >
          {isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4 animate-pulse" />
          )}
          <span className="hidden md:inline text-sm font-medium">
            {isOnline ? "Online" : `Offline`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-card/95 backdrop-blur-xl border-border/50" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            ) : (
              <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            )}
            <span className="font-semibold">{isOnline ? "Connected" : "Offline Mode"}</span>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Last sync: {lastSyncTime ? formatDistanceToNow(lastSyncTime, { addSuffix: true }) : "Never"}
            </p>
            {pendingChanges > 0 && (
              <p className="text-warning font-medium">
                {pendingChanges} change{pendingChanges > 1 ? "s" : ""} pending
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const label = profile?.full_name || user?.email || "Account";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 gap-2 px-3 rounded-xl hover:bg-muted/50">
          {isAdmin ? <Shield className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
          <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-card/95 backdrop-blur-xl border-border/50" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold truncate">{label}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <Badge variant="outline" className="text-xs mt-2">
              {isAdmin ? "Administrator" : "Staff"}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="w-full gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "stock_alert":
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Sparkles className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-xl hover:bg-muted/50"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-primary-foreground shadow-lg">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-card/95 backdrop-blur-xl border-border/50 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 rounded-xl cursor-pointer transition-all hover:bg-muted/50",
                    notification.is_read ? "opacity-60" : "bg-muted/30"
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
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

function NavLinks({ 
  links, 
  collapsed = false,
  isMobile = false 
}: { 
  links: typeof adminLinks; 
  collapsed?: boolean;
  isMobile?: boolean;
}) {
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <nav className={cn("space-y-1", isMobile && "px-2")}>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;

          const linkContent = (
            <NavLink
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                collapsed ? "justify-center p-3" : "px-4 py-3",
                isActive
                  ? "gradient-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-5 w-5")} />
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
          );

          if (collapsed && !isMobile) {
            return (
              <Tooltip key={link.to}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {link.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>
    </TooltipProvider>
  );
}

export default function AppLayout() {
  const { mode, isAdmin } = useMode();
  const [collapsed, setCollapsed] = useState(false);
  const links = isAdmin ? adminLinks : staffLinks;

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "border-b border-border/50 transition-all",
          collapsed ? "p-3" : "p-4"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary shadow-lg shrink-0">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-lg text-gradient truncate">Om Galaxy</h1>
                <p className="text-xs text-muted-foreground">Stock Taker</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4 px-2">
          <NavLinks links={links} collapsed={collapsed} />
        </ScrollArea>

        {/* Collapse Button & Mode Info */}
        <div className="border-t border-border/50 p-3">
          {!collapsed && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {isAdmin ? (
                  <Shield className="h-5 w-5 text-primary" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {isAdmin ? "Administrator" : "Staff Member"}
                </p>
                <Badge variant="outline" className="text-xs mt-0.5">
                  {mode === "admin" ? "Full Access" : "Limited"}
                </Badge>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full justify-center h-9 rounded-xl hover:bg-muted/50",
              collapsed && "px-0"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-card/95 backdrop-blur-xl border-r border-border/50">
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl gradient-primary">
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
                <div className="p-4 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      {isAdmin ? (
                        <Shield className="h-5 w-5 text-primary" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isAdmin ? "Administrator" : "Staff Member"}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {mode === "admin" ? "Full Access" : "Limited"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Logo (when sidebar collapsed) */}
            <div className="hidden lg:block" />

            {/* Right side actions */}
            <div className="flex items-center gap-2 ml-auto">
              <SyncIndicator />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}