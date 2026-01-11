import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  UserCog, Plus, Shield, Phone, Users, Crown, 
  Search, UserPlus, Briefcase, Mail, Lock, User,
  MoreVertical, Edit, Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Staff {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [newStaff, setNewStaff] = useState({ 
    email: "", password: "", full_name: "", phone: "", role: "staff" 
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (profiles && roles) {
      const merged = profiles.map(p => ({
        id: p.id, 
        user_id: p.user_id, 
        full_name: p.full_name, 
        phone: p.phone,
        avatar_url: p.avatar_url,
        role: roles.find(r => r.user_id === p.user_id)?.role || "pending"
      }));
      setStaff(merged);
    }
  };

  const createStaff = async () => {
    setIsCreating(true);
    const { data, error } = await supabase.auth.signUp({
      email: newStaff.email, 
      password: newStaff.password,
      options: { 
        data: { full_name: newStaff.full_name, phone: newStaff.phone }, 
        emailRedirectTo: window.location.origin 
      }
    });
    if (error) { 
      toast.error(error.message); 
      setIsCreating(false); 
      return; 
    }
    if (data.user) {
      await supabase.from("user_roles").insert({ 
        user_id: data.user.id, 
        role: newStaff.role as any 
      });
      toast.success("Staff account created successfully!");
      setShowAddDialog(false); 
      fetchStaff();
      setNewStaff({ email: "", password: "", full_name: "", phone: "", role: "staff" });
    }
    setIsCreating(false);
  };

  // Filter staff based on search and role
  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (member.phone?.includes(searchQuery));
    const matchesRole = filterRole === "all" || member.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const adminCount = staff.filter(s => s.role === "admin").length;
  const staffCount = staff.filter(s => s.role === "staff").length;

  // Generate initials for avatar
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Generate consistent color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      "from-orange-500 to-red-500",
      "from-amber-500 to-orange-600",
      "from-red-500 to-rose-600",
      "from-rose-500 to-pink-600",
      "from-orange-600 to-amber-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="h-full flex flex-col gap-6 p-2">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow-primary">
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground">Manage your staff members and permissions</p>
          </div>
        </div>
        
        <Button 
          onClick={() => setShowAddDialog(true)} 
          size="lg"
          className="gradient-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all h-12 px-6"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Add New Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Team</p>
                <p className="text-4xl font-bold text-foreground mt-1">{staff.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Administrators</p>
                <p className="text-4xl font-bold text-foreground mt-1">{adminCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Crown className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Staff Members</p>
                <p className="text-4xl font-bold text-foreground mt-1">{staffCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-card/80 border-border/50 text-lg"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-48 h-12 bg-card/80 border-border/50">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admins Only</SelectItem>
            <SelectItem value="staff">Staff Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Staff Grid - Optimized for Tablet */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStaff.map((member) => (
            <Card 
              key={member.id} 
              className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300 group overflow-hidden"
            >
              <CardContent className="p-0">
                {/* Card Header with Gradient */}
                <div className={`h-20 bg-gradient-to-r ${getAvatarColor(member.full_name)} relative`}>
                  <div className="absolute inset-0 bg-black/20" />
                  
                  {/* Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Avatar */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                    <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${getAvatarColor(member.full_name)} flex items-center justify-center text-xl font-bold text-white shadow-lg border-4 border-card`}>
                      {getInitials(member.full_name)}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="pt-12 pb-5 px-4 text-center">
                  <h3 className="text-lg font-semibold text-foreground truncate">
                    {member.full_name}
                  </h3>
                  
                  <Badge 
                    variant={member.role === "admin" ? "default" : "secondary"}
                    className={`mt-2 ${member.role === "admin" ? "gradient-primary text-primary-foreground" : ""}`}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Badge>

                  {member.phone && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">{member.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty State */}
          {filteredStaff.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <UserCog className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No team members found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Dialog - Redesigned */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader className="text-center pb-4">
            <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
              <UserPlus className="h-8 w-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-2xl">Add Team Member</DialogTitle>
            <p className="text-muted-foreground">Create a new staff account</p>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Full Name *
              </Label>
              <Input 
                placeholder="Enter full name"
                value={newStaff.full_name} 
                onChange={(e) => setNewStaff({...newStaff, full_name: e.target.value})}
                className="h-12 bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email Address *
              </Label>
              <Input 
                type="email" 
                placeholder="email@example.com"
                value={newStaff.email} 
                onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                className="h-12 bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Password *
              </Label>
              <Input 
                type="password" 
                placeholder="Min 6 characters"
                value={newStaff.password} 
                onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                className="h-12 bg-muted/50 border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Phone
                </Label>
                <Input 
                  placeholder="Optional"
                  value={newStaff.phone} 
                  onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                  className="h-12 bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Role *
                </Label>
                <Select value={newStaff.role} onValueChange={(v) => setNewStaff({...newStaff, role: v})}>
                  <SelectTrigger className="h-12 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Staff
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowAddDialog(false)}
              className="flex-1 h-12"
            >
              Cancel
            </Button>
            <Button 
              onClick={createStaff} 
              disabled={isCreating || !newStaff.email || !newStaff.password || !newStaff.full_name}
              className="flex-1 h-12 gradient-primary text-primary-foreground"
            >
              {isCreating ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
