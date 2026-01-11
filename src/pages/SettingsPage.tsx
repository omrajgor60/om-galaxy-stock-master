import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMode } from "@/contexts/ModeContext";
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
import { Upload, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle, Loader2, Info } from "lucide-react";

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  errors: number;
}

export default function SettingsPage() {
  const { isAdmin } = useMode();
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
        
        // Map CSV columns to product fields
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
          created_by: null,
        };

        // Check if product exists (by model/SKU)
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("model", productData.model)
          .maybeSingle();

        if (existing) {
          // Update existing product
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
          // Insert new product
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
      // Delete sales first (has foreign key to products)
      await supabase.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      // Delete stock logs
      await supabase.from("stock_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      // Delete stock alerts
      await supabase.from("stock_alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      // Delete products
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Data Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Data Import
          </CardTitle>
          <CardDescription>
            Import products from a CSV file (Vyapar, Excel, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
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
            className="w-full sm:w-auto"
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
            <Alert variant={importResult.errors > 0 ? "destructive" : "default"}>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Import Complete</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  <p>Total rows processed: {importResult.total}</p>
                  <p className="text-green-600">New products added: {importResult.inserted}</p>
                  <p className="text-blue-600">Existing products updated: {importResult.updated}</p>
                  {importResult.errors > 0 && (
                    <p className="text-red-600">Errors (skipped rows): {importResult.errors}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone - Admin Only */}
      {isAdmin && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions. Use with caution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
