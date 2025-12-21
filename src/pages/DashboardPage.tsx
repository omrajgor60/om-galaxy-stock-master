import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  ScanBarcode,
  ShoppingCart,
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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

const CHART_COLORS = ["hsl(24, 95%, 53%)", "hsl(0, 72%, 51%)", "hsl(142, 76%, 36%)", "hsl(48, 96%, 53%)"];

export default function DashboardPage() {
  const { isAdmin, user } = useAuth();
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
  }, [isAdmin, user, timeFilter]);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    // Fetch products count
    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    // Fetch today's scans
    const today = new Date().toISOString().split("T")[0];
    const { count: scansCount } = await supabase
      .from("stock_logs")
      .select("*", { count: "exact", head: true })
      .gte("scanned_at", today);

    // Fetch today's sales
    const { count: salesCount } = await supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today);

    // Fetch customers count
    const { count: customersCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });

    // Fetch stock value and low stock products
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

    // Sort low stock by severity
    lowStock.sort((a, b) => {
      const order = { out_of_stock: 0, critical: 1, low: 2 };
      return order[a.level] - order[b.level];
    });

    setLowStockProducts(lowStock);

    // Fetch sales data for chart
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

    // Group sales by date
    const salesByDate: Record<string, { sales: number; revenue: number }> = {};
    if (salesDataRaw) {
      salesDataRaw.forEach((sale) => {
        const date = new Date(sale.created_at).toLocaleDateString();
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

    // Fetch leaderboard (weekly sales)
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

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    color = "primary",
  }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: string;
    color?: string;
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend && (
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${color === "primary" ? "gradient-primary" : `bg-${color}`}`}>
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getLevelBadge = (level: LowStockProduct["level"]) => {
    switch (level) {
      case "out_of_stock":
        return <Badge className="bg-stock-out">Out of Stock</Badge>;
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "low":
        return <Badge className="bg-warning text-warning-foreground">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "Dashboard" : "My Dashboard"}</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeFilter === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("today")}
          >
            Today
          </Button>
          <Button
            variant={timeFilter === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("week")}
          >
            Week
          </Button>
          <Button
            variant={timeFilter === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("month")}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Products" value={stats.totalProducts} icon={Package} />
        <StatCard title="Scans Today" value={stats.scansToday} icon={ScanBarcode} />
        <StatCard title="Sales Today" value={stats.salesToday} icon={ShoppingCart} />
        {isAdmin && (
          <StatCard
            title="Stock Value"
            value={`₹${stats.totalStockValue.toLocaleString()}`}
            icon={DollarSign}
          />
        )}
        {!isAdmin && <StatCard title="Customers" value={stats.totalCustomers} icon={Users} />}
      </div>

      {/* Low Stock Alert Widget (Admin Only) */}
      {isAdmin && lowStockProducts.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg">Stock Alerts</CardTitle>
              </div>
              <div className="flex gap-2">
                <Badge variant="destructive">{stats.criticalStockCount} Critical</Badge>
                <Badge className="bg-warning text-warning-foreground">{stats.lowStockCount} Low</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">
                      {product.name} {product.color && `(${product.color})`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {product.stock_count} remaining (threshold: {product.threshold})
                    </p>
                  </div>
                  {getLevelBadge(product.level)}
                </div>
              ))}
              {lowStockProducts.length > 5 && (
                <Button variant="ghost" className="w-full text-muted-foreground">
                  View all ({lowStockProducts.length} items)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Revenue and sales count over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Sales Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Sales Rankings</CardTitle>
            <CardDescription>Top performers this week</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No sales this week</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? "gradient-primary text-primary-foreground"
                            : "bg-muted-foreground/20"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{entry.full_name}</p>
                        <p className="text-sm text-muted-foreground">{entry.total_sales} sales</p>
                      </div>
                    </div>
                    <p className="font-bold text-primary">₹{entry.total_revenue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
