import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
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

interface Transfer {
  id: string;
  created_at: string;
  notes: string | null;
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
  const { user } = useAuth();
  const { playSound } = useSoundEffects();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [toOutlet, setToOutlet] = useState<Outlet | null>(null);
  const [toOutletOpen, setToOutletOpen] = useState(false);
  
  const [imeiInput, setImeiInput] = useState("");
  const [stockItem, setStockItem] = useState<StockItem | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [notes, setNotes] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);

  useEffect(() => {
    fetchOutlets();
    fetchRecentTransfers();
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

  const validateImei = async () => {
    if (!imeiInput.trim()) return;

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
      .eq("imei", imeiInput.trim())
      .eq("status", "in_stock")
      .single();

    if (error || !data) {
      playSound("error");
      toast.error("IMEI not found or not in stock");
      setStockItem(null);
    } else {
      playSound("beep");
      setStockItem(data as unknown as StockItem);
      toast.success("IMEI verified!");
    }
    setIsValidating(false);
  };

  const handleTransfer = async () => {
    if (!stockItem || !toOutlet || !user) {
      toast.error("Please complete all required fields");
      return;
    }

    if (stockItem.outlet_id === toOutlet.id) {
      toast.error("Item is already at this outlet");
      return;
    }

    setIsTransferring(true);

    try {
      // Create transfer record
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .insert({
          stock_log_id: stockItem.id,
          from_outlet_id: stockItem.outlet_id,
          to_outlet_id: toOutlet.id,
          transferred_by: user.id,
          notes: notes.trim() || null,
        });

      if (transferError) throw transferError;

      // Update stock_log with new outlet
      const { error: updateError } = await supabase
        .from("stock_logs")
        .update({ outlet_id: toOutlet.id })
        .eq("id", stockItem.id);

      if (updateError) throw updateError;

      playSound("success");
      toast.success("Transfer completed successfully!");

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

  const canTransfer = stockItem && toOutlet && stockItem.outlet_id !== toOutlet.id;

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
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              New Transfer
            </CardTitle>
            <CardDescription>Scan IMEI and select destination outlet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Scan IMEI */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ScanBarcode className="h-4 w-4" />
                Step 1: Scan IMEI
              </Label>
              <div className="flex gap-2">
                <Input
                  value={imeiInput}
                  onChange={(e) => setImeiInput(e.target.value)}
                  placeholder="Enter or scan IMEI..."
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && validateImei()}
                />
                <Button onClick={validateImei} disabled={isValidating}>
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>

              {stockItem && (
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
                    disabled={!stockItem}
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
                        {outlets
                          .filter((o) => o.id !== stockItem?.outlet_id)
                          .map((outlet) => (
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

            {/* Transfer Preview */}
            {stockItem && toOutlet && (
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
                disabled={!stockItem}
              />
            </div>

            {/* Transfer Button */}
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
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{transfer.from_outlet.code}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-primary">{transfer.to_outlet.code}</Badge>
                      </div>
                      {transfer.notes && (
                        <p className="text-xs text-muted-foreground">{transfer.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        By: {transfer.transferred_by_profile?.full_name || "Unknown"}
                      </p>
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
