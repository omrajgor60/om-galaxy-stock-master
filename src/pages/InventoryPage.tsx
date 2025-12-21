import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, Plus, Search, Edit } from "lucide-react";

interface Product {
  id: string;
  name: string;
  model: string;
  brand: string | null;
  color: string | null;
  ram: string | null;
  storage: string | null;
  price: number;
  low_stock_threshold: number;
  stock_count?: number;
}

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", model: "", brand: "", color: "", ram: "", storage: "", price: "", low_stock_threshold: "5" });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) {
      const withStock = await Promise.all(data.map(async (p) => {
        const { count } = await supabase.from("stock_logs").select("*", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "in_stock");
        return { ...p, stock_count: count || 0 };
      }));
      setProducts(withStock);
    }
  };

  const addProduct = async () => {
    const { error } = await supabase.from("products").insert({
      name: newProduct.name, model: newProduct.model, brand: newProduct.brand || null,
      color: newProduct.color || null, ram: newProduct.ram || null, storage: newProduct.storage || null,
      price: parseFloat(newProduct.price) || 0, low_stock_threshold: parseInt(newProduct.low_stock_threshold) || 5
    });
    if (error) toast.error(error.message);
    else { toast.success("Product added!"); setShowAddDialog(false); fetchProducts(); setNewProduct({ name: "", model: "", brand: "", color: "", ram: "", storage: "", price: "", low_stock_threshold: "5" }); }
  };

  const getStockBadge = (count: number, threshold: number) => {
    if (count === 0) return <Badge className="bg-stock-out">Out of Stock</Badge>;
    if (count <= 2) return <Badge variant="destructive">Critical ({count})</Badge>;
    if (count <= threshold) return <Badge className="bg-warning text-warning-foreground">Low ({count})</Badge>;
    return <Badge className="bg-stock-ok text-success-foreground">In Stock ({count})</Badge>;
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.model.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        {isAdmin && <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Product</Button>}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <Card key={product.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{product.name}</CardTitle>
                {getStockBadge(product.stock_count || 0, product.low_stock_threshold)}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{product.brand} • {product.color} • {product.ram}</p>
              <p className="text-lg font-bold text-primary mt-2">₹{product.price.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} /></div>
              <div><Label>Model *</Label><Input value={newProduct.model} onChange={(e) => setNewProduct({...newProduct, model: e.target.value})} /></div>
              <div><Label>Brand</Label><Input value={newProduct.brand} onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} /></div>
              <div><Label>Color</Label><Input value={newProduct.color} onChange={(e) => setNewProduct({...newProduct, color: e.target.value})} /></div>
              <div><Label>RAM</Label><Input value={newProduct.ram} onChange={(e) => setNewProduct({...newProduct, ram: e.target.value})} /></div>
              <div><Label>Storage</Label><Input value={newProduct.storage} onChange={(e) => setNewProduct({...newProduct, storage: e.target.value})} /></div>
              <div><Label>Price (₹) *</Label><Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} /></div>
              <div><Label>Low Stock Threshold</Label><Input type="number" value={newProduct.low_stock_threshold} onChange={(e) => setNewProduct({...newProduct, low_stock_threshold: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={addProduct} disabled={!newProduct.name || !newProduct.model}>Add Product</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
