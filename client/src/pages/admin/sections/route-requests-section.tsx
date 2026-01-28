import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  User,
  MapPin,
  FileQuestion,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Bus,
  ArrowRight,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RouteRequest {
  id: string;
  routeRunId: string;
  routeId: string | null;
  driverId: string;
  requestType: "MISSING_STUDENT" | "UNEXPECTED_STUDENT" | "WRONG_STOP" | "ROSTER_CLARIFICATION";
  status: "OPEN" | "APPROVED" | "DENIED" | "RESOLVED";
  studentId: string | null;
  description: string;
  priority: boolean;
  adminNotes: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  driver?: { name: string };
  student?: { name: string };
  route?: { name: string };
}

const requestTypeLabels: Record<string, { label: string; icon: typeof User; color: string }> = {
  MISSING_STUDENT: { label: "Missing Student", icon: User, color: "text-red-600" },
  UNEXPECTED_STUDENT: { label: "Unexpected Student", icon: User, color: "text-orange-600" },
  WRONG_STOP: { label: "Wrong Stop", icon: MapPin, color: "text-blue-600" },
  ROSTER_CLARIFICATION: { label: "Roster Clarification", icon: FileQuestion, color: "text-purple-600" },
};

const statusColors: Record<string, string> = {
  OPEN: "bg-amber-500",
  APPROVED: "bg-green-500",
  DENIED: "bg-red-500",
  RESOLVED: "bg-gray-500",
};

import { StopChangeRequestsSection } from "./stop-change-requests-section";

function DriverRouteRequests() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [selectedRequest, setSelectedRequest] = useState<RouteRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionType, setActionType] = useState<"APPROVED" | "DENIED" | "RESOLVED" | null>(null);

  const queryParams = statusFilter && statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
  const { data: requests, isLoading, error } = useQuery<RouteRequest[]>({
    queryKey: [`/api/admin/route-requests${queryParams}`],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/admin/route-requests/${id}`, { status, adminNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith('/api/admin/route-requests')
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges/activity-operations"] });
      toast({
        title: "Request Updated",
        description: `Route request has been ${actionType?.toLowerCase() || "updated"}.`,
      });
      setSelectedRequest(null);
      setAdminNotes("");
      setActionType(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update request",
        variant: "destructive",
      });
    },
  });

  const handleAction = (request: RouteRequest, action: "APPROVED" | "DENIED" | "RESOLVED") => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes(request.adminNotes || "");
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionType) return;
    updateStatusMutation.mutate({
      id: selectedRequest.id,
      status: actionType,
      notes: adminNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load route requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openCount = requests?.filter((r) => r.status === "OPEN").length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Route Requests
            {openCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {openCount} Open
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            Issues reported by drivers during active routes
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" data-testid="select-item-all">All Statuses</SelectItem>
            <SelectItem value="OPEN" data-testid="select-item-open">Open</SelectItem>
            <SelectItem value="APPROVED" data-testid="select-item-approved">Approved</SelectItem>
            <SelectItem value="DENIED" data-testid="select-item-denied">Denied</SelectItem>
            <SelectItem value="RESOLVED" data-testid="select-item-resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {requests?.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No route requests found</p>
              <p className="text-sm mt-1">
                {statusFilter === "OPEN" 
                  ? "No open requests require attention" 
                  : "Try changing the status filter"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests?.map((request) => {
            const typeConfig = requestTypeLabels[request.requestType];
            const TypeIcon = typeConfig?.icon || AlertTriangle;
            
            return (
              <Card key={request.id} data-testid={`request-card-${request.id}`}>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TypeIcon className={`h-4 w-4 ${typeConfig?.color || ""}`} />
                        <span className="font-medium">{typeConfig?.label || request.requestType}</span>
                        <Badge className={statusColors[request.status]} variant="secondary">
                          {request.status}
                        </Badge>
                        {request.priority && (
                          <Badge variant="destructive">Priority</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><span className="font-medium">Driver:</span> {request.driver?.name || "Unknown"}</p>
                        {request.student?.name && (
                          <p><span className="font-medium">Student:</span> {request.student.name}</p>
                        )}
                        {request.route?.name && (
                          <p><span className="font-medium">Route:</span> {request.route.name}</p>
                        )}
                      </div>
                      
                      <p className="text-sm">{request.description}</p>
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        {request.resolvedAt && (
                          <span className="ml-2">
                            · Resolved {format(new Date(request.resolvedAt), "MMM d, h:mm a")}
                          </span>
                        )}
                      </div>
                      
                      {request.adminNotes && (
                        <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                          <span className="font-medium">Admin Notes:</span> {request.adminNotes}
                        </div>
                      )}
                    </div>
                    
                    {request.status === "OPEN" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(request, "APPROVED")}
                          data-testid={`button-approve-${request.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(request, "DENIED")}
                          data-testid={`button-deny-${request.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAction(request, "RESOLVED")}
                          data-testid={`button-resolve-${request.id}`}
                        >
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent data-testid="dialog-action-confirm">
          <DialogHeader>
            <DialogTitle>
              {actionType === "APPROVED" && "Approve Request"}
              {actionType === "DENIED" && "Deny Request"}
              {actionType === "RESOLVED" && "Resolve Request"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "APPROVED" && "Confirm the driver's reported issue is valid."}
              {actionType === "DENIED" && "Mark this request as not valid or already handled."}
              {actionType === "RESOLVED" && "Mark this request as resolved."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedRequest && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium">{requestTypeLabels[selectedRequest.requestType]?.label}</p>
                <p className="mt-1">{selectedRequest.description}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Notes (optional)</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this resolution..."
                rows={3}
                data-testid="textarea-admin-notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={updateStatusMutation.isPending}
              variant={actionType === "DENIED" ? "destructive" : "default"}
              data-testid="button-confirm-action"
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${actionType}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RouteRequestsSection() {
  const { data: stopChangeCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/stop-change-requests/count"],
  });

  const pendingStopChanges = stopChangeCount?.count || 0;

  return (
    <Tabs defaultValue="driver-requests" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="driver-requests" className="flex items-center gap-2" data-testid="tab-driver-requests">
          <Bus className="w-4 h-4" />
          Driver Requests
        </TabsTrigger>
        <TabsTrigger value="stop-changes" className="flex items-center gap-2" data-testid="tab-stop-changes">
          <MapPin className="w-4 h-4" />
          Stop Changes
          {pendingStopChanges > 0 && (
            <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
              {pendingStopChanges}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="driver-requests" className="mt-4">
        <DriverRouteRequests />
      </TabsContent>
      <TabsContent value="stop-changes" className="mt-4">
        <StopChangeRequestsSection />
      </TabsContent>
    </Tabs>
  );
}
