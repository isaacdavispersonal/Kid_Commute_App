import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  Calendar,
  ArrowRight,
  MessageSquare
} from "lucide-react";

interface StopChangeRequest {
  id: string;
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  requestType: "pickup" | "dropoff";
  currentStopId: string | null;
  currentStopName: string;
  requestedStopId: string;
  requestedStopName: string;
  effectiveDate: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  requestedByUserId: string;
  requestedByName: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function StopChangeRequestsSection() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<StopChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: requests, isLoading } = useQuery<StopChangeRequest[]>({
    queryKey: ["/api/admin/stop-change-requests"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "denied" }) => {
      return await apiRequest("PATCH", `/api/admin/stop-change-requests/${id}`, {
        status,
        reviewNotes: reviewNotes || null,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stop-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stop-change-requests/pending"] });
      setSelectedRequest(null);
      setReviewNotes("");
      toast({
        title: variables.status === "approved" ? "Request Approved" : "Request Denied",
        description: variables.status === "approved" 
          ? "The stop change has been applied" 
          : "The stop change request has been denied",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      });
    },
  });

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const reviewedRequests = requests?.filter((r) => r.status !== "pending") || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "denied":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Denied</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Pending Requests</h3>
        <p className="text-sm text-muted-foreground">
          Stop change requests awaiting your approval
        </p>
      </div>

      {pendingRequests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>No pending stop change requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <Card key={request.id} className="hover-elevate" data-testid={`card-request-${request.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {request.studentName}
                    </CardTitle>
                    <CardDescription>
                      {request.routeName} - {request.requestType === "pickup" ? "Pickup" : "Dropoff"} Stop
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{request.currentStopName}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="font-medium">{request.requestedStopName}</span>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Effective: {formatDate(request.effectiveDate)}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Requested by: {request.requestedByName}
                  </div>
                </div>

                {request.reason && (
                  <div className="flex items-start gap-2 text-sm bg-muted/50 p-3 rounded-md">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{request.reason}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setSelectedRequest(request)}
                    data-testid={`button-review-${request.id}`}
                  >
                    Review Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reviewedRequests.length > 0 && (
        <>
          <div className="pt-6">
            <h3 className="text-lg font-semibold">Recent History</h3>
            <p className="text-sm text-muted-foreground">
              Previously reviewed requests
            </p>
          </div>

          <div className="space-y-3">
            {reviewedRequests.slice(0, 10).map((request) => (
              <Card key={request.id} className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{request.studentName}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {request.currentStopName} → {request.requestedStopName}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(request.createdAt)} • {request.requestedByName}
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Stop Change Request</DialogTitle>
            <DialogDescription>
              Approve or deny this stop change request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Student:</span>
                  <p className="font-medium">{selectedRequest.studentName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Route:</span>
                  <p className="font-medium">{selectedRequest.routeName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Change Type:</span>
                  <p className="font-medium capitalize">{selectedRequest.requestType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Date:</span>
                  <p className="font-medium">{formatDate(selectedRequest.effectiveDate)}</p>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedRequest.currentStopName}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedRequest.requestedStopName}</span>
                </div>
              </div>

              {selectedRequest.reason && (
                <div className="p-3 bg-accent/50 rounded-md text-sm">
                  <span className="font-medium">Reason: </span>
                  {selectedRequest.reason}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Review Notes (Optional)</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  data-testid="input-review-notes"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(null);
                    setReviewNotes("");
                  }}
                  data-testid="button-cancel-review"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => reviewMutation.mutate({ id: selectedRequest.id, status: "denied" })}
                  disabled={reviewMutation.isPending}
                  data-testid="button-deny-request"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny
                </Button>
                <Button
                  variant="default"
                  onClick={() => reviewMutation.mutate({ id: selectedRequest.id, status: "approved" })}
                  disabled={reviewMutation.isPending}
                  data-testid="button-approve-request"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
