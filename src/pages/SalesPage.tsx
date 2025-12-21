import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  User,
  Phone,
  Package,
  ScanBarcode,
  Check,
  Plus,
  ChevronsUpDown,
  Search,
  Loader2,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  total_spent: number;
  purchase_count: number;
}

interface Product {
  id: string;
  name: string;
  model: string;
  color: string | null;
  price: number;
}

interface StockItem {
  id: string;
  imei: string;
  product_id: string;
  status: string;
}

export default function SalesPage() {
  const { user } = useAuth();
  const { playSound } = useSoundEffects();

  // Customer state
  const [phoneSearch, setPhoneSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productOpen, setProductOpen] = useState(false);

  // IMEI state
  const [imeiInput, setImeiInput] = useState("");
  const [stockItem, setStockItem] = useState<StockItem | null>(null);
  const [isValidatingImei, setIsValidatingImei] = useState(false);

  // Sale state
  const [salePrice, setSalePrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data);
  };

  // Phone lookup
  const searchCustomer = async () => {
    if (!phoneSearch.trim() || phoneSearch.length < 10) return;

    setIsSearching(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phoneSearch.trim())
      .single();

    if (data) {
      setCustomer(data);
      playSound("success");
      toast.success(`Welcome back, ${data.name}!`);
    } else {
      setNewCustomerName("");
      setNewCustomerEmail("");
      setShowNewCustomerDialog(true);
    }
    setIsSearching(false);
  };

  // Create new customer
  const createCustomer = async () => {
    if (!newCustomerName.trim() || !user) return;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: newCustomerName.trim(),
        phone: phoneSearch.trim(),
        email: newCustomerEmail.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create customer: " + error.message);
    } else if (data) {
      setCustomer(data);
      playSound("success");
      toast.success("Customer created successfully!");
      setShowNewCustomerDialog(false);
    }
  };

  // Validate IMEI
  const validateImei = async () => {
    if (!imeiInput.trim() || !selectedProduct) return;

    setIsValidatingImei(true);
    const { data, error } = await supabase
      .from("stock_logs")
      .select("*")
      .eq("imei", imeiInput.trim())
      .eq("product_id", selectedProduct.id)
      .eq("status", "in_stock")
      .single();

    if (error || !data) {
      playSound("error");
      toast.error("IMEI not found or not available for this product");
      setStockItem(null);
    } else {
      playSound("beep");
      setStockItem(data);
      toast.success("IMEI verified!");
    }
    setIsValidatingImei(false);
  };

  // Process sale
  const processSale = async () => {
    if (!customer || !selectedProduct || !stockItem || !user) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsProcessing(true);

    try {
      // Create sale record
      const { error: saleError } = await supabase.from("sales").insert({
        stock_log_id: stockItem.id,
        customer_id: customer.id,
        product_id: selectedProduct.id,
        sold_by: user.id,
        sale_price: parseFloat(salePrice) || selectedProduct.price,
        discount: parseFloat(discount) || 0,
        payment_method: paymentMethod,
      });

      if (saleError) throw saleError;

      // Update stock status
      const { error: stockError } = await supabase
        .from("stock_logs")
        .update({ status: "sold", sold_at: new Date().toISOString() })
        .eq("id", stockItem.id);

      if (stockError) throw stockError;

      playSound("success");
      toast.success("Sale completed successfully!");

      // Reset form
      setCustomer(null);
      setPhoneSearch("");
      setSelectedProduct(null);
      setImeiInput("");
      setStockItem(null);
      setSalePrice("");
      setDiscount("");
      setPaymentMethod("cash");
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to process sale: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcessSale = customer && selectedProduct && stockItem;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Record Sale</h1>
        <p className="text-muted-foreground">Process a new sale with customer details</p>
      </div>

      {/* Step 1: Customer */}
      <Card className={cn(customer && "border-success/50")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg", customer ? "bg-success" : "bg-muted")}>
                <User className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 1: Customer</CardTitle>
                <CardDescription>Enter customer phone number</CardDescription>
              </div>
            </div>
            {customer && (
              <Badge variant="outline" className="border-success text-success">
                <Check className="h-3 w-3 mr-1" />
                {customer.name}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {customer ? (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCustomer(null)}>
                  Change
                </Button>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Total Spent: ₹{customer.total_spent.toLocaleString()}</span>
                <span>Purchases: {customer.purchase_count}</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  placeholder="Enter phone number..."
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
                />
              </div>
              <Button onClick={searchCustomer} disabled={isSearching || phoneSearch.length < 10}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Product */}
      <Card className={cn(selectedProduct && "border-success/50", !customer && "opacity-50")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg", selectedProduct ? "bg-success" : "bg-muted")}>
                <Package className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 2: Product</CardTitle>
                <CardDescription>Select the product being sold</CardDescription>
              </div>
            </div>
            {selectedProduct && (
              <Badge variant="outline" className="border-success text-success">
                <Check className="h-3 w-3 mr-1" />
                Selected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                disabled={!customer}
                className="w-full justify-between h-12"
              >
                {selectedProduct ? (
                  <span>
                    {selectedProduct.name}{" "}
                    {selectedProduct.color && `(${selectedProduct.color})`} - ₹
                    {selectedProduct.price.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select a product...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search products..." />
                <CommandList>
                  <CommandEmpty>No products found.</CommandEmpty>
                  <CommandGroup>
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={`${product.name} ${product.model} ${product.color || ""}`}
                        onSelect={() => {
                          setSelectedProduct(product);
                          setSalePrice(product.price.toString());
                          setProductOpen(false);
                          setImeiInput("");
                          setStockItem(null);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.color && `${product.color} • `}₹{product.price.toLocaleString()}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Step 3: IMEI */}
      <Card className={cn(stockItem && "border-success/50", !selectedProduct && "opacity-50")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg", stockItem ? "bg-success" : "bg-muted")}>
                <ScanBarcode className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 3: Scan IMEI</CardTitle>
                <CardDescription>Scan or enter the IMEI being sold</CardDescription>
              </div>
            </div>
            {stockItem && (
              <Badge variant="outline" className="border-success text-success">
                <Check className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={imeiInput}
              onChange={(e) => setImeiInput(e.target.value)}
              placeholder="Scan or enter IMEI..."
              className="font-mono"
              disabled={!selectedProduct}
              onKeyDown={(e) => e.key === "Enter" && validateImei()}
            />
            <Button onClick={validateImei} disabled={!selectedProduct || isValidatingImei}>
              {isValidatingImei ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          </div>
          {stockItem && (
            <p className="text-sm text-success mt-2">
              ✓ IMEI {stockItem.imei} is available and ready for sale
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Payment */}
      <Card className={cn(!stockItem && "opacity-50")}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Step 4: Payment</CardTitle>
              <CardDescription>Enter sale details and complete</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sale Price (₹)</Label>
              <Input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                disabled={!stockItem}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount (₹)</Label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                disabled={!stockItem}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={!stockItem}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canProcessSale && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Final Amount</span>
                <span className="text-2xl font-bold text-primary">
                  ₹{((parseFloat(salePrice) || 0) - (parseFloat(discount) || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={processSale}
            disabled={!canProcessSale || isProcessing}
            className="w-full h-12 gradient-primary"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Complete Sale
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
            <DialogDescription>
              No customer found with phone {phoneSearch}. Create a new customer?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="customer@email.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createCustomer} disabled={!newCustomerName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
