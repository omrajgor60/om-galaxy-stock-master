import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
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
  Camera,
  X,
  Store,
  IndianRupee,
  CreditCard,
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
  outlet_id: string | null;
}

interface Outlet {
  id: string;
  name: string;
  code: string;
}

export default function SalesPage() {
  const { isAdmin } = useMode();
  const { playSound } = useSoundEffects();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  const [stockOutlet, setStockOutlet] = useState<Outlet | null>(null);
  const [isValidatingImei, setIsValidatingImei] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Sale state
  const [salePrice, setSalePrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [commission, setCommission] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchProducts();
    initBarcodeDetector();
    return () => stopCamera();
  }, []);

  const initBarcodeDetector = async () => {
    if (!("BarcodeDetector" in window)) return;
    try {
      const supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
      if (supportedFormats && supportedFormats.length > 0) {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: supportedFormats,
        });
      }
    } catch {
      barcodeDetectorRef.current = new (window as any).BarcodeDetector({
        formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"],
      });
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data);
  };

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

  const createCustomer = async () => {
    if (!newCustomerName.trim()) return;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: newCustomerName.trim(),
        phone: phoneSearch.trim(),
        email: newCustomerEmail.trim() || null,
        created_by: null,
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

  const validateImei = async () => {
    if (!imeiInput.trim() || !selectedProduct) return;

    setIsValidatingImei(true);
    const { data, error } = await supabase
      .from("stock_logs")
      .select("*, outlets(id, name, code)")
      .eq("imei", imeiInput.trim())
      .eq("product_id", selectedProduct.id)
      .eq("status", "in_stock")
      .single();

    if (error || !data) {
      playSound("error");
      toast.error("IMEI not found or not available for this product");
      setStockItem(null);
      setStockOutlet(null);
    } else {
      playSound("beep");
      setStockItem(data);
      setStockOutlet(data.outlets || null);
      toast.success("IMEI verified!");
      stopCamera();
    }
    setIsValidatingImei(false);
  };

  const startCamera = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
    } catch {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        toast.error("Could not access camera");
        return;
      }
    }

    setShowCamera(true);
    setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
        startDetecting();
      }
    }, 100);
  };

  const startDetecting = () => {
    if (!barcodeDetectorRef.current || !videoRef.current) return;

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          setImeiInput(barcodes[0].rawValue);
          stopCamera();
        }
      } catch {}
    }, 500);
  };

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const processSale = async () => {
    if (!customer || !selectedProduct || !stockItem) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsProcessing(true);

    try {
      const { error: saleError } = await supabase.from("sales").insert({
        stock_log_id: stockItem.id,
        customer_id: customer.id,
        product_id: selectedProduct.id,
        sold_by: null,
        sale_price: parseFloat(salePrice) || selectedProduct.price,
        discount: parseFloat(discount) || 0,
        commission: parseFloat(commission) || 0,
        payment_method: paymentMethod,
      });

      if (saleError) throw saleError;

      const { error: stockError } = await supabase
        .from("stock_logs")
        .update({ status: "sold", sold_at: new Date().toISOString() })
        .eq("id", stockItem.id);

      if (stockError) throw stockError;

      playSound("success");
      toast.success("Sale completed successfully!");

      setCustomer(null);
      setPhoneSearch("");
      setSelectedProduct(null);
      setImeiInput("");
      setStockItem(null);
      setStockOutlet(null);
      setSalePrice("");
      setDiscount("");
      setCommission("");
      setPaymentMethod("cash");
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to process sale: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcessSale = customer && selectedProduct && stockItem;
  const finalAmount = (parseFloat(salePrice) || 0) - (parseFloat(discount) || 0);

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
              <ShoppingCart className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Record Sale</h1>
              <p className="text-muted-foreground">Process a new sale with customer details</p>
            </div>
          </div>
        </motion.div>

        {/* Progress Indicator */}
        <motion.div variants={staggerItem} className="grid grid-cols-4 gap-2">
          {[
            { label: "Customer", done: !!customer, icon: User },
            { label: "Product", done: !!selectedProduct, icon: Package },
            { label: "IMEI", done: !!stockItem, icon: ScanBarcode },
            { label: "Payment", done: false, icon: CreditCard },
          ].map((step, index) => (
            <div
              key={step.label}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg transition-all",
                step.done ? "bg-success/10 border border-success/30" : "bg-muted/50 border border-border/50"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                step.done ? "bg-success text-success-foreground" : "bg-muted"
              )}>
                {step.done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </div>
              <span className={cn("text-sm font-medium", step.done && "text-success")}>
                {step.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto">
          {/* Left Column */}
          <motion.div variants={staggerItem} className="space-y-4">
            {/* Step 1: Customer */}
            <Card className={cn("bg-card/80 backdrop-blur border-border/50", customer && "border-success/30")}>
              <CardHeader className="pb-3">
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
                        className="pl-10 h-12 bg-muted/50 border-border/50"
                        onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
                      />
                    </div>
                    <Button onClick={searchCustomer} disabled={isSearching || phoneSearch.length < 10} className="h-12">
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
            <Card className={cn("bg-card/80 backdrop-blur border-border/50", selectedProduct && "border-success/30", !customer && "opacity-50")}>
              <CardHeader className="pb-3">
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
                      className="w-full justify-between h-12 border-border/50"
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
          </motion.div>

          {/* Right Column */}
          <motion.div variants={staggerItem} className="space-y-4">
            {/* Step 3: IMEI */}
            <Card className={cn("bg-card/80 backdrop-blur border-border/50", stockItem && "border-success/30", !selectedProduct && "opacity-50")}>
              <CardHeader className="pb-3">
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
              <CardContent className="space-y-4">
                {showCamera && (
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4/5 h-0.5 bg-destructive shadow-[0_0_10px_hsl(var(--destructive))] animate-pulse" />
                    </div>
                    <div className="absolute inset-8 border-2 border-primary/50 rounded-lg pointer-events-none" />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-4 right-4"
                      onClick={stopCamera}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    value={imeiInput}
                    onChange={(e) => setImeiInput(e.target.value)}
                    placeholder="Scan or enter IMEI..."
                    className="font-mono h-12 bg-muted/50 border-border/50"
                    disabled={!selectedProduct}
                    onKeyDown={(e) => e.key === "Enter" && validateImei()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    onClick={showCamera ? stopCamera : startCamera}
                    disabled={!selectedProduct}
                  >
                    {showCamera ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                  <Button onClick={validateImei} disabled={!selectedProduct || isValidatingImei} className="h-12">
                    {isValidatingImei ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                {stockItem && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/30 space-y-2">
                    <p className="text-sm text-success font-medium">
                      ✓ IMEI {stockItem.imei} verified
                    </p>
                    {stockOutlet && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Store className="h-4 w-4" />
                        <span>From: <span className="font-medium text-foreground">{stockOutlet.name}</span></span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 4: Payment */}
            <Card className={cn("bg-card/80 backdrop-blur border-border/50", !stockItem && "opacity-50")}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <CreditCard className="h-4 w-4" />
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
                      className="h-12 bg-muted/50 border-border/50"
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
                      className="h-12 bg-muted/50 border-border/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Commission (₹)</Label>
                    <Input
                      type="number"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      placeholder="0"
                      disabled={!stockItem}
                      className="h-12 bg-muted/50 border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">Finance company earnings</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={!stockItem}>
                      <SelectTrigger className="h-12 bg-muted/50 border-border/50">
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
                </div>

                {canProcessSale && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Final Amount</span>
                      <span className="text-2xl font-bold text-primary">
                        ₹{finalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={processSale}
                  disabled={!canProcessSale || isProcessing}
                  className="w-full h-12 gradient-primary text-primary-foreground"
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
          </motion.div>
        </div>

        {/* New Customer Dialog */}
        <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
          <DialogContent className="bg-card border-border">
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
                  className="h-12 bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="h-12 bg-muted/50 border-border/50"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCustomerDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createCustomer} disabled={!newCustomerName.trim()} className="gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Create Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
