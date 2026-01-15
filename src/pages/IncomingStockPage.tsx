import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import {
  PackageCheck,
  Package,
  ArrowDown,
  Loader2,
  Check,
  Clock,
  Store,
  XCircle,
  Truck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface IncomingTransfer {
  id: string;
  created_at: string;
  notes: string | null;
  status: string;
  stock_log_id: string;
  to_outlet_id: string;
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

export default function IncomingStockPage() {
  const { isAdmin } = useMode();
  const { playSound } = useSoundEffects();

  const [incomingTransfers, setIncomingTransfers] = useState<IncomingTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<IncomingTransfer | null>(null);
  const [confirmReject, setConfirmReject] = useState<IncomingTransfer | null>(null);

  useEffect(() => {
    fetchIncomingTransfers();
  }, []);

  const fetchIncomingTransfers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("stock_transfers")
      .select(`
        id, created_at, notes, status, stock_log_id, to_outlet_id,
        stock_log:stock_logs!stock_log_id(
          imei,
          product:products!product_id(name, color)
        ),
        from_outlet:outlets!from_outlet_id(name, code),
        to_outlet:outlets!to_outlet_id(name, code),
        transferred_by_profile:profiles!transferred_by(full_name)
      `)
      .eq("status", "in_transit")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load incoming transfers");
    } else {
      setIncomingTransfers(data as unknown as IncomingTransfer[]);
    }
    setIsLoading(false);
  };

  const handleAcceptTransfer = async (transfer: IncomingTransfer) => {
    setAcceptingId(transfer.id);

    try {
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .update({
          status: "completed",
          accepted_by: null,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", transfer.id);

      if (transferError) throw transferError;

      const { error: stockError } = await supabase
        .from("stock_logs")
        .update({ outlet_id: transfer.to_outlet_id })
        .eq("id", transfer.stock_log_id);

      if (stockError) throw stockError;

      playSound("success");
      toast.success("Stock accepted successfully!");
      
      setIncomingTransfers(prev => prev.filter(t => t.id !== transfer.id));
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to accept: " + error.message);
    } finally {
      setAcceptingId(null);
      setConfirmTransfer(null);
    }
  };

  const handleRejectTransfer = async (transfer: IncomingTransfer) => {
    setRejectingId(transfer.id);

    try {
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .update({ status: "cancelled" })
        .eq("id", transfer.id);

      if (transferError) throw transferError;

      playSound("warning");
      toast.success("Transfer rejected. Stock returned to sender.");
      
      setIncomingTransfers(prev => prev.filter(t => t.id !== transfer.id));
    } catch (error: any) {
      playSound("error");
      toast.error("Failed to reject: " + error.message);
    } finally {
      setRejectingId(null);
      setConfirmReject(null);
    }
  };

  const pendingCount = incomingTransfers.length;

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
              <ArrowDown className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Incoming Stock</h1>
              <p className="text-muted-foreground">Accept transferred stock from other outlets</p>
            </div>
          </div>
          <Badge variant={pendingCount > 0 ? "default" : "secondary"} className="text-lg px-4 py-2 h-auto">
            <Truck className="h-5 w-5 mr-2" />
            {pendingCount} Pending
          </Badge>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-3 gap-4"
        >
          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">In Transit</p>
                    <p className="text-4xl font-bold text-primary mt-1">{pendingCount}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Action Needed</p>
                    <p className="text-4xl font-bold text-success mt-1">{pendingCount > 0 ? "Yes" : "No"}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Status</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {isLoading ? "Loading..." : "Ready"}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <PackageCheck className="h-6 w-6 text-secondary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Incoming Transfers */}
        <motion.div variants={staggerItem} className="flex-1">
          <Card className="bg-card/80 backdrop-blur border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                In Transit
              </CardTitle>
              <CardDescription>
                Stock items sent to your outlet awaiting acceptance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : incomingTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <PackageCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-lg font-medium text-muted-foreground">No incoming stock transfers</p>
                  <p className="text-sm text-muted-foreground">Check back later for new transfers</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-450px)]">
                  <div className="space-y-3">
                    {incomingTransfers.map((transfer) => (
                      <div
                        key={transfer.id}
                        className="p-4 rounded-lg bg-muted/50 border border-border/50 hover:border-primary/30 transition-all"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Package className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{transfer.stock_log.product.name}</p>
                                {transfer.stock_log.product.color && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {transfer.stock_log.product.color}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-mono text-muted-foreground truncate">
                                {transfer.stock_log.imei}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Store className="h-3 w-3" />
                                  From: {transfer.from_outlet.name}
                                </span>
                                <span>By: {transfer.transferred_by_profile?.full_name || "Unknown"}</span>
                                <span>{formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setConfirmReject(transfer)}
                              disabled={rejectingId === transfer.id || acceptingId === transfer.id}
                              className="h-10"
                            >
                              {rejectingId === transfer.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setConfirmTransfer(transfer)}
                              disabled={acceptingId === transfer.id || rejectingId === transfer.id}
                              className="h-10 gradient-primary text-primary-foreground"
                            >
                              {acceptingId === transfer.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Accept
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmTransfer} onOpenChange={() => setConfirmTransfer(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Accept Incoming Stock?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>You are about to accept this stock transfer. This will move the item to your outlet's inventory.</p>
                  {confirmTransfer && (
                    <div className="p-3 rounded-lg bg-muted space-y-2">
                      <p><strong>Product:</strong> {confirmTransfer.stock_log.product.name} {confirmTransfer.stock_log.product.color && `(${confirmTransfer.stock_log.product.color})`}</p>
                      <p><strong>IMEI:</strong> {confirmTransfer.stock_log.imei}</p>
                      <p><strong>From:</strong> {confirmTransfer.from_outlet.name}</p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmTransfer && handleAcceptTransfer(confirmTransfer)} className="gradient-primary text-primary-foreground">
                <Check className="h-4 w-4 mr-2" />
                Accept Stock
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reject Confirmation Dialog */}
        <AlertDialog open={!!confirmReject} onOpenChange={() => setConfirmReject(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Transfer?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>This will reject the transfer and the stock will remain at the sender's outlet.</p>
                  {confirmReject && (
                    <div className="p-3 rounded-lg bg-muted space-y-2">
                      <p><strong>Product:</strong> {confirmReject.stock_log.product.name} {confirmReject.stock_log.product.color && `(${confirmReject.stock_log.product.color})`}</p>
                      <p><strong>IMEI:</strong> {confirmReject.stock_log.imei}</p>
                      <p><strong>From:</strong> {confirmReject.from_outlet.name}</p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => confirmReject && handleRejectTransfer(confirmReject)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Transfer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  );
}
