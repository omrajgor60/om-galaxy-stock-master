import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ComboboxWithAdd } from "@/components/ui/combobox-with-add";
import { toast } from "sonner";
import { Package, Plus, Search } from "lucide-react";

interface Product {
  id: string;
  name: string;
  model: string;
  category: string | null;
  color: string | null;
  specs: string | null;
  price: number;
  low_stock_threshold: number;
  stock_count?: number;
}

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Form state
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [specs, setSpecs] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");

  // Unique values for dropdowns
  const [categories, setCategories] = useState<string[]>([]);
  const [specsList, setSpecsList] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) {
      const withStock = await Promise.all(data.map(async (p) => {
        const { count } = await supabase.from("stock_logs").select("*", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "in_stock");
        return { ...p, stock_count: count || 0 };
      }));
      setProducts(withStock);

      // Extract unique values for dropdowns
      const uniqueCategories = [...new Set(data.map(p => p.category).filter(Boolean))] as string[];
      const uniqueSpecs = [...new Set(data.map(p => p.specs).filter(Boolean))] as string[];
      const uniqueColors = [...new Set(data.map(p => p.color).filter(Boolean))] as string[];
      
      setCategories(uniqueCategories);
      setSpecsList(uniqueSpecs);
      setColors(uniqueColors);
    }
  };

  const addProduct = async () => {
    // Auto-generate name from fields
    const generatedName = [category, model, specs, color].filter(Boolean).join(" ");

    const { error } = await supabase.from("products").insert({
      name: generatedName,
      model: model,
      category: category || null,
      color: color || null,
      specs: specs || null,
      price: parseFloat(price) || 0,
      low_stock_threshold: 5
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Product added!");
      setShowAddDialog(false);
      fetchProducts();
      resetForm();
    }
  };

  const resetForm = () => {
    setCategory("");
    setModel("");
    setSpecs("");
    setColor("");
    setPrice("");
  };

  const getStockBadge = (count: number, threshold: number) => {
    if (count === 0) return <Badge className="bg-stock-out">Out of Stock</Badge>;
    if (count <= 2) return <Badge variant="destructive">Critical ({count})</Badge>;
    if (count <= threshold) return <Badge className="bg-warning text-warning-foreground">Low ({count})</Badge>;
    return <Badge className="bg-stock-ok text-success-foreground">In Stock ({count})</Badge>;
  };

  const filtered = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.model?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const isFormValid = category && model && price;

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
              <p className="text-sm text-muted-foreground">
                {product.category} • {product.specs} • {product.color}
              </p>
              <p className="text-lg font-bold text-primary mt-2">₹{product.price.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* 1. Category */}
            <div className="space-y-2">
              <Label>1. Category *</Label>
              <ComboboxWithAdd
                value={category}
                onChange={setCategory}
                options={categories}
                placeholder="Select category"
                emptyText="No categories yet"
              />
            </div>

            {/* 2. Model */}
            <div className="space-y-2">
              <Label>2. Model *</Label>
              <Input 
                value={model} 
                onChange={(e) => setModel(e.target.value)} 
                placeholder="e.g. Galaxy S24 Ultra"
              />
            </div>

            {/* 3. Specs */}
            <div className="space-y-2">
              <Label>3. Specs</Label>
              <ComboboxWithAdd
                value={specs}
                onChange={setSpecs}
                options={specsList}
                placeholder="Select specs (e.g. 8/128)"
                emptyText="No specs yet"
              />
            </div>

            {/* 4. Colour */}
            <div className="space-y-2">
              <Label>4. Colour</Label>
              <ComboboxWithAdd
                value={color}
                onChange={setColor}
                options={colors}
                placeholder="Select colour"
                emptyText="No colours yet"
              />
            </div>

            {/* 5. Price */}
            <div className="space-y-2">
              <Label>5. Price (₹) *</Label>
              <Input 
                type="number" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                placeholder="Enter price"
              />
            </div>

            {/* Preview */}
            {(category || model) && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-1">Product name preview:</p>
                <p className="font-medium">{[category, model, specs, color].filter(Boolean).join(" ") || "..."}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={addProduct} disabled={!isFormValid}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
