import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, CheckCircle2 } from "lucide-react";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Feedback {
  id: string;
  driverId: string;
  category: "UI_ISSUE" | "FEATURE_REQUEST" | "BUG_REPORT" | "GENERAL";
  subject: string;
  description: string;
  status: "NEW" | "REVIEWING" | "PLANNED" | "COMPLETED" | "DISMISSED";
  adminResponse: string | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  UI_ISSUE: "UI Issue",
  FEATURE_REQUEST: "Feature Request",
  BUG_REPORT: "Bug Report",
  GENERAL: "General Feedback",
};

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NEW: { label: "New", variant: "secondary" },
  REVIEWING: { label: "Reviewing", variant: "default" },
  PLANNED: { label: "Planned", variant: "default" },
  COMPLETED: { label: "Completed", variant: "outline" },
  DISMISSED: { label: "Dismissed", variant: "destructive" },
};

export default function DriverFeedback() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [category, setCategory] = useState("GENERAL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/driver/feedback"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/feedback", {
        category,
        subject,
        description,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/feedback"] });
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! We'll review it soon.",
      });
      setShowDialog(false);
      setCategory("GENERAL");
      setSubject("");
      setDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!subject || !description) {
      toast({
        title: "Validation Error",
        description: "Please provide both subject and description",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  const pendingCount = feedbackList?.filter(f => f.status === "NEW").length || 0;

  return (
    <PullToRefresh queryKeys={[["/api/driver/feedback"]]}>
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" data-testid="icon-feedback" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-feedback">Feedback & Suggestions</h1>
            <p className="text-muted-foreground">Share your ideas or report issues</p>
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-new-feedback">
          <Plus className="h-4 w-4 mr-2" />
          Send Feedback
        </Button>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6">
          <Badge variant="secondary" data-testid="badge-pending-count">
            {pendingCount} Pending Response{pendingCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : feedbackList && feedbackList.length > 0 ? (
          feedbackList.map((feedback) => (
            <Card key={feedback.id} data-testid={`feedback-${feedback.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{feedback.subject}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {CATEGORY_LABELS[feedback.category]}
                  </Badge>
                  <Badge variant={STATUS_BADGES[feedback.status].variant}>
                    {STATUS_BADGES[feedback.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {feedback.description}
                  </p>
                  
                  {feedback.adminResponse && (
                    <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Admin Response:</span>
                      </div>
                      <p className="text-sm">{feedback.adminResponse}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Submitted {formatDistance(new Date(feedback.createdAt), new Date(), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Feedback Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Share your thoughts to help us improve the system
              </p>
              <Button onClick={() => setShowDialog(true)} data-testid="button-first-feedback">
                <Plus className="h-4 w-4 mr-2" />
                Send Feedback
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="dialog-new-feedback">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Let us know how we can improve the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General Feedback</SelectItem>
                  <SelectItem value="UI_ISSUE">UI Issue</SelectItem>
                  <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                  <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Brief description of your feedback"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about your feedback..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                data-testid="textarea-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}
