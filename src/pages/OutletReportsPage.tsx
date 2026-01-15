import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Loader2,
  BarChart3,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

interface Outlet {
  id: string;
  name: string;
  code: string;
}

interface StockSummary {
  product_id: string;
  product_name: string;
  product_color: string | null;
  in_stock: number;
  sold: number;
}

interface SaleRecord {
  id: string;
  created_at: string;
  sale_price: number;
  discount: number;
  product: {
    name: string;
    color: string | null;
  };
  customer: {
    name: string;
  };
}

export default function OutletReportsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [totals, setTotals] = useState({
    totalStock: 0,
    totalSold: 0,
    totalRevenue: 0,
  });

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    if (outlets.length >= 0) {
      fetchReportData();
    }
  }, [selectedOutletId, outlets, dateRange]);

  const fetchOutlets = async () => {
    const { data } = await supabase
      .from("outlets")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name");
    if (data) setOutlets(data);
  };

  const fetchReportData = async () => {
    setIsLoading(true);

    let stockQuery = supabase
      .from("stock_logs")
      .select(`product_id, status, products!product_id(name, color)`);

    if (selectedOutletId !== "all") {
      stockQuery = stockQuery.eq("outlet_id", selectedOutletId);
    }

    const { data: stockData } = await stockQuery;

    if (stockData) {
      const productMap = new Map<string, StockSummary>();
      
      stockData.forEach((item: any) => {
        const key = item.product_id;
        if (!productMap.has(key)) {
          productMap.set(key, {
            product_id: item.product_id,
            product_name: item.products?.name || "Unknown",
            product_color: item.products?.color,
            in_stock: 0,
            sold: 0,
          });
        }
        
        const entry = productMap.get(key)!;
        if (item.status === "in_stock") {
          entry.in_stock++;
        } else if (item.status === "sold") {
          entry.sold++;
        }
      });

      const summaryArray = Array.from(productMap.values());
      setStockSummary(summaryArray);
      
      setTotals({
        totalStock: summaryArray.reduce((acc, item) => acc + item.in_stock, 0),
        totalSold: summaryArray.reduce((acc, item) => acc + item.sold, 0),
        totalRevenue: 0,
      });
    }

    let salesQuery = supabase
      .from("sales")
      .select(`
        id, created_at, sale_price, discount,
        product:products!product_id(name, color),
        customer:customers!customer_id(name),
        stock_log:stock_logs!stock_log_id(outlet_id)
      `)
      .order("created_at", { ascending: false });

    if (dateRange?.from) {
      salesQuery = salesQuery.gte("created_at", startOfDay(dateRange.from).toISOString());
    }
    if (dateRange?.to) {
      salesQuery = salesQuery.lte("created_at", endOfDay(dateRange.to).toISOString());
    }

    const { data: salesData } = await salesQuery;

    if (salesData) {
      let filteredSales = salesData;
      
      if (selectedOutletId !== "all") {
        filteredSales = salesData.filter(
          (sale: any) => sale.stock_log?.outlet_id === selectedOutletId
        );
      }

      setRecentSales(filteredSales as unknown as SaleRecord[]);
      
      const totalRevenue = filteredSales.reduce(
        (acc: number, sale: any) => acc + (sale.sale_price - (sale.discount || 0)),
        0
      );
      
      setTotals((prev) => ({ ...prev, totalRevenue }));
    }

    setIsLoading(false);
  };

  return (
    <PageTransition>
      <div className="h-full flex flex-col gap-6">
        {/* Header */}
        <motion.div 
          variants={staggerItem}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow-primary">
              <BarChart3 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Outlet Reports</h1>
              <p className="text-muted-foreground">View inventory and sales by outlet</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal h-12 border-border/50", !dateRange && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}</>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Pick date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>7D</Button>
              <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>30D</Button>
              <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}>90D</Button>
            </div>

            <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
              <SelectTrigger className="w-[180px] h-12 border-border/50">
                <Store className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-3 gap-4"
        >
          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Current Stock</p>
                    <p className="text-4xl font-bold text-primary mt-1">
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totals.totalStock}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Items in inventory</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Items Sold</p>
                    <p className="text-4xl font-bold text-success mt-1">
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totals.totalSold}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Total units sold</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Total Revenue</p>
                    <p className="text-4xl font-bold text-foreground mt-1">
                      {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        `₹${totals.totalRevenue.toLocaleString()}`
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">After discounts</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <IndianRupee className="h-6 w-6 text-secondary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={staggerItem} className="flex-1 overflow-auto">
          <Tabs defaultValue="inventory" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="inventory" className="gap-2">
                <Package className="h-4 w-4" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Sales
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inventory">
              <Card className="bg-card/80 backdrop-blur border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Stock by Product
                  </CardTitle>
                  <CardDescription>
                    {selectedOutletId === "all"
                      ? "Inventory levels across all outlets"
                      : `Inventory at ${outlets.find((o) => o.id === selectedOutletId)?.name}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : stockSummary.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No stock data available</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">In Stock</TableHead>
                          <TableHead className="text-center">Sold</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockSummary.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.product_color && <p className="text-xs text-muted-foreground">{item.product_color}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={item.in_stock === 0 ? "destructive" : "outline"}
                                className={cn(item.in_stock > 5 && "border-success text-success")}
                              >
                                {item.in_stock}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-muted-foreground">{item.sold}</span>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.in_stock + item.sold}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales">
              <Card className="bg-card/80 backdrop-blur border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Recent Sales
                  </CardTitle>
                  <CardDescription>
                    {selectedOutletId === "all"
                      ? "Sales across all outlets"
                      : `Sales at ${outlets.find((o) => o.id === selectedOutletId)?.name}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentSales.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No sales data available</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentSales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="text-muted-foreground">
                              {new Date(sale.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{sale.product.name}</p>
                                {sale.product.color && <p className="text-xs text-muted-foreground">{sale.product.color}</p>}
                              </div>
                            </TableCell>
                            <TableCell>{sale.customer.name}</TableCell>
                            <TableCell className="text-right">
                              <div>
                                <p className="font-medium">₹{(sale.sale_price - sale.discount).toLocaleString()}</p>
                                {sale.discount > 0 && <p className="text-xs text-muted-foreground">-₹{sale.discount} discount</p>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </PageTransition>
  );
}
