import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Store, Plus, Pencil, MapPin, Phone, Loader2 } from "lucide-react";

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
  const { user } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("outlets")
      .select("*")
      .order("name");
    
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
      // Update existing outlet
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
      // Create new outlet
      const { error } = await supabase
        .from("outlets")
        .insert({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          created_by: user?.id,
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Outlet Management</h1>
          <p className="text-muted-foreground">Manage store locations and outlets</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Outlet
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outlets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{outlets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Outlets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {outlets.filter((o) => o.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive Outlets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">
              {outlets.filter((o) => !o.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outlets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            All Outlets
          </CardTitle>
          <CardDescription>
            Click on an outlet to edit its details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : outlets.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No outlets found. Create your first outlet to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outlets.map((outlet) => (
                  <TableRow key={outlet.id}>
                    <TableCell className="font-medium">{outlet.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{outlet.code}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {outlet.address ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {outlet.address}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {outlet.phone ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {outlet.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={outlet.is_active}
                        onCheckedChange={() => toggleActive(outlet)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(outlet)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOutlet ? "Edit Outlet" : "Create New Outlet"}
            </DialogTitle>
            <DialogDescription>
              {editingOutlet
                ? "Update the outlet details below"
                : "Fill in the details to create a new outlet"}
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
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="MAIN"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street, City"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
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
  );
}
