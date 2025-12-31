import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  model: string;
  category: string | null;
  color: string | null;
  specs: string | null;
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
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [sessionScans, setSessionScans] = useState<ScannedItem[]>([]);
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const [isPendingDuplicate, setIsPendingDuplicate] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
    initBarcodeDetector();
    return () => stopCamera();
  }, []);

  // Auto-focus input when not in verification mode and camera is off
  useEffect(() => {
    if (inputRef.current && !showCamera && !pendingScan) {
      inputRef.current.focus();
    }
  }, [selectedProduct, showCamera, pendingScan]);

  // Blur input when camera is active to prevent keyboard popup
  useEffect(() => {
    if (showCamera) {
      inputRef.current?.blur();
    }
  }, [showCamera, pendingScan]);

  // Auto-focus confirm button when verification appears
  useEffect(() => {
    if (pendingScan && !isPendingDuplicate && confirmBtnRef.current) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [pendingScan, isPendingDuplicate]);

  // Helper to reattach stream to video element
  const attachStreamToVideo = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  // Resume camera detection when pendingScan clears and camera is active
  useEffect(() => {
    if (!pendingScan && showCamera && streamRef.current) {
      // Small delay to ensure DOM is ready
      const timeout = setTimeout(() => {
        attachStreamToVideo();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [pendingScan, showCamera, attachStreamToVideo]);

  const initBarcodeDetector = async () => {
    if (!("BarcodeDetector" in window)) return;

    try {
      // Dynamically get all supported formats
      const supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
      if (supportedFormats && supportedFormats.length > 0) {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: supportedFormats,
        });
      }
    } catch {
      // Fallback to common formats
      barcodeDetectorRef.current = new (window as any).BarcodeDetector({
        formats: [
          "qr_code", "aztec", "code_128", "code_39", "code_93",
          "codabar", "data_matrix", "ean_13", "ean_8", "itf",
          "pdf417", "upc_a", "upc_e"
        ],
      });
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data);
  };

  const checkDuplicate = async (imei: string): Promise<boolean> => {
    // Check session scans first
    if (sessionScans.some(s => s.imei === imei)) return true;
    
    // Check database
    const { data } = await supabase
      .from("stock_logs")
      .select("id")
      .eq("imei", imei)
      .single();
    return !!data;
  };

  const handleScan = useCallback(async () => {
    if (!scanInput.trim()) return;
    if (!selectedProduct) {
      playSound("warning");
      toast.error("Please select a product first");
      return;
    }

    const imei = scanInput.trim();
    setIsScanning(true);
    setScanInput("");

    // Check for duplicate
    const isDuplicate = await checkDuplicate(imei);
    
    // Show inline verification panel
    setPendingScan(imei);
    setIsPendingDuplicate(isDuplicate);
    
    if (isDuplicate) {
      playSound("error");
    } else {
      playSound("beep");
    }
    
    setIsScanning(false);
  }, [scanInput, selectedProduct, playSound, sessionScans]);

  const confirmScan = async () => {
    if (!pendingScan || !selectedProduct || !user || isPendingDuplicate) return;

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
      toast.success("Scan saved!");

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
    setIsPendingDuplicate(false);
    inputRef.current?.focus();
  };

  const rescan = () => {
    // Blur input immediately to prevent keyboard
    if (showCamera) {
      inputRef.current?.blur();
    }
    
    setPendingScan(null);
    setIsPendingDuplicate(false);
    setScanInput(""); // Clear any leftover input
    
    // If camera is NOT active, focus input for manual scanning
    if (!showCamera) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    // Camera resume is handled by useEffect watching pendingScan
  };

  // Handle Enter key for scan or confirm
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  // Handle Enter/Escape key on verification panel
  const handleVerificationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isPendingDuplicate) {
      e.preventDefault();
      confirmScan();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      rescan();
    }
  };

  // Camera scanning with enhanced BarcodeDetector
  const startCamera = async () => {
    const getStream = async (constraints: MediaStreamConstraints) => {
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      // Attempt 1: HD with environment camera (best for scanning)
      streamRef.current = await getStream({
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
    } catch {
      try {
        // Attempt 2: Standard environment camera
        streamRef.current = await getStream({
          video: { facingMode: "environment" }
        });
      } catch {
        try {
          // Attempt 3: Any camera (fallback for desktop)
          streamRef.current = await getStream({ video: true });
        } catch {
          toast.error("Could not access camera. Check permissions.");
          return;
        }
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
    if (!barcodeDetectorRef.current || !videoRef.current) {
      toast.error("Camera scanning not supported on this device");
      return;
    }

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || pendingScan) return;
      
      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            setScanInput(rawValue);
            // Auto-trigger scan
            handleScanFromCamera(rawValue);
          }
        }
      } catch {
        // Detection failed, continue
      }
    }, 500);
  };

  const handleScanFromCamera = async (code: string) => {
    if (!selectedProduct) {
      playSound("warning");
      toast.error("Please select a product first");
      return;
    }

    const isDuplicate = await checkDuplicate(code);
    setPendingScan(code);
    setIsPendingDuplicate(isDuplicate);
    
    if (isDuplicate) {
      playSound("error");
    } else {
      playSound("beep");
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const getProductDisplayName = (product: Product | null) => {
    if (!product) return "";
    return `${product.name} ${product.color || ""} ${product.specs || ""}`.trim();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with Session Counter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Scanner</h1>
          <p className="text-muted-foreground">Scan products to add to inventory</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSessionList(true)}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            Session: {sessionScans.length} Pcs
          </Button>
        </div>
      </div>

      {/* Product Selection with Click to View Scans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Product
          </CardTitle>
          <CardDescription>Choose the product you're scanning</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                    {selectedProduct.specs && `(${selectedProduct.specs})`}
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
                          setSessionScans([]); // Reset session when product changes
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
                            {product.category} {product.color && `• ${product.color}`}{" "}
                            {product.specs && `• ${product.specs}`}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* View scanned items link */}
          {selectedProduct && sessionScans.length > 0 && (
            <button
              onClick={() => setShowSessionList(true)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Eye className="h-3 w-3" />
              View {sessionScans.length} scanned items
            </button>
          )}
        </CardContent>
      </Card>

      {/* Camera View - Always mounted when showCamera is true to prevent ref loss */}
      {showCamera && (
        <Card className={cn(pendingScan && "opacity-50")}>
          <CardContent className="p-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Scan line animation */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4/5 h-0.5 bg-destructive shadow-[0_0_10px_hsl(var(--destructive))] animate-pulse" />
              </div>
              {/* Corner guides */}
              <div className="absolute inset-8 border-2 border-primary/50 rounded-lg pointer-events-none" />
              {!pendingScan && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-4 right-4"
                  onClick={stopCamera}
                >
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
              )}
              {pendingScan && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <p className="text-sm font-medium">Verification in progress...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inline Verification Panel */}
      {pendingScan && (
        <Card 
          className={cn(
            "border-2 animate-in zoom-in-95 duration-200",
            isPendingDuplicate ? "border-destructive bg-destructive/5" : "border-primary"
          )}
          onKeyDown={handleVerificationKeyDown}
          tabIndex={0}
        >
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className={cn(
                "text-sm font-bold uppercase tracking-widest",
                isPendingDuplicate ? "text-destructive" : "text-muted-foreground"
              )}>
                {isPendingDuplicate ? (
                  <span className="flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Duplicate Detected
                  </span>
                ) : (
                  "Verify Scan"
                )}
              </h3>

              <div className={cn(
                "p-4 rounded-lg border",
                isPendingDuplicate 
                  ? "bg-destructive/10 border-destructive/30" 
                  : "bg-muted border-border"
              )}>
                <p className="font-mono text-2xl md:text-3xl font-bold break-all">
                  {pendingScan}
                </p>
                {isPendingDuplicate && (
                  <p className="text-destructive text-xs font-bold uppercase mt-2 animate-pulse">
                    This barcode has already been scanned!
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Product</p>
                <p className="font-medium">{getProductDisplayName(selectedProduct)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={rescan}
                  className="h-14 flex flex-col gap-1"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span>Re-Scan</span>
                </Button>
                <Button
                  ref={confirmBtnRef}
                  size="lg"
                  onClick={confirmScan}
                  disabled={isPendingDuplicate}
                  className={cn(
                    "h-14 flex flex-col gap-1",
                    isPendingDuplicate 
                      ? "bg-destructive/20 text-destructive cursor-not-allowed" 
                      : "gradient-primary"
                  )}
                >
                  {isPendingDuplicate ? (
                    <>
                      <X className="h-5 w-5" />
                      <span>Blocked</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-5 w-5" />
                      <span>Scan Next</span>
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {isPendingDuplicate 
                  ? "Please Re-Scan a different item" 
                  : "Press Enter to confirm"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Input (hidden when verification is shown) */}
      {!pendingScan && (
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
                className="h-16 text-xl font-mono scanner-input pr-12"
                disabled={!selectedProduct}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={showCamera ? stopCamera : startCamera}
                disabled={!selectedProduct}
              >
                {showCamera ? (
                  <X className="h-5 w-5 text-destructive" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </Button>
            </div>

            <Button
              onClick={handleScan}
              disabled={!selectedProduct || !scanInput.trim() || isScanning}
              className="w-full gradient-primary"
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Submit Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans - Enhanced Display */}
      {sessionScans.length > 0 && !pendingScan && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Scans</CardTitle>
              <span className="text-xs text-muted-foreground">Last 5 items</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionScans.slice(0, 5).map((scan, index) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm md:text-base font-medium truncate text-primary">
                      {scan.imei}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {scan.product_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(scan.scanned_at).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className="text-success border-success shrink-0">
                      <Check className="h-3 w-3" />
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session List Dialog */}
      <Dialog open={showSessionList} onOpenChange={setShowSessionList}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Session Scans
              <Badge variant="secondary">{sessionScans.length} Pcs</Badge>
            </DialogTitle>
            <DialogDescription>
              {selectedProduct 
                ? `All items scanned for ${selectedProduct.name}`
                : "All items scanned in this session"
              }
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-80">
            {sessionScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Package className="h-12 w-12 mb-2 opacity-50" />
                <p>No items scanned yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 text-xs text-muted-foreground uppercase tracking-wider p-2 bg-muted/50 rounded sticky top-0">
                  <span>#</span>
                  <span>Barcode/IMEI</span>
                  <span>Product</span>
                  <span>Time</span>
                </div>
                {sessionScans.map((scan, index) => (
                  <div
                    key={scan.id}
                    className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 items-center p-2 rounded hover:bg-muted/50 text-sm"
                  >
                    <span className="text-muted-foreground">{sessionScans.length - index}</span>
                    <span className="font-mono text-primary truncate">{scan.imei}</span>
                    <span className="truncate">{scan.product_name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(scan.scanned_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              Total: {sessionScans.length} items
            </span>
            <Button onClick={() => setShowSessionList(false)}>
              Close & Resume
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
