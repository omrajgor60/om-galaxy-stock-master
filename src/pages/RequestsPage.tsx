import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMode } from "@/contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, MessageSquare, Clock, AlertCircle, CheckCircle, FileText, Send } from "lucide-react";
import { format } from "date-fns";

export default function RequestsPage() {
  const { isAdmin } = useMode();
  const [timeOffRequests, setTimeOffRequests] = useState<any[]>([]);
  const [issueReports, setIssueReports] = useState<any[]>([]);
  const [showTimeOffDialog, setShowTimeOffDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState({ start_date: "", end_date: "", reason: "" });
  const [newIssue, setNewIssue] = useState({ category: "general", title: "", description: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: timeOff } = await supabase.from("time_off_requests").select("*, profiles(full_name)").order("created_at", { ascending: false });
    const { data: issues } = await supabase.from("issue_reports").select("*, profiles(full_name)").order("created_at", { ascending: false });
    if (timeOff) setTimeOffRequests(timeOff);
    if (issues) setIssueReports(issues);
  };

  const submitTimeOff = async () => {
    const { error } = await supabase.from("time_off_requests").insert({ ...newTimeOff, user_id: null });
    if (error) toast.error(error.message);
    else { toast.success("Request submitted!"); setShowTimeOffDialog(false); fetchData(); setNewTimeOff({ start_date: "", end_date: "", reason: "" }); }
  };

  const submitIssue = async () => {
    const { error } = await supabase.from("issue_reports").insert({ ...newIssue, user_id: null });
    if (error) toast.error(error.message);
    else { toast.success("Issue reported!"); setShowIssueDialog(false); fetchData(); setNewIssue({ category: "general", title: "", description: "" }); }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: AlertCircle },
      seen: { variant: "secondary", icon: CheckCircle },
      new: { variant: "outline", icon: Clock },
      in_progress: { variant: "secondary", icon: Clock },
      resolved: { variant: "default", icon: CheckCircle },
    };
    const { variant, icon: Icon } = config[status] || { variant: "outline", icon: Clock };
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const pendingTimeOff = timeOffRequests.filter(r => r.status === "pending").length;
  const pendingIssues = issueReports.filter(r => r.status === "new").length;

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
              <FileText className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">{isAdmin ? "Requests" : "My Requests"}</h1>
              <p className="text-muted-foreground">Manage time off requests and issue reports</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowTimeOffDialog(true)} className="h-12 px-6 border-border/50">
              <Calendar className="h-5 w-5 mr-2" />
              Request Time Off
            </Button>
            <Button variant="outline" onClick={() => setShowIssueDialog(true)} className="h-12 px-6 border-border/50">
              <MessageSquare className="h-5 w-5 mr-2" />
              Report Issue
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-4 gap-4"
        >
          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Time Off</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{timeOffRequests.length}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-warning/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Pending</p>
                    <p className="text-3xl font-bold text-warning mt-1">{pendingTimeOff}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-warning" />
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
                    <p className="text-muted-foreground text-sm font-medium">Issues</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{issueReports.length}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-secondary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="bg-card/80 backdrop-blur border-border/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">New Issues</p>
                    <p className="text-3xl font-bold text-destructive mt-1">{pendingIssues}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={staggerItem} className="flex-1 overflow-auto">
          <Tabs defaultValue="timeoff" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="timeoff" className="gap-2">
                <Calendar className="h-4 w-4" />
                Time Off ({timeOffRequests.length})
              </TabsTrigger>
              <TabsTrigger value="issues" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Issues ({issueReports.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeoff" className="space-y-3">
              {timeOffRequests.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No time off requests yet</p>
                  </CardContent>
                </Card>
              ) : (
                timeOffRequests.map((req) => (
                  <Card key={req.id} className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-all">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{req.profiles?.full_name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(req.start_date), "MMM d")} - {format(new Date(req.end_date), "MMM d, yyyy")}
                          </p>
                          <p className="text-sm">{req.reason}</p>
                        </div>
                      </div>
                      {getStatusBadge(req.status)}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-3">
              {issueReports.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No issues reported yet</p>
                  </CardContent>
                </Card>
              ) : (
                issueReports.map((issue) => (
                  <Card key={issue.id} className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-all">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                          <MessageSquare className="h-6 w-6 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{issue.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {issue.profiles?.full_name || "Unknown"} • {issue.category}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(issue.status)}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Time Off Dialog */}
        <Dialog open={showTimeOffDialog} onOpenChange={setShowTimeOffDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader className="text-center pb-4">
              <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
                <Calendar className="h-8 w-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-2xl">Request Time Off</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={newTimeOff.start_date} onChange={(e) => setNewTimeOff({...newTimeOff, start_date: e.target.value})} className="h-12 bg-muted/50 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={newTimeOff.end_date} onChange={(e) => setNewTimeOff({...newTimeOff, end_date: e.target.value})} className="h-12 bg-muted/50 border-border/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={newTimeOff.reason} onChange={(e) => setNewTimeOff({...newTimeOff, reason: e.target.value})} placeholder="Enter reason for time off..." className="bg-muted/50 border-border/50" />
              </div>
            </div>
            <DialogFooter className="gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowTimeOffDialog(false)} className="flex-1 h-12">Cancel</Button>
              <Button onClick={submitTimeOff} className="flex-1 h-12 gradient-primary text-primary-foreground">
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Issue Dialog */}
        <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader className="text-center pb-4">
              <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
                <MessageSquare className="h-8 w-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-2xl">Report Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newIssue.category} onValueChange={(v) => setNewIssue({...newIssue, category: v})}>
                  <SelectTrigger className="h-12 bg-muted/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newIssue.title} onChange={(e) => setNewIssue({...newIssue, title: e.target.value})} placeholder="Brief description..." className="h-12 bg-muted/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newIssue.description} onChange={(e) => setNewIssue({...newIssue, description: e.target.value})} placeholder="Detailed description of the issue..." className="bg-muted/50 border-border/50" />
              </div>
            </div>
            <DialogFooter className="gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowIssueDialog(false)} className="flex-1 h-12">Cancel</Button>
              <Button onClick={submitIssue} className="flex-1 h-12 gradient-primary text-primary-foreground">
                <Send className="h-4 w-4 mr-2" />
                Submit Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
