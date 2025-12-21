import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserCog, Plus, Mail, Shield } from "lucide-react";

interface Staff {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", password: "", full_name: "", phone: "", role: "staff" });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (profiles && roles) {
      const merged = profiles.map(p => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name, phone: p.phone,
        role: roles.find(r => r.user_id === p.user_id)?.role || "pending"
      }));
      setStaff(merged);
    }
  };

  const createStaff = async () => {
    setIsCreating(true);
    const { data, error } = await supabase.auth.signUp({
      email: newStaff.email, password: newStaff.password,
      options: { data: { full_name: newStaff.full_name, phone: newStaff.phone }, emailRedirectTo: window.location.origin }
    });
    if (error) { toast.error(error.message); setIsCreating(false); return; }
    if (data.user) {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: newStaff.role as any });
      toast.success("Staff account created!");
      setShowAddDialog(false); fetchStaff();
      setNewStaff({ email: "", password: "", full_name: "", phone: "", role: "staff" });
    }
    setIsCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Staff</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <Card key={member.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><UserCog className="h-4 w-4" />{member.full_name}</CardTitle>
                <Badge variant={member.role === "admin" ? "default" : "secondary"} className={member.role === "admin" ? "gradient-primary" : ""}>
                  <Shield className="h-3 w-3 mr-1" />{member.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {member.phone && <p className="text-sm text-muted-foreground">{member.phone}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Email *</Label><Input type="email" value={newStaff.email} onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} /></div>
            <div><Label>Password *</Label><Input type="password" value={newStaff.password} onChange={(e) => setNewStaff({...newStaff, password: e.target.value})} /></div>
            <div><Label>Full Name *</Label><Input value={newStaff.full_name} onChange={(e) => setNewStaff({...newStaff, full_name: e.target.value})} /></div>
            <div><Label>Phone</Label><Input value={newStaff.phone} onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})} /></div>
            <div><Label>Role *</Label>
              <Select value={newStaff.role} onValueChange={(v) => setNewStaff({...newStaff, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={createStaff} disabled={isCreating || !newStaff.email || !newStaff.password || !newStaff.full_name}>{isCreating ? "Creating..." : "Create Account"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
