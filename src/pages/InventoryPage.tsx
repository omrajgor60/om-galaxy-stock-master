import { useState, useEffect } from "react";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ComboboxWithAdd } from "@/components/ui/combobox-with-add";
import { toast } from "sonner";
import { 
  Package, Plus, Search, Box, Layers, AlertTriangle,
  IndianRupee, Tag, Palette
} from "lucide-react";

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
  const { isAdmin } = useMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [specs, setSpecs] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [specsList, setSpecsList] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) {
      const withStock = await Promise.all(data.map(async (p) => {
        const { count } = await supabase.from("stock_logs").select("*", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "in_stock");
        return { ...p, stock_count: count || 0 };
      }));
      setProducts(withStock);

      const uniqueCategories = [...new Set(data.map(p => p.category).filter(Boolean))] as string[];
      const uniqueSpecs = [...new Set(data.map(p => p.specs).filter(Boolean))] as string[];
      const uniqueColors = [...new Set(data.map(p => p.color).filter(Boolean))] as string[];
      
      setCategories(uniqueCategories);
      setSpecsList(uniqueSpecs);
      setColors(uniqueColors);
    }
    setIsLoading(false);
  };

  const addProduct = async () => {
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

  const getStockStatus = (count: number, threshold: number) => {
    if (count === 0) return { label: "Out of Stock", variant: "destructive" as const, color: "bg-destructive/20 text-destructive" };
    if (count <= 2) return { label: `Critical (${count})`, variant: "destructive" as const, color: "bg-destructive/20 text-destructive" };
    if (count <= threshold) return { label: `Low (${count})`, variant: "outline" as const, color: "bg-warning/20 text-warning" };
    return { label: `In Stock (${count})`, variant: "outline" as const, color: "bg-success/20 text-success" };
  };

  const filtered = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.model?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const isFormValid = category && model && price;

  // Stats
  const totalProducts = products.length;
  const inStock = products.filter(p => (p.stock_count || 0) > 0).length;
  const lowStock = products.filter(p => (p.stock_count || 0) <= p.low_stock_threshold && (p.stock_count || 0) > 0).length;
  const outOfStock = products.filter(p => (p.stock_count || 0) === 0).length;

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">Manage your products catalog</p>
          </div>
        </div>
        
        {isAdmin && (
          <Button 
            onClick={() => setShowAddDialog(true)} 
            size="lg"
            className="gradient-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all h-12 px-6"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProducts}</p>
              <p className="text-sm text-muted-foreground">Total Products</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <Box className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inStock}</p>
              <p className="text-sm text-muted-foreground">In Stock</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lowStock}</p>
              <p className="text-sm text-muted-foreground">Low Stock</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{outOfStock}</p>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
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
          placeholder="Search products by name, model, or category..." 
          className="pl-12 h-12 bg-card/80 border-border/50 text-base"
        />
      </div>

      {/* Products Grid */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4 animate-pulse" />
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No products found</p>
              {isAdmin && (
                <Button onClick={() => setShowAddDialog(true)} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first product
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {filtered.map((product) => {
              const status = getStockStatus(product.stock_count || 0, product.low_stock_threshold);
              return (
                <Card 
                  key={product.id} 
                  className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-all group overflow-hidden"
                >
                  <CardContent className="p-0">
                    {/* Color Banner */}
                    <div className="h-2 gradient-primary" />
                    
                    <div className="p-4 space-y-3">
                      {/* Product Name */}
                      <div>
                        <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {product.category}
                        </p>
                      </div>

                      {/* Specs Row */}
                      <div className="flex flex-wrap gap-1.5">
                        {product.specs && (
                          <Badge variant="outline" className="text-xs bg-muted/50">
                            {product.specs}
                          </Badge>
                        )}
                        {product.color && (
                          <Badge variant="outline" className="text-xs bg-muted/50">
                            <Palette className="h-3 w-3 mr-1" />
                            {product.color}
                          </Badge>
                        )}
                      </div>

                      {/* Price & Stock */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <p className="text-lg font-bold text-primary flex items-center">
                          <IndianRupee className="h-4 w-4" />
                          {product.price.toLocaleString()}
                        </p>
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader className="text-center pb-4">
            <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
              <Package className="h-8 w-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-2xl">Add New Product</DialogTitle>
            <p className="text-muted-foreground">Enter product details below</p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Category *
              </Label>
              <ComboboxWithAdd
                value={category}
                onChange={setCategory}
                options={categories}
                placeholder="Select or add category"
                emptyText="No categories yet"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Model *
              </Label>
              <Input 
                value={model} 
                onChange={(e) => setModel(e.target.value)} 
                placeholder="e.g. Galaxy S24 Ultra"
                className="h-12 bg-muted/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Specs</Label>
                <ComboboxWithAdd
                  value={specs}
                  onChange={setSpecs}
                  options={specsList}
                  placeholder="e.g. 8/128"
                  emptyText="No specs yet"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Colour</Label>
                <ComboboxWithAdd
                  value={color}
                  onChange={setColor}
                  options={colors}
                  placeholder="Select colour"
                  emptyText="No colours yet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                Price (₹) *
              </Label>
              <Input 
                type="number" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                placeholder="Enter price"
                className="h-12 bg-muted/50"
              />
            </div>

            {(category || model) && (
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Product name preview:</p>
                <p className="font-medium text-lg">
                  {[category, model, specs, color].filter(Boolean).join(" ") || "..."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1 h-12">
              Cancel
            </Button>
            <Button 
              onClick={addProduct} 
              disabled={!isFormValid}
              className="flex-1 h-12 gradient-primary text-primary-foreground"
            >
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}