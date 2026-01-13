import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Download, Package, ShoppingCart, Users, ScanBarcode, 
  AlertTriangle, Loader2, FileSpreadsheet, Database 
} from "lucide-react";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) { toast.error("No data to export"); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filename}`);
  };

  const exports = [
    { 
      id: "products", 
      title: "Products", 
      desc: "All products with complete details including price and threshold", 
      icon: Package,
      color: "bg-primary/10 text-primary",
      fn: async () => { 
        const { data } = await supabase.from("products").select("*"); 
        if (data) exportToCSV(data, "products"); 
      } 
    },
    { 
      id: "stock", 
      title: "Stock Logs", 
      desc: "Complete history of all scanned items with IMEI and status", 
      icon: ScanBarcode,
      color: "bg-secondary/10 text-secondary",
      fn: async () => { 
        const { data } = await supabase.from("stock_logs").select("*"); 
        if (data) exportToCSV(data, "stock_logs"); 
      } 
    },
    { 
      id: "sales", 
      title: "Sales Records", 
      desc: "All sales transactions with pricing and payment details", 
      icon: ShoppingCart,
      color: "bg-success/10 text-success",
      fn: async () => { 
        const { data } = await supabase.from("sales").select("*"); 
        if (data) exportToCSV(data, "sales"); 
      } 
    },
    { 
      id: "customers", 
      title: "Customers", 
      desc: "Complete customer database with contact information", 
      icon: Users,
      color: "bg-info/10 text-info",
      fn: async () => { 
        const { data } = await supabase.from("customers").select("*"); 
        if (data) exportToCSV(data, "customers"); 
      } 
    },
    { 
      id: "lowstock", 
      title: "Low Stock Report", 
      desc: "Products currently below threshold needing restock", 
      icon: AlertTriangle,
      color: "bg-warning/10 text-warning",
      fn: async () => {
        const { data: products } = await supabase.from("products").select("*");
        if (products) {
          const lowStock = await Promise.all(products.map(async (p) => {
            const { count } = await supabase.from("stock_logs").select("*", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "in_stock");
            return { ...p, stock_count: count || 0 };
          }));
          exportToCSV(lowStock.filter(p => p.stock_count <= p.low_stock_threshold), "low_stock_report");
        }
      }
    }
  ];

  const handleExport = async (id: string, fn: () => Promise<void>) => {
    setIsExporting(id);
    await fn();
    setIsExporting(null);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <Database className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Export Data</h1>
          <p className="text-muted-foreground">Download your data as CSV files</p>
        </div>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map(({ id, title, desc, icon: Icon, color, fn }) => (
          <Card 
            key={id} 
            className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-all group"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl ${color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="text-sm mt-1">{desc}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleExport(id, fn)} 
                disabled={isExporting === id} 
                className="w-full h-11 gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {isExporting === id ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Download className="h-5 w-5 mr-2" />
                )}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30 border-border/50 mt-auto">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-info" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">About Exports</h3>
            <p className="text-sm text-muted-foreground">
              All exports are downloaded as CSV files which can be opened in Microsoft Excel, 
              Google Sheets, or any spreadsheet application. Files are named with the current date 
              for easy organization.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}