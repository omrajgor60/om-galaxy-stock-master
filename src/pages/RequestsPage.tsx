import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Calendar, MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";

export default function RequestsPage() {
  const { user, isAdmin } = useAuth();
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
    if (!user) return;
    const { error } = await supabase.from("time_off_requests").insert({ ...newTimeOff, user_id: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Request submitted!"); setShowTimeOffDialog(false); fetchData(); setNewTimeOff({ start_date: "", end_date: "", reason: "" }); }
  };

  const submitIssue = async () => {
    if (!user) return;
    const { error } = await supabase.from("issue_reports").insert({ ...newIssue, user_id: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Issue reported!"); setShowIssueDialog(false); fetchData(); setNewIssue({ category: "general", title: "", description: "" }); }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = { pending: "outline", approved: "default", rejected: "destructive", seen: "secondary", new: "outline", in_progress: "secondary", resolved: "default" };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isAdmin ? "Requests" : "My Requests"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTimeOffDialog(true)}><Calendar className="h-4 w-4 mr-2" />Time Off</Button>
          <Button variant="outline" onClick={() => setShowIssueDialog(true)}><MessageSquare className="h-4 w-4 mr-2" />Report Issue</Button>
        </div>
      </div>

      <Tabs defaultValue="timeoff">
        <TabsList><TabsTrigger value="timeoff">Time Off</TabsTrigger><TabsTrigger value="issues">Issues</TabsTrigger></TabsList>
        <TabsContent value="timeoff" className="space-y-4">
          {timeOffRequests.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{req.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(req.start_date), "MMM d")} - {format(new Date(req.end_date), "MMM d, yyyy")}</p>
                  <p className="text-sm">{req.reason}</p>
                </div>
                {getStatusBadge(req.status)}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="issues" className="space-y-4">
          {issueReports.map((issue) => (
            <Card key={issue.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-sm text-muted-foreground">{issue.profiles?.full_name} • {issue.category}</p>
                </div>
                {getStatusBadge(issue.status)}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={showTimeOffDialog} onOpenChange={setShowTimeOffDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Time Off</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" value={newTimeOff.start_date} onChange={(e) => setNewTimeOff({...newTimeOff, start_date: e.target.value})} /></div>
              <div><Label>End Date</Label><Input type="date" value={newTimeOff.end_date} onChange={(e) => setNewTimeOff({...newTimeOff, end_date: e.target.value})} /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={newTimeOff.reason} onChange={(e) => setNewTimeOff({...newTimeOff, reason: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={submitTimeOff}>Submit Request</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Issue</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Category</Label>
              <Select value={newIssue.category} onValueChange={(v) => setNewIssue({...newIssue, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="product">Product</SelectItem><SelectItem value="technical">Technical</SelectItem><SelectItem value="general">General</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Title</Label><Input value={newIssue.title} onChange={(e) => setNewIssue({...newIssue, title: e.target.value})} /></div>
            <div><Label>Description</Label><Textarea value={newIssue.description} onChange={(e) => setNewIssue({...newIssue, description: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={submitIssue}>Submit Report</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
