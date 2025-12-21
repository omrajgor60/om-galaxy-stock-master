import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Package, ShoppingCart, Users, ScanBarcode, AlertTriangle, Loader2 } from "lucide-react";

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
    { id: "products", title: "Products", desc: "All products with details", icon: Package, fn: async () => { const { data } = await supabase.from("products").select("*"); if (data) exportToCSV(data, "products"); } },
    { id: "stock", title: "Stock Logs", desc: "All scanned items", icon: ScanBarcode, fn: async () => { const { data } = await supabase.from("stock_logs").select("*"); if (data) exportToCSV(data, "stock_logs"); } },
    { id: "sales", title: "Sales", desc: "All sales records", icon: ShoppingCart, fn: async () => { const { data } = await supabase.from("sales").select("*"); if (data) exportToCSV(data, "sales"); } },
    { id: "customers", title: "Customers", desc: "Customer database", icon: Users, fn: async () => { const { data } = await supabase.from("customers").select("*"); if (data) exportToCSV(data, "customers"); } },
    { id: "lowstock", title: "Low Stock", desc: "Products below threshold", icon: AlertTriangle, fn: async () => {
      const { data: products } = await supabase.from("products").select("*");
      if (products) {
        const lowStock = await Promise.all(products.map(async (p) => {
          const { count } = await supabase.from("stock_logs").select("*", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "in_stock");
          return { ...p, stock_count: count || 0 };
        }));
        exportToCSV(lowStock.filter(p => p.stock_count <= p.low_stock_threshold), "low_stock_report");
      }
    }}
  ];

  const handleExport = async (id: string, fn: () => Promise<void>) => {
    setIsExporting(id);
    await fn();
    setIsExporting(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Export Data</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exports.map(({ id, title, desc, icon: Icon, fn }) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" />{title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleExport(id, fn)} disabled={isExporting === id} className="w-full">
                {isExporting === id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
