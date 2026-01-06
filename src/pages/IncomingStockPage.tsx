import { useState, useEffect } from "react";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        id,
        created_at,
        notes,
        status,
        stock_log_id,
        to_outlet_id,
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
      // Update transfer status to completed
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .update({
          status: "completed",
          accepted_by: null,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", transfer.id);

      if (transferError) throw transferError;

      // Update stock_log with new outlet
      const { error: stockError } = await supabase
        .from("stock_logs")
        .update({ outlet_id: transfer.to_outlet_id })
        .eq("id", transfer.stock_log_id);

      if (stockError) throw stockError;

      playSound("success");
      toast.success("Stock accepted successfully!");
      
      // Remove from list
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
      // Update transfer status to cancelled - stock stays at origin
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .update({
          status: "cancelled",
        })
        .eq("id", transfer.id);

      if (transferError) throw transferError;

      playSound("warning");
      toast.success("Transfer rejected. Stock returned to sender.");
      
      // Remove from list
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDown className="h-6 w-6" />
            Incoming Stock
          </h1>
          <p className="text-muted-foreground">Accept transferred stock from other outlets</p>
        </div>
        <Badge variant={pendingCount > 0 ? "default" : "secondary"} className="text-lg px-3 py-1">
          {pendingCount} Pending
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
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
              <PackageCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No incoming stock transfers</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-350px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>From Outlet</TableHead>
                    <TableHead>Sent By</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{transfer.stock_log.product.name}</p>
                            {transfer.stock_log.product.color && (
                              <p className="text-xs text-muted-foreground">
                                {transfer.stock_log.product.color}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {transfer.stock_log.imei}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span>{transfer.from_outlet.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {transfer.from_outlet.code}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {transfer.transferred_by_profile?.full_name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmReject(transfer)}
                            disabled={rejectingId === transfer.id || acceptingId === transfer.id}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmTransfer} onOpenChange={() => setConfirmTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Incoming Stock?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to accept this stock transfer. This will move the item to your outlet's inventory.
                </p>
                {confirmTransfer && (
                  <div className="p-3 rounded-lg bg-muted space-y-2">
                    <p>
                      <strong>Product:</strong> {confirmTransfer.stock_log.product.name}
                      {confirmTransfer.stock_log.product.color && ` (${confirmTransfer.stock_log.product.color})`}
                    </p>
                    <p><strong>IMEI:</strong> {confirmTransfer.stock_log.imei}</p>
                    <p><strong>From:</strong> {confirmTransfer.from_outlet.name}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTransfer && handleAcceptTransfer(confirmTransfer)}
            >
              <Check className="h-4 w-4 mr-2" />
              Accept Stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={!!confirmReject} onOpenChange={() => setConfirmReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Transfer?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will reject the transfer and the stock will remain at the sender's outlet.
                </p>
                {confirmReject && (
                  <div className="p-3 rounded-lg bg-muted space-y-2">
                    <p>
                      <strong>Product:</strong> {confirmReject.stock_log.product.name}
                      {confirmReject.stock_log.product.color && ` (${confirmReject.stock_log.product.color})`}
                    </p>
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
  );
}
