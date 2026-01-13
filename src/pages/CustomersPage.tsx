import { useState, useEffect } from "react";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Search, Users, Phone, Download, Loader2, Mail,
  ShoppingBag, IndianRupee, UserCircle, Crown
} from "lucide-react";

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

  // Stats
  const totalSpent = customers.reduce((acc, c) => acc + c.total_spent, 0);
  const avgSpent = customers.length > 0 ? totalSpent / customers.length : 0;
  const topCustomer = [...customers].sort((a, b) => b.total_spent - a.total_spent)[0];

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">Manage your customer database</p>
          </div>
        </div>
        
        {isAdmin && (
          <Button 
            variant="outline" 
            onClick={exportToCSV} 
            disabled={isExporting}
            className="h-12 px-6 border-border/50"
          >
            {isExporting ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Download className="h-5 w-5 mr-2" />
            )}
            Export CSV
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customers.length}</p>
              <p className="text-sm text-muted-foreground">Total Customers</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <IndianRupee className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{(totalSpent / 1000).toFixed(0)}K</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{avgSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-sm text-muted-foreground">Avg. Spend</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold truncate">{topCustomer?.name || "-"}</p>
              <p className="text-sm text-muted-foreground">Top Customer</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Search by name or phone..." 
          className="pl-12 h-12 bg-card/80 border-border/50 text-base" 
        />
      </div>

      {/* Customers Grid */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4 animate-pulse" />
              <p className="text-muted-foreground">Loading customers...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No customers found</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {filtered.map((customer) => (
              <Card 
                key={customer.id} 
                className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-all group overflow-hidden"
              >
                <CardContent className="p-0">
                  {/* Avatar Header */}
                  <div className="p-4 flex items-center gap-3 border-b border-border/50">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {customer.name}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-3">
                    {customer.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2 truncate">
                        <Mail className="h-4 w-4 shrink-0" />
                        {customer.email}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <Badge className="bg-primary/10 text-primary border-0">
                        <IndianRupee className="h-3 w-3 mr-1" />
                        {customer.total_spent.toLocaleString()}
                      </Badge>
                      <Badge variant="outline" className="bg-muted/30">
                        {customer.purchase_count} orders
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}