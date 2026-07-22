import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMode } from "@/contexts/ModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Store, Plus, Pencil, MapPin, Phone, Loader2, Building2, CheckCircle, XCircle } from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export default function OutletsPage() {
  const { isAdmin } = useMode();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("outlets").select("*").order("name");
    
    if (error) {
      toast.error("Failed to load outlets");
    } else {
      setOutlets(data || []);
    }
    setIsLoading(false);
  };

  const openCreateDialog = () => {
    setEditingOutlet(null);
    setName("");
    setCode("");
    setAddress("");
    setPhone("");
    setShowDialog(true);
  };

  const openEditDialog = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setName(outlet.name);
    setCode(outlet.code);
    setAddress(outlet.address || "");
    setPhone(outlet.phone || "");
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }

    setIsSaving(true);

    if (editingOutlet) {
      const { error } = await supabase
        .from("outlets")
        .update({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", editingOutlet.id);

      if (error) {
        toast.error("Failed to update outlet: " + error.message);
      } else {
        toast.success("Outlet updated successfully");
        setShowDialog(false);
        fetchOutlets();
      }
    } else {
      const { error } = await supabase
        .from("outlets")
        .insert({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          created_by: user?.id ?? null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("An outlet with this code already exists");
        } else {
          toast.error("Failed to create outlet: " + error.message);
        }
      } else {
        toast.success("Outlet created successfully");
        setShowDialog(false);
        fetchOutlets();
      }
    }

    setIsSaving(false);
  };

  const toggleActive = async (outlet: Outlet) => {
    const { error } = await supabase
      .from("outlets")
      .update({ is_active: !outlet.is_active })
      .eq("id", outlet.id);

    if (error) {
      toast.error("Failed to update outlet status");
    } else {
      toast.success(`Outlet ${outlet.is_active ? "deactivated" : "activated"}`);
      fetchOutlets();
    }
  };

  const activeCount = outlets.filter(o => o.is_active).length;
  const inactiveCount = outlets.filter(o => !o.is_active).length;

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
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Outlet Management</h1>
              <p className="text-muted-foreground">Manage store locations and outlets</p>
            </div>
          </div>
          <Button onClick={openCreateDialog} size="lg" className="gradient-primary text-primary-foreground h-12 px-6">
            <Plus className="h-5 w-5 mr-2" />
            Add Outlet
          </Button>
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
                    <p className="text-muted-foreground text-sm font-medium">Total Outlets</p>
                    <p className="text-4xl font-bold text-foreground mt-1">{outlets.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Store className="h-6 w-6 text-primary" />
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
                    <p className="text-muted-foreground text-sm font-medium">Active</p>
                    <p className="text-4xl font-bold text-success mt-1">{activeCount}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Inactive</p>
                    <p className="text-4xl font-bold text-muted-foreground mt-1">{inactiveCount}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Outlets Grid */}
        <motion.div variants={staggerItem} className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : outlets.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Store className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No outlets found</p>
              <p className="text-sm">Create your first outlet to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {outlets.map((outlet) => (
                <Card 
                  key={outlet.id} 
                  className={`bg-card/80 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden ${!outlet.is_active && "opacity-60"}`}
                >
                  <CardContent className="p-0">
                    <div className={`h-16 ${outlet.is_active ? "gradient-primary" : "bg-muted"} relative`}>
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute top-2 right-2">
                        <Badge variant={outlet.is_active ? "default" : "secondary"} className="text-xs">
                          {outlet.code}
                        </Badge>
                      </div>
                      <div className="absolute -bottom-6 left-4">
                        <div className={`h-12 w-12 rounded-xl ${outlet.is_active ? "bg-primary" : "bg-muted"} flex items-center justify-center shadow-lg border-4 border-card`}>
                          <Store className="h-6 w-6 text-primary-foreground" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-10 pb-5 px-4 space-y-3">
                      <h3 className="text-lg font-semibold text-foreground truncate">{outlet.name}</h3>
                      
                      {outlet.address && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{outlet.address}</span>
                        </div>
                      )}

                      {outlet.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{outlet.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={outlet.is_active}
                            onCheckedChange={() => toggleActive(outlet)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {outlet.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(outlet)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader className="text-center pb-4">
              <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
                <Store className="h-8 w-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-2xl">
                {editingOutlet ? "Edit Outlet" : "Create New Outlet"}
              </DialogTitle>
              <DialogDescription>
                {editingOutlet ? "Update the outlet details below" : "Fill in the details to create a new outlet"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Main Store"
                    className="h-12 bg-muted/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MAIN"
                    maxLength={10}
                    className="h-12 bg-muted/50 border-border/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street, City"
                  className="h-12 bg-muted/50 border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-12 bg-muted/50 border-border/50"
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1 h-12">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-12 gradient-primary text-primary-foreground">
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                ) : editingOutlet ? (
                  "Update Outlet"
                ) : (
                  "Create Outlet"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
