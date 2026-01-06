import { useState, useEffect, useCallback, useRef } from "react";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Loader2,
  Package,
  ScanBarcode,
  Store,
  ArrowRightLeft,
  Layers,
  X,
  Plus,
  Camera,
  XCircle,
  Ban,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Outlet {
  id: string;
  name: string;
  code: string;
}

interface StockItem {
  id: string;
  imei: string;
  product_id: string;
  outlet_id: string | null;
  product: {
    name: string;
    color: string | null;
  };
  outlet: {
    name: string;
    code: string;
  } | null;
}

interface BulkItem extends StockItem {
  validated: boolean;
}

interface Transfer {
  id: string;
  created_at: string;
  notes: string | null;
  status: string;
  stock_log: {
    imei: string;
    product: {
      name: string;
      color: string | null;
    };
  };
  from_outlet: {
    name: string;
    code: string;
  };
  to_outlet: {
    name: string;
    code: string;
  };
  transferred_by_profile: {
    full_name: string;
  } | null;
}

export default function TransfersPage() {
  const { isAdmin } = useMode();
  const { playSound } = useSoundEffects();

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [toOutlet, setToOutlet] = useState<Outlet | null>(null);
  const [toOutletOpen, setToOutletOpen] = useState(false);
  
  const [imeiInput, setImeiInput] = useState("");
  const [stockItem, setStockItem] = useState<StockItem | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [notes, setNotes] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Bulk transfer state
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOutlets();
    fetchRecentTransfers();
    initBarcodeDetector();
    return () => stopCamera();
  }, []);

  const fetchOutlets = async () => {
    const { data } = await supabase
      .from("outlets")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name");
    if (data) setOutlets(data);
  };

  const fetchRecentTransfers = async () => {
    setIsLoadingTransfers(true);
    const { data } = await supabase
      .from("stock_transfers")
      .select(`
        id,
        created_at,
        notes,
        status,
        stock_log:stock_logs!stock_log_id(
          imei,
          product:products!product_id(name, color)
        ),
        from_outlet:outlets!from_outlet_id(name, code),
        to_outlet:outlets!to_outlet_id(name, code),
        transferred_by_profile:profiles!transferred_by(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) setRecentTransfers(data as unknown as Transfer[]);
    setIsLoadingTransfers(false);
  };

  // Camera functions
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
        formats: [
          "qr_code", "aztec", "code_128", "code_39", "code_93",
          "codabar", "data_matrix", "ean_13", "ean_8", "itf",
          "pdf417", "upc_a", "upc_e"
        ],
      });
    }
  };

  const startCamera = async () => {
    const getStream = async (constraints: MediaStreamConstraints) => {
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      streamRef.current = await getStream({
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
    } catch {
      try {
        streamRef.current = await getStream({
          video: { facingMode: "environment" }
        });
      } catch {
        try {
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
      if (!videoRef.current) return;
      
      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            handleScanFromCamera(rawValue);
          }
        }
      } catch {
        // Detection failed, continue
      }
    }, 500);
  };

  const handleScanFromCamera = async (code: string) => {
    // Check if already added in bulk mode
    if (isBulkMode && bulkItems.some(b => b.imei === code)) {
      playSound("warning");
      toast.warning("IMEI already in batch");
      return;
    }

    setImeiInput(code);
    
    // Validate and add
    const item = await validateImei(code);
    if (!item) return;

    if (isBulkMode) {
      setBulkItems(prev => [...prev, { ...item, validated: true }]);
      setImeiInput("");
      playSound("success");
      toast.success(`Added to batch (${bulkItems.length + 1} items)`);
    } else {
      setStockItem(item);
      toast.success("IMEI verified!");
      stopCamera();
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

  const validateImei = async (imei?: string) => {
    const imeiToValidate = imei || imeiInput.trim();
    if (!imeiToValidate) return null;

    setIsValidating(true);
    const { data, error } = await supabase
      .from("stock_logs")
      .select(`
        id,
        imei,
        product_id,
        outlet_id,
        product:products!product_id(name, color),
        outlet:outlets!outlet_id(name, code)
      `)
      .eq("imei", imeiToValidate)
      .eq("status", "in_stock")
      .single();

    setIsValidating(false);

    if (error || !data) {
      playSound("error");
      toast.error(`IMEI ${imeiToValidate} not found or not in stock`);
      return null;
    }
    
    playSound("beep");
    return data as unknown as StockItem;
  };

  const handleSingleValidate = async () => {
    const item = await validateImei();
    if (item) {
      setStockItem(item);
      toast.success("IMEI verified!");
    } else {
      setStockItem(null);
    }
  };

  const handleBulkAdd = async () => {
    const item = await validateImei();
    if (!item) return;

    // Check if already added
    if (bulkItems.some(b => b.id === item.id)) {
      toast.error("IMEI already added to batch");
      return;
    }

    setBulkItems(prev => [...prev, { ...item, validated: true }]);
    setImeiInput("");
    toast.success(`Added to batch (${bulkItems.length + 1} items)`);
  };

  const removeBulkItem = (id: string) => {
    setBulkItems(prev => prev.filter(item => item.id !== id));
  };

  const handleTransfer = async () => {
    if (!stockItem || !toOutlet) {
      toast.error("Please complete all required fields");
      return;
    }

    if (stockItem.outlet_id === toOutlet.id) {
      toast.error("Item is already at this outlet");
      return;
    }

    setIsTransferring(true);

    try {
      // Create transfer record with 'in_transit' status (stock stays at origin until accepted)
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .insert({
          stock_log_id: stockItem.id,
          from_outlet_id: stockItem.outlet_id,
          to_outlet_id: toOutlet.id,
          transferred_by: null,
          notes: notes.trim() || null,
          status: "in_transit",
        });

      if (transferError) throw transferError;

      // Do NOT update stock_log outlet_id here - it stays at origin until receiving shop accepts

      playSound("success");
      toast.success("Transfer initiated! Item is now in transit.");

      // Reset form
      setStockItem(null);
      setImeiInput("");
      setNotes("");
      fetchRecentTransfers();
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to transfer: " + error.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleBulkTransfer = async () => {
    if (bulkItems.length === 0 || !toOutlet) {
      toast.error("Please add items and select destination");
      return;
    }

    // Filter items that can be transferred (not already at destination)
    const transferableItems = bulkItems.filter(item => item.outlet_id !== toOutlet.id);
    
    if (transferableItems.length === 0) {
      toast.error("All items are already at the destination outlet");
      return;
    }

    setIsTransferring(true);

    try {
      // Create transfer records for all items with 'in_transit' status
      const transferRecords = transferableItems.map(item => ({
        stock_log_id: item.id,
        from_outlet_id: item.outlet_id,
        to_outlet_id: toOutlet.id,
        transferred_by: null,
        notes: notes.trim() || null,
        status: "in_transit",
      }));

      const { error: transferError } = await supabase
        .from("stock_transfers")
        .insert(transferRecords);

      if (transferError) throw transferError;

      // Do NOT update stock_logs outlet_id - items stay at origin until receiving shop accepts

      playSound("success");
      toast.success(`${transferableItems.length} items are now in transit!`);

      // Reset form
      setBulkItems([]);
      setImeiInput("");
      setNotes("");
      setToOutlet(null);
      fetchRecentTransfers();
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to transfer: " + error.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const canTransfer = stockItem && toOutlet && stockItem.outlet_id !== toOutlet.id;
  const canBulkTransfer = bulkItems.length > 0 && toOutlet;

  const handleCancelTransfer = async (transferId: string) => {
    setCancellingId(transferId);

    try {
      const { error } = await supabase
        .from("stock_transfers")
        .update({ status: "cancelled" })
        .eq("id", transferId);

      if (error) throw error;

      playSound("warning");
      toast.success("Transfer cancelled. Stock remains at origin.");
      fetchRecentTransfers();
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to cancel: " + error.message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Stock Transfers</h1>
        <p className="text-muted-foreground">Move inventory between outlets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isBulkMode ? <Layers className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
                  {isBulkMode ? "Bulk Transfer" : "Single Transfer"}
                </CardTitle>
                <CardDescription>
                  {isBulkMode 
                    ? "Scan multiple IMEIs to transfer at once" 
                    : "Scan IMEI and select destination outlet"}
                </CardDescription>
              </div>
              <Button
                variant={isBulkMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setBulkItems([]);
                  setStockItem(null);
                  setImeiInput("");
                }}
              >
                <Layers className="h-4 w-4 mr-1" />
                {isBulkMode ? "Single Mode" : "Bulk Mode"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Camera View */}
            {showCamera && (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-32 border-2 border-primary rounded-lg opacity-70" />
                </div>
                <div className="absolute top-2 right-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={stopCamera}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                </div>
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <Badge variant="secondary" className="bg-background/80">
                    {isBulkMode 
                      ? `Scanning... ${bulkItems.length} items added` 
                      : "Point camera at barcode"}
                  </Badge>
                </div>
              </div>
            )}

            {/* Step 1: Scan IMEI */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ScanBarcode className="h-4 w-4" />
                  Step 1: Scan IMEI {isBulkMode && `(${bulkItems.length} items added)`}
                </Label>
                {isBulkMode && (
                  <Button
                    variant={showCamera ? "destructive" : "outline"}
                    size="sm"
                    onClick={showCamera ? stopCamera : startCamera}
                    className="gap-1"
                  >
                    <Camera className="h-4 w-4" />
                    {showCamera ? "Stop" : "Scan"}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={imeiInput}
                  onChange={(e) => setImeiInput(e.target.value)}
                  placeholder="Enter or scan IMEI..."
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && (isBulkMode ? handleBulkAdd() : handleSingleValidate())}
                  disabled={showCamera}
                />
                {isBulkMode ? (
                  <Button onClick={handleBulkAdd} disabled={isValidating || showCamera}>
                    {isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={showCamera ? stopCamera : startCamera}
                      className={cn(showCamera && "bg-destructive text-destructive-foreground")}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleSingleValidate} disabled={isValidating}>
                      {isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </>
                )}
              </div>

              {/* Bulk Items List */}
              {isBulkMode && bulkItems.length > 0 && (
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {bulkItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground font-medium">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">
                              {item.product.name} {item.product.color && `(${item.product.color})`}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground">{item.imei}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.outlet && (
                            <Badge variant="outline" className="text-xs">
                              {item.outlet.code}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeBulkItem(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Single Item Display */}
              {!isBulkMode && stockItem && (
                <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {stockItem.product.name} {stockItem.product.color && `(${stockItem.product.color})`}
                      </p>
                      <p className="text-sm font-mono text-muted-foreground">{stockItem.imei}</p>
                    </div>
                    <Badge variant="outline" className="border-success text-success">
                      <Check className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  {stockItem.outlet && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Store className="h-4 w-4" />
                      Currently at: <span className="font-medium text-foreground">{stockItem.outlet.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Select Destination */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Step 2: Select Destination Outlet
              </Label>
              <Popover open={toOutletOpen} onOpenChange={setToOutletOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={isBulkMode ? bulkItems.length === 0 : !stockItem}
                    className="w-full justify-between h-12"
                  >
                    {toOutlet ? (
                      <span>{toOutlet.name} ({toOutlet.code})</span>
                    ) : (
                      <span className="text-muted-foreground">Select destination...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search outlets..." />
                    <CommandList>
                      <CommandEmpty>No outlets found.</CommandEmpty>
                      <CommandGroup>
                        {outlets.map((outlet) => (
                          <CommandItem
                            key={outlet.id}
                            value={`${outlet.name} ${outlet.code}`}
                            onSelect={() => {
                              setToOutlet(outlet);
                              setToOutletOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                toOutlet?.id === outlet.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <p className="font-medium">{outlet.name}</p>
                              <p className="text-xs text-muted-foreground">Code: {outlet.code}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Transfer Preview - Bulk Mode */}
            {isBulkMode && bulkItems.length > 0 && toOutlet && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Bulk Transfer Preview</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <Badge variant="outline">{bulkItems.length} items</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Multiple outlets</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary" />
                  <div className="text-center">
                    <Badge className="bg-primary">{toOutlet.code}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{toOutlet.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Preview - Single Mode */}
            {!isBulkMode && stockItem && toOutlet && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Transfer Preview</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <Badge variant="outline">{stockItem.outlet?.code || "N/A"}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stockItem.outlet?.name || "Unknown"}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary" />
                  <div className="text-center">
                    <Badge className="bg-primary">{toOutlet.code}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{toOutlet.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for transfer..."
                rows={2}
                disabled={isBulkMode ? bulkItems.length === 0 : !stockItem}
              />
            </div>

            {/* Transfer Button */}
            {isBulkMode ? (
              <Button
                onClick={handleBulkTransfer}
                disabled={!canBulkTransfer || isTransferring}
                className="w-full h-12 gradient-primary"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Transferring {bulkItems.length} items...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Transfer {bulkItems.length} Items
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleTransfer}
                disabled={!canTransfer || isTransferring}
                className="w-full h-12 gradient-primary"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Complete Transfer
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent Transfers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transfers</CardTitle>
            <CardDescription>Latest stock movements between outlets</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {isLoadingTransfers ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : recentTransfers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transfers yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="p-4 rounded-lg bg-muted/50 border space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {transfer.stock_log.product.name}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {transfer.stock_log.imei}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {transfer.status === "in_transit" ? (
                            <Badge variant="secondary" className="text-xs">
                              In Transit
                            </Badge>
                          ) : transfer.status === "completed" ? (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Cancelled
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{transfer.from_outlet.code}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-primary">{transfer.to_outlet.code}</Badge>
                      </div>
                      {transfer.notes && (
                        <p className="text-xs text-muted-foreground">{transfer.notes}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          By: {transfer.transferred_by_profile?.full_name || "Unknown"}
                        </p>
                        {transfer.status === "in_transit" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleCancelTransfer(transfer.id)}
                            disabled={cancellingId === transfer.id}
                          >
                            {cancellingId === transfer.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Ban className="h-3 w-3 mr-1" />
                                Cancel
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
