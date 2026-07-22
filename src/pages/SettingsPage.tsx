import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useMode } from "@/contexts/ModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle, Loader2, Info, Settings, Database } from "lucide-react";

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  errors: number;
}

export default function SettingsPage() {
  const { isAdmin } = useMode();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ""));

      if (values.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx];
        });
        rows.push(row);
      }
    }

    return rows;
  };

  const findColumn = (row: Record<string, string>, possibleNames: string[]): string | null => {
    for (const name of possibleNames) {
      const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
      if (key && row[key]) return row[key];
    }
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error("No valid data found in CSV");
        setIsImporting(false);
        return;
      }

      const result: ImportResult = { total: rows.length, inserted: 0, updated: 0, errors: 0 };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        const itemName = findColumn(row, ["Item Name", "Name", "Product Name", "Product", "Model"]);
        const price = findColumn(row, ["Price", "Sale Price", "Selling Price", "MRP", "Rate"]);
        const category = findColumn(row, ["Category", "Group", "Type"]);
        const color = findColumn(row, ["Color", "Colour", "Variant"]);
        const specs = findColumn(row, ["Specs", "Specifications", "Description", "Details"]);
        const sku = findColumn(row, ["SKU", "Code", "Item Code", "Product Code", "Barcode"]);

        if (!itemName) {
          result.errors++;
          continue;
        }

        const productData = {
          model: sku || itemName,
          name: itemName,
          price: parseFloat(price || "0") || 0,
          category: category || null,
          color: color || null,
          specs: specs || null,
          created_by: user?.id ?? null,
        };

        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("model", productData.model)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("products")
            .update({
              name: productData.name,
              price: productData.price,
              category: productData.category,
              color: productData.color,
              specs: productData.specs,
            })
            .eq("id", existing.id);

          if (error) {
            result.errors++;
          } else {
            result.updated++;
          }
        } else {
          const { error } = await supabase.from("products").insert(productData);

          if (error) {
            result.errors++;
          } else {
            result.inserted++;
          }
        }

        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }

      setImportResult(result);
      toast.success(`Imported ${result.inserted + result.updated} products successfully`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import CSV file");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    try {
      await supabase.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("stock_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("stock_alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      toast.success("All data deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete data");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageTransition>
      <div className="h-full flex flex-col gap-6">
        {/* Header */}
        <motion.div 
          variants={staggerItem}
          className="flex items-center gap-4"
        >
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow-primary">
            <Settings className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage data import and system settings</p>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Data Import Section */}
          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Data Import
                </CardTitle>
                <CardDescription>
                  Import products from a CSV file (Vyapar, Excel, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-muted/50 border-border/50">
                  <Info className="h-4 w-4" />
                  <AlertTitle>CSV Format</AlertTitle>
                  <AlertDescription>
                    Your CSV should have columns like: Item Name, Price, Category, Color, SKU.
                    If a product with the same SKU/Model exists, it will be updated instead of duplicated.
                  </AlertDescription>
                </Alert>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isImporting}
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full h-12 gradient-primary text-primary-foreground"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {isImporting ? "Importing..." : "Upload CSV File"}
                </Button>

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing... {progress}%
                    </p>
                  </div>
                )}

                {importResult && (
                  <Alert variant={importResult.errors > 0 ? "destructive" : "default"} className="bg-muted/50">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Import Complete</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1">
                        <p>Total rows processed: {importResult.total}</p>
                        <p className="text-success">New products added: {importResult.inserted}</p>
                        <p className="text-primary">Existing products updated: {importResult.updated}</p>
                        {importResult.errors > 0 && (
                          <p className="text-destructive">Errors (skipped rows): {importResult.errors}</p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Danger Zone - Admin Only */}
          {isAdmin && (
            <motion.div variants={staggerItem}>
              <Card className="bg-card/80 backdrop-blur border-destructive/30 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible actions. Use with caution.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
                    <div className="flex items-start gap-3">
                      <Database className="h-5 w-5 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Delete All Data</p>
                        <p className="text-sm text-muted-foreground">
                          This will permanently delete all sales, stock logs, stock alerts, and products.
                        </p>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting} className="w-full h-12">
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete All Data
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete ALL:
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                              <li>Sales records</li>
                              <li>Stock logs</li>
                              <li>Stock alerts</li>
                              <li>Products</li>
                            </ul>
                            <p className="mt-4 font-semibold text-destructive">
                              This action cannot be undone. Use this only before going live.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAllData}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Yes, Delete Everything
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
}
