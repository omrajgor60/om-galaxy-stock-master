import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { cn } from "@/lib/utils";
import {
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Loader2,
  BarChart3,
} from "lucide-react";

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

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    if (outlets.length >= 0) {
      fetchReportData();
    }
  }, [selectedOutletId, outlets]);

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

    // Fetch stock summary
    let stockQuery = supabase
      .from("stock_logs")
      .select(`
        product_id,
        status,
        products!product_id(name, color)
      `);

    if (selectedOutletId !== "all") {
      stockQuery = stockQuery.eq("outlet_id", selectedOutletId);
    }

    const { data: stockData } = await stockQuery;

    if (stockData) {
      // Group by product
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
        totalRevenue: 0, // Will be calculated from sales
      });
    }

    // Fetch recent sales with outlet filter
    let salesQuery = supabase
      .from("sales")
      .select(`
        id,
        created_at,
        sale_price,
        discount,
        product:products!product_id(name, color),
        customer:customers!customer_id(name),
        stock_log:stock_logs!stock_log_id(outlet_id)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outlet Reports</h1>
          <p className="text-muted-foreground">View inventory and sales by outlet</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
            <SelectTrigger className="w-[200px]">
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Current Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totals.totalStock}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items in inventory</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Items Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totals.totalSold}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total units sold</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `₹${totals.totalRevenue.toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">After discounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
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
                            {item.product_color && (
                              <p className="text-xs text-muted-foreground">{item.product_color}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={item.in_stock === 0 ? "destructive" : "outline"}
                            className={cn(
                              item.in_stock > 5 && "border-success text-success"
                            )}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
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
                            {sale.product.color && (
                              <p className="text-xs text-muted-foreground">{sale.product.color}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{sale.customer.name}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-medium">
                              ₹{(sale.sale_price - sale.discount).toLocaleString()}
                            </p>
                            {sale.discount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                -₹{sale.discount} discount
                              </p>
                            )}
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
    </div>
  );
}
