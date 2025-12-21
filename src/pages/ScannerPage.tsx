import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { toast } from "sonner";
import {
  ScanBarcode,
  Camera,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  Package,
  List,
  AlertTriangle,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  model: string;
  brand: string | null;
  color: string | null;
  ram: string | null;
  storage: string | null;
}

interface ScannedItem {
  id: string;
  imei: string;
  product_name: string;
  scanned_at: string;
  is_duplicate?: boolean;
}

export default function ScannerPage() {
  const { user } = useAuth();
  const { playSound } = useSoundEffects();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [sessionScans, setSessionScans] = useState<ScannedItem[]>([]);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current && !showCamera) {
      inputRef.current.focus();
    }
  }, [selectedProduct, showCamera, showVerifyDialog]);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data);
  };

  const checkDuplicate = async (imei: string): Promise<boolean> => {
    const { data } = await supabase
      .from("stock_logs")
      .select("id")
      .eq("imei", imei)
      .single();
    return !!data;
  };

  const handleScan = useCallback(async () => {
    if (!scanInput.trim()) return;
    if (!selectedProduct && !isBatchMode) {
      playSound("warning");
      toast.error("Please select a product first");
      return;
    }

    const imei = scanInput.trim();
    setIsScanning(true);

    // Check for duplicate
    const isDuplicate = await checkDuplicate(imei);
    if (isDuplicate) {
      playSound("error");
      toast.error("Duplicate IMEI! This item has already been scanned.");
      setScanInput("");
      setIsScanning(false);
      return;
    }

    // Show verification dialog
    setPendingScan(imei);
    setShowVerifyDialog(true);
    playSound("beep");
    setIsScanning(false);
  }, [scanInput, selectedProduct, isBatchMode, playSound]);

  const confirmScan = async () => {
    if (!pendingScan || !selectedProduct || !user) return;

    const { data, error } = await supabase
      .from("stock_logs")
      .insert({
        product_id: selectedProduct.id,
        imei: pendingScan,
        scanned_by: user.id,
        status: "in_stock",
      })
      .select()
      .single();

    if (error) {
      playSound("error");
      toast.error("Failed to save scan: " + error.message);
    } else {
      playSound("success");
      toast.success("Scan saved successfully!");

      // Add to session list
      setSessionScans((prev) => [
        {
          id: data.id,
          imei: pendingScan,
          product_name: `${selectedProduct.name} ${selectedProduct.color || ""}`,
          scanned_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    setPendingScan(null);
    setScanInput("");
    setShowVerifyDialog(false);
    inputRef.current?.focus();
  };

  const rescan = () => {
    setPendingScan(null);
    setScanInput("");
    setShowVerifyDialog(false);
    inputRef.current?.focus();
  };

  // Handle Enter key for scan
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  // Camera scanning with BarcodeDetector
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);

        // Check for BarcodeDetector support
        if ("BarcodeDetector" in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
          });

          const detectBarcode = async () => {
            if (!videoRef.current || !showCamera) return;

            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                setScanInput(code);
                stopCamera();
                handleScan();
              }
            } catch (err) {
              // Detection failed, continue scanning
            }

            if (showCamera) {
              requestAnimationFrame(detectBarcode);
            }
          };

          requestAnimationFrame(detectBarcode);
        } else {
          toast.error("Camera scanning not supported on this device");
        }
      }
    } catch (err) {
      toast.error("Failed to access camera");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    setShowCamera(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Scanner</h1>
          <p className="text-muted-foreground">Scan products to add to inventory</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSessionList(true)}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            Session ({sessionScans.length})
          </Button>
        </div>
      </div>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Product
          </CardTitle>
          <CardDescription>Choose the product you're scanning</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={productOpen}
                className="w-full justify-between h-12 text-left"
              >
                {selectedProduct ? (
                  <span>
                    {selectedProduct.name} {selectedProduct.color && `- ${selectedProduct.color}`}{" "}
                    {selectedProduct.ram && `(${selectedProduct.ram})`}
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
                          setProductOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.brand} {product.color && `• ${product.color}`}{" "}
                            {product.ram && `• ${product.ram}`}
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

      {/* Scanner Input */}
      <Card className={cn(selectedProduct ? "border-primary/50" : "opacity-75")}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Scan IMEI / Barcode
          </CardTitle>
          <CardDescription>
            {selectedProduct
              ? `Scanning for: ${selectedProduct.name}`
              : "Select a product above first"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan or enter IMEI/barcode..."
              className="h-16 text-xl font-mono scanner-input"
              disabled={!selectedProduct}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={startCamera}
              disabled={!selectedProduct}
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleScan}
              disabled={!selectedProduct || !scanInput.trim() || isScanning}
              className="flex-1 gradient-primary"
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Camera View */}
      {showCamera && (
        <Card>
          <CardContent className="p-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-primary/50 m-8 rounded-lg" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-4 right-4"
                onClick={stopCamera}
              >
                <X className="h-4 w-4 mr-2" />
                Close Camera
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {sessionScans.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionScans.slice(0, 5).map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-mono text-sm">{scan.imei}</p>
                    <p className="text-xs text-muted-foreground">{scan.product_name}</p>
                  </div>
                  <Badge variant="outline" className="text-success border-success">
                    <Check className="h-3 w-3 mr-1" />
                    Saved
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Verify Scan
            </DialogTitle>
            <DialogDescription>Please confirm this scan is correct</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground mb-1">Scanned Code</p>
              <p className="text-2xl font-mono font-bold">{pendingScan}</p>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Product</p>
              <p className="font-medium">
                {selectedProduct?.name} {selectedProduct?.color && `(${selectedProduct.color})`}
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={rescan} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-Scan
            </Button>
            <Button onClick={confirmScan} className="flex-1 gradient-primary">
              <ChevronRight className="h-4 w-4 mr-2" />
              Confirm & Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session List Dialog */}
      <Dialog open={showSessionList} onOpenChange={setShowSessionList}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Scans ({sessionScans.length})</DialogTitle>
            <DialogDescription>All items scanned in this session</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-80">
            {sessionScans.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No scans yet</p>
            ) : (
              <div className="space-y-2">
                {sessionScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-mono text-sm">{scan.imei}</p>
                      <p className="text-xs text-muted-foreground">{scan.product_name}</p>
                    </div>
                    <Badge variant="outline" className="text-success border-success">
                      <Check className="h-3 w-3 mr-1" />
                      Saved
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
