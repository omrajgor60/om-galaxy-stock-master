import { useEffect, useState } from "react";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Package,
  ScanBarcode,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Trophy,
  Users,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  totalProducts: number;
  scansToday: number;
  salesToday: number;
  totalCustomers: number;
  totalStockValue: number;
  lowStockCount: number;
  criticalStockCount: number;
}

interface SalesData {
  date: string;
  sales: number;
  revenue: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  color: string | null;
  stock_count: number;
  threshold: number;
  level: "low" | "critical" | "out_of_stock";
}

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  total_sales: number;
  total_revenue: number;
}

export default function DashboardPage() {
  const { isAdmin } = useMode();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    scansToday: 0,
    salesToday: 0,
    totalCustomers: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    criticalStockCount: 0,
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month">("week");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [isAdmin, timeFilter]);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    const today = new Date().toISOString().split("T")[0];
    const { count: scansCount } = await supabase
      .from("stock_logs")
      .select("*", { count: "exact", head: true })
      .gte("scanned_at", today);

    const { count: salesCount } = await supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today);

    const { count: customersCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });

    const { data: products } = await supabase.from("products").select("*");
    
    let totalValue = 0;
    const lowStock: LowStockProduct[] = [];
    
    if (products) {
      for (const product of products) {
        const { count } = await supabase
          .from("stock_logs")
          .select("*", { count: "exact", head: true })
          .eq("product_id", product.id)
          .eq("status", "in_stock");
        
        const stockCount = count || 0;
        totalValue += stockCount * Number(product.price);
        
        if (stockCount <= product.low_stock_threshold) {
          let level: "low" | "critical" | "out_of_stock" = "low";
          if (stockCount === 0) level = "out_of_stock";
          else if (stockCount <= 2) level = "critical";
          
          lowStock.push({
            id: product.id,
            name: product.name,
            color: product.color,
            stock_count: stockCount,
            threshold: product.low_stock_threshold,
            level,
          });
        }
      }
    }

    lowStock.sort((a, b) => {
      const order = { out_of_stock: 0, critical: 1, low: 2 };
      return order[a.level] - order[b.level];
    });

    setLowStockProducts(lowStock);

    const startDate = new Date();
    if (timeFilter === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (timeFilter === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const { data: salesDataRaw } = await supabase
      .from("sales")
      .select("sale_price, created_at")
      .gte("created_at", startDate.toISOString());

    const salesByDate: Record<string, { sales: number; revenue: number }> = {};
    if (salesDataRaw) {
      salesDataRaw.forEach((sale) => {
        const date = new Date(sale.created_at).toLocaleDateString("en-US", { 
          month: "short", 
          day: "numeric" 
        });
        if (!salesByDate[date]) {
          salesByDate[date] = { sales: 0, revenue: 0 };
        }
        salesByDate[date].sales++;
        salesByDate[date].revenue += Number(sale.sale_price);
      });
    }

    setSalesData(
      Object.entries(salesByDate).map(([date, data]) => ({
        date,
        ...data,
      }))
    );

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: leaderboardData } = await supabase
      .from("sales")
      .select(`
        sold_by,
        sale_price,
        profiles!sales_sold_by_fkey(full_name)
      `)
      .gte("created_at", weekAgo.toISOString());

    const leaderboardMap: Record<string, LeaderboardEntry> = {};
    if (leaderboardData) {
      leaderboardData.forEach((sale: any) => {
        if (!leaderboardMap[sale.sold_by]) {
          leaderboardMap[sale.sold_by] = {
            user_id: sale.sold_by,
            full_name: sale.profiles?.full_name || "Unknown",
            total_sales: 0,
            total_revenue: 0,
          };
        }
        leaderboardMap[sale.sold_by].total_sales++;
        leaderboardMap[sale.sold_by].total_revenue += Number(sale.sale_price);
      });
    }

    setLeaderboard(
      Object.values(leaderboardMap).sort((a, b) => b.total_revenue - a.total_revenue)
    );

    setStats({
      totalProducts: productsCount || 0,
      scansToday: scansCount || 0,
      salesToday: salesCount || 0,
      totalCustomers: customersCount || 0,
      totalStockValue: totalValue,
      lowStockCount: lowStock.filter((p) => p.level === "low").length,
      criticalStockCount: lowStock.filter((p) => p.level === "critical" || p.level === "out_of_stock").length,
    });

    setIsLoading(false);
  };

  const getLevelBadge = (level: LowStockProduct["level"]) => {
    switch (level) {
      case "out_of_stock":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Out of Stock</Badge>;
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "low":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Low</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            {isAdmin ? "Dashboard" : "My Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your overview.
          </p>
        </div>
        <div className="flex items-center bg-muted/30 rounded-xl p-1 border border-border/50">
          {(["today", "week", "month"] as const).map((filter) => (
            <Button
              key={filter}
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter(filter)}
              className={`h-9 px-4 rounded-lg capitalize transition-all ${
                timeFilter === filter
                  ? "gradient-primary text-primary-foreground shadow-lg"
                  : "hover:bg-muted/50"
              }`}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden group hover:border-primary/30 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Products</p>
                <p className="text-3xl font-bold mt-2">{stats.totalProducts}</p>
                <div className="flex items-center gap-1 mt-2 text-success text-sm">
                  <ArrowUp className="h-3 w-3" />
                  <span>Active</span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="h-7 w-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden group hover:border-primary/30 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Scans Today</p>
                <p className="text-3xl font-bold mt-2">{stats.scansToday}</p>
                <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
                  <ScanBarcode className="h-3 w-3" />
                  <span>Items logged</span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ScanBarcode className="h-7 w-7 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden group hover:border-primary/30 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Sales Today</p>
                <p className="text-3xl font-bold mt-2">{stats.salesToday}</p>
                <div className="flex items-center gap-1 mt-2 text-success text-sm">
                  <TrendingUp className="h-3 w-3" />
                  <span>Revenue</span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingCart className="h-7 w-7 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Stock Value</p>
                  <p className="text-3xl font-bold mt-2">₹{(stats.totalStockValue / 1000).toFixed(0)}K</p>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
                    <DollarSign className="h-3 w-3" />
                    <span>Total worth</span>
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <DollarSign className="h-7 w-7 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Customers</p>
                  <p className="text-3xl font-bold mt-2">{stats.totalCustomers}</p>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
                    <Users className="h-3 w-3" />
                    <span>Registered</span>
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-info/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="h-7 w-7 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Low Stock Alert */}
      {isAdmin && lowStockProducts.length > 0 && (
        <Card className="bg-card/80 backdrop-blur border-warning/30 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle>Stock Alerts</CardTitle>
                  <CardDescription>Products needing attention</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="destructive" className="h-7">
                  {stats.criticalStockCount} Critical
                </Badge>
                <Badge className="bg-warning/20 text-warning border-warning/30 h-7">
                  {stats.lowStockCount} Low
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        product.level === "out_of_stock" 
                          ? "bg-destructive" 
                          : product.level === "critical" 
                            ? "bg-destructive animate-pulse" 
                            : "bg-warning"
                      }`} />
                      <div>
                        <p className="font-medium text-sm">
                          {product.name} {product.color && `(${product.color})`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.stock_count} left / {product.threshold} threshold
                        </p>
                      </div>
                    </div>
                    {getLevelBadge(product.level)}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Sales Chart */}
        <Card className="bg-card/80 backdrop-blur border-border/50 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle>Sales Overview</CardTitle>
                <CardDescription>Revenue over time</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pb-4">
            {salesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>No sales data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value / 1000}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)",
                    }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--primary))" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="bg-card/80 backdrop-blur border-border/50 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle>Weekly Rankings</CardTitle>
                <CardDescription>Top performers this week</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              {leaderboard.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>No sales this week</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, index) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          index === 0
                            ? "gradient-primary text-primary-foreground shadow-lg"
                            : index === 1
                              ? "bg-muted-foreground/20 text-foreground"
                              : index === 2
                                ? "bg-orange-600/20 text-orange-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.full_name}</p>
                        <p className="text-sm text-muted-foreground">{entry.total_sales} sales</p>
                      </div>
                      <p className="font-bold text-primary">₹{entry.total_revenue.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}