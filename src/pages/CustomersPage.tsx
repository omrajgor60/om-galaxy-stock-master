import { useState, useEffect } from "react";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Users, Phone, Download, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  total_spent: number;
  purchase_count: number;
  created_at: string;
}

export default function CustomersPage() {
  const { isAdmin } = useMode();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (data) setCustomers(data);
    setIsLoading(false);
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast.error("No customers to export");
      return;
    }

    setIsExporting(true);
    
    try {
      const headers = ["Name", "Phone", "Email", "Total Spent", "Purchase Count", "Created At"];
      const csvData = filtered.map(c => [
        c.name,
        c.phone,
        c.email || "",
        c.total_spent.toString(),
        c.purchase_count.toString(),
        new Date(c.created_at).toLocaleDateString(),
      ]);
      
      const csvContent = [
        headers.join(","),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `customers_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${filtered.length} customers`);
    } catch {
      toast.error("Failed to export");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          )}
          <Badge variant="outline">{customers.length} total</Badge>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="pl-10" />
      </div>

      <ScrollArea className="h-[calc(100vh-250px)]">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((customer) => (
            <Card key={customer.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {customer.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </p>
                <div className="flex gap-4 mt-3 text-sm">
                  <Badge variant="secondary">₹{customer.total_spent.toLocaleString()}</Badge>
                  <Badge variant="outline">{customer.purchase_count} purchases</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
