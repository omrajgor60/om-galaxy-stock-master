import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition, staggerItem } from "@/components/PageTransition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ScanBarcode, Camera, X, Save, Plus, Package, Search, RefreshCw, SlidersHorizontal } from "lucide-react";

interface MasterItem {
  id: string;
  barcode: string;
  model_name: string;
  ram: string | null;
  color: string | null;
  price: number;
  updated_at: string;
}

const emptyForm = { model_name: "", ram: "", color: "", price: "" };

export default function MasterInventoryPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [barcode, setBarcode] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterRam, setFilterRam] = useState<string>("all");
  const [filterColor, setFilterColor] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
    initDetector();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showCamera) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [showCamera]);

  const initDetector = async () => {
    if (!("BarcodeDetector" in window)) return;
    try {
      const formats = await (window as any).BarcodeDetector.getSupportedFormats();
      detectorRef.current = new (window as any).BarcodeDetector({ formats });
    } catch {
      detectorRef.current = new (window as any).BarcodeDetector({
        formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "data_matrix"],
      });
    }
  };

  const fetchItems = async () => {
    const { data } = await supabase
      .from("master_inventory")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (data) setItems(data as MasterItem[]);
  };

  const lookupBarcode = useCallback(async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setBarcode(clean);
    const { data } = await supabase
      .from("master_inventory")
      .select("*")
      .eq("barcode", clean)
      .maybeSingle();
    if (data) {
      setExistingId(data.id);
      setForm({
        model_name: data.model_name || "",
        ram: data.ram || "",
        color: data.color || "",
        price: data.price != null ? String(data.price) : "",
      });
      toast.info("Existing item loaded — edit and save to update");
    } else {
      setExistingId(null);
      setForm(emptyForm);
      toast.success("New barcode — fill in details");
    }
  }, []);

  const handleBarcodeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupBarcode(barcode);
    }
  };

  const resetAll = () => {
    setBarcode("");
    setForm(emptyForm);
    setExistingId(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!barcode.trim()) {
      toast.error("Scan or enter a barcode first");
      return;
    }
    if (!form.model_name.trim()) {
      toast.error("Model name is required");
      return;
    }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price");
      return;
    }

    setSaving(true);
    const payload = {
      barcode: barcode.trim(),
      model_name: form.model_name.trim(),
      ram: form.ram.trim() || null,
      color: form.color.trim() || null,
      price: priceNum,
    };

    const { error } = existingId
      ? await supabase.from("master_inventory").update(payload).eq("id", existingId)
      : await supabase.from("master_inventory").insert(payload);

    setSaving(false);

    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success(existingId ? "Item updated" : "Item added");
    resetAll();
    fetchItems();
  };

  const startCamera = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
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
        videoRef.current.play().catch(() => {});
        startDetecting();
      }
    }, 100);
  };

  const startDetecting = () => {
    if (!detectorRef.current || !videoRef.current) {
      toast.error("Camera scanning not supported on this device");
      return;
    }
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes.length > 0 && codes[0].rawValue) {
          const raw = codes[0].rawValue;
          stopCamera();
          await lookupBarcode(raw);
        }
      } catch {
        // continue
      }
    }, 500);
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const uniqueRams = useMemo(
    () => Array.from(new Set(items.map((it) => it.ram).filter(Boolean))).sort(),
    [items]
  );
  const uniqueColors = useMemo(
    () => Array.from(new Set(items.map((it) => it.color).filter(Boolean))).sort(),
    [items]
  );

  const filtered = items.filter((it) => {
    const q = search.trim().toLowerCase();
    const modelQ = filterModel.trim().toLowerCase();
    const matchesSearch =
      !q ||
      it.barcode.toLowerCase().includes(q) ||
      it.model_name.toLowerCase().includes(q) ||
      (it.color || "").toLowerCase().includes(q) ||
      (it.ram || "").toLowerCase().includes(q);
    const matchesModel = !modelQ || it.model_name.toLowerCase().includes(modelQ);
    const matchesRam = filterRam === "all" || it.ram === filterRam;
    const matchesColor = filterColor === "all" || it.color === filterColor;
    return matchesSearch && matchesModel && matchesRam && matchesColor;
  });

  const activeFilterCount =
    (filterModel ? 1 : 0) + (filterRam !== "all" ? 1 : 0) + (filterColor !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setFilterModel("");
    setFilterRam("all");
    setFilterColor("all");
  };

  return (
    <PageTransition>
      <div className="h-full flex flex-col gap-6">
        {/* Header */}
        <motion.div variants={staggerItem} className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow-primary">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Master Inventory</h1>
            <p className="text-muted-foreground">Add or update items by barcode</p>
          </div>
        </motion.div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto">
          {/* Left: Scan + Form */}
          <motion.div variants={staggerItem} className="space-y-4">
            <Card className="bg-card/80 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ScanBarcode className="h-5 w-5 text-primary" />
                  Barcode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleBarcodeKey}
                    placeholder="Scan or type barcode, press Enter"
                    className="h-12 text-base"
                    disabled={showCamera}
                  />
                  <Button
                    variant="outline"
                    onClick={showCamera ? stopCamera : startCamera}
                    className="h-12 px-4"
                  >
                    {showCamera ? <X className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                  </Button>
                  <Button variant="outline" onClick={resetAll} className="h-12 px-4">
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                </div>

                {showCamera && (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-0 border-2 border-primary/50 rounded-xl pointer-events-none" />
                  </div>
                )}

                {barcode && !showCamera && (
                  <Badge variant={existingId ? "secondary" : "default"} className="text-sm">
                    {existingId ? "Editing existing item" : "New item"}
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model Name *</Label>
                  <Input
                    value={form.model_name}
                    onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                    placeholder="e.g. Galaxy S24"
                    className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RAM</Label>
                    <Input
                      value={form.ram}
                      onChange={(e) => setForm((f) => ({ ...f, ram: e.target.value }))}
                      placeholder="e.g. 8GB"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      placeholder="e.g. Black"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Price *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="h-11"
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || !barcode.trim()}
                  className="w-full h-12 gradient-primary text-primary-foreground gap-2"
                >
                  {existingId ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  {saving ? "Saving..." : existingId ? "Update Item" : "Add Item"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: Recent Items */}
          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 h-full flex flex-col">
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Items ({filtered.length})</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters((s) => !s)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search barcode, model, color, RAM..."
                    className="h-11 pl-9"
                  />
                </div>

                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Model Name</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={filterModel}
                          onChange={(e) => setFilterModel(e.target.value)}
                          placeholder="Filter model..."
                          className="h-10 pl-8"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">RAM</Label>
                      <Select value={filterRam} onValueChange={setFilterRam}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="All RAM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All RAM</SelectItem>
                          {uniqueRams.map((ram) => (
                            <SelectItem key={ram} value={ram as string}>
                              {ram}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Color</Label>
                      <Select value={filterColor} onValueChange={setFilterColor}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="All Colors" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Colors</SelectItem>
                          {uniqueColors.map((color) => (
                            <SelectItem key={color} value={color as string}>
                              {color}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}

                {activeFilterCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {filterModel && (
                        <Badge variant="secondary" className="gap-1">
                          Model: {filterModel}
                          <button onClick={() => setFilterModel("")} className="ml-1 hover:text-primary">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {filterRam !== "all" && (
                        <Badge variant="secondary" className="gap-1">
                          RAM: {filterRam}
                          <button onClick={() => setFilterRam("all")} className="ml-1 hover:text-primary">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {filterColor !== "all" && (
                        <Badge variant="secondary" className="gap-1">
                          Color: {filterColor}
                          <button onClick={() => setFilterColor("all")} className="ml-1 hover:text-primary">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-8">
                      Clear all
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-6 pb-6">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Package className="h-10 w-10 opacity-30 mb-3" />
                      <p className="text-sm">No items yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => lookupBarcode(it.barcode)}
                          className="w-full text-left p-3 rounded-xl border border-border/50 bg-background/50 hover:bg-muted/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{it.model_name}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {it.barcode}
                              </p>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {it.ram && (
                                  <Badge variant="outline" className="text-xs">
                                    {it.ram}
                                  </Badge>
                                )}
                                {it.color && (
                                  <Badge variant="outline" className="text-xs">
                                    {it.color}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-primary">
                                ₹{Number(it.price).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}