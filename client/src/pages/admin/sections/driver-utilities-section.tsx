import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, FileCheck, MessageSquare, CheckCircle2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SuppliesRequest {
  id: string;
  driverId: string;
  itemName: string;
  quantity: number;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  reason: string;
  status: "PENDING" | "APPROVED" | "ORDERED" | "DELIVERED" | "REJECTED";
  adminNotes: string | null;
  createdAt: string;
}

interface VehicleChecklist {
  id: string;
  driverId: string;
  vehicleId: string;
  shiftId: string | null;
  checklistType: "PRE_TRIP" | "POST_TRIP";
  tiresOk: boolean;
  lightsOk: boolean;
  brakesOk: boolean;
  fluidLevelsOk: boolean;
  interiorCleanOk: boolean;
  emergencyEquipmentOk: boolean;
  mirrorsOk: boolean;
  seatsOk: boolean;
  odometerReading: number | null;
  fuelLevel: number | null;
  issues: string | null;
  createdAt: string;
}

interface DriverFeedback {
  id: string;
  driverId: string;
  category: "UI_ISSUE" | "FEATURE_REQUEST" | "BUG_REPORT" | "GENERAL";
  subject: string;
  description: string;
  status: "NEW" | "REVIEWING" | "PLANNED" | "COMPLETED" | "DISMISSED";
  adminResponse: string | null;
  createdAt: string;
}

const URGENCY_COLORS: Record<string, string> = {
  LOW: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  MEDIUM: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  HIGH: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  URGENT: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-700",
  APPROVED: "bg-green-500/10 text-green-700",
  ORDERED: "bg-blue-500/10 text-blue-700",
  DELIVERED: "bg-green-500/10 text-green-700",
  REJECTED: "bg-red-500/10 text-red-700",
  NEW: "bg-yellow-500/10 text-yellow-700",
  REVIEWING: "bg-blue-500/10 text-blue-700",
  PLANNED: "bg-purple-500/10 text-purple-700",
  COMPLETED: "bg-green-500/10 text-green-700",
  DISMISSED: "bg-gray-500/10 text-gray-700",
};

export default function DriverUtilitiesSection() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<SuppliesRequest | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<DriverFeedback | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackResponse, setFeedbackResponse] = useState("");

  const { data: suppliesRequests, isLoading: loadingSupplies } = useQuery<SuppliesRequest[]>({
    queryKey: ["/api/admin/supplies-requests"],
  });

  const { data: checklists, isLoading: loadingChecklists } = useQuery<VehicleChecklist[]>({
    queryKey: ["/api/admin/vehicle-checklists"],
  });

  const { data: feedback, isLoading: loadingFeedback } = useQuery<DriverFeedback[]>({
    queryKey: ["/api/admin/feedback"],
  });

  const updateRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) return;
      return await apiRequest("PATCH", `/api/admin/supplies-requests/${selectedRequest.id}`, {
        status: requestStatus,
        adminNotes: requestNotes,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/supplies-requests"] });
      toast({
        title: "Updated",
        description: "Supplies request status updated successfully",
      });
      setShowRequestDialog(false);
      setSelectedRequest(null);
      setRequestStatus("");
      setRequestNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update supplies request",
        variant: "destructive",
      });
    },
  });

  const updateFeedbackMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeedback) return;
      return await apiRequest("PATCH", `/api/admin/feedback/${selectedFeedback.id}`, {
        status: feedbackStatus,
        adminResponse: feedbackResponse,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({
        title: "Updated",
        description: "Feedback status updated successfully",
      });
      setShowFeedbackDialog(false);
      setSelectedFeedback(null);
      setFeedbackStatus("");
      setFeedbackResponse("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feedback",
        variant: "destructive",
      });
    },
  });

  const dismissRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("PATCH", `/api/admin/supplies-requests/${requestId}`, {
        status: "REJECTED",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/supplies-requests"] });
      toast({
        title: "Dismissed",
        description: "Supplies request dismissed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss request",
        variant: "destructive",
      });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      return await apiRequest("DELETE", `/api/admin/vehicle-checklists/${checklistId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicle-checklists"] });
      toast({
        title: "Deleted",
        description: "Checklist deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete checklist",
        variant: "destructive",
      });
    },
  });

  const dismissFeedbackMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      return await apiRequest("PATCH", `/api/admin/feedback/${feedbackId}`, {
        status: "DISMISSED",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({
        title: "Dismissed",
        description: "Feedback dismissed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss feedback",
        variant: "destructive",
      });
    },
  });

  const handleManageRequest = (request: SuppliesRequest) => {
    setSelectedRequest(request);
    setRequestStatus(request.status);
    setRequestNotes(request.adminNotes || "");
    setShowRequestDialog(true);
  };

  const handleManageFeedback = (fb: DriverFeedback) => {
    setSelectedFeedback(fb);
    setFeedbackStatus(fb.status);
    setFeedbackResponse(fb.adminResponse || "");
    setShowFeedbackDialog(true);
  };

  const pendingSupplies = suppliesRequests?.filter(r => r.status === "PENDING").length || 0;
  const newFeedback = feedback?.filter(f => f.status === "NEW").length || 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-driver-utilities">
          Driver Utilities Management
        </h1>
        <p className="text-muted-foreground">
          Review and manage driver supplies requests, vehicle checklists, and feedback
        </p>
      </div>

      <Tabs defaultValue="supplies" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="supplies" className="flex items-center gap-2" data-testid="tab-supplies">
            <Package className="h-4 w-4" />
            Supplies
            {pendingSupplies > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingSupplies}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="checklists" className="flex items-center gap-2" data-testid="tab-checklists">
            <FileCheck className="h-4 w-4" />
            Checklists
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2" data-testid="tab-feedback">
            <MessageSquare className="h-4 w-4" />
            Feedback
            {newFeedback > 0 && (
              <Badge variant="destructive" className="ml-2">{newFeedback}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplies" className="space-y-4">
          {loadingSupplies ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : suppliesRequests && suppliesRequests.length > 0 ? (
            suppliesRequests.map((request) => (
              <Card key={request.id} data-testid={`request-${request.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{request.itemName}</CardTitle>
                      <p className="text-sm text-muted-foreground">Quantity: {request.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={URGENCY_COLORS[request.urgency]}>
                      {request.urgency}
                    </Badge>
                    <Badge className={STATUS_COLORS[request.status]}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3">{request.reason}</p>
                  {request.adminNotes && (
                    <div className="p-3 bg-muted rounded-md mb-3">
                      <p className="text-sm font-medium mb-1">Admin Notes:</p>
                      <p className="text-sm">{request.adminNotes}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {formatDistance(new Date(request.createdAt), new Date(), { addSuffix: true })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dismissRequestMutation.mutate(request.id)}
                        disabled={dismissRequestMutation.isPending}
                        data-testid={`button-dismiss-${request.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageRequest(request)}
                        data-testid={`button-manage-${request.id}`}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No supplies requests yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checklists" className="space-y-4">
          {loadingChecklists ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : checklists && checklists.length > 0 ? (
            checklists.map((checklist) => (
              <Card key={checklist.id} data-testid={`checklist-${checklist.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">
                          {checklist.checklistType === "PRE_TRIP" ? "Pre-Trip" : "Post-Trip"} Inspection
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Vehicle ID: {checklist.vehicleId}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistance(new Date(checklist.createdAt), new Date(), { addSuffix: true })}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${checklist.tiresOk ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Tires</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${checklist.lightsOk ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Lights</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${checklist.brakesOk ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Brakes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${checklist.fluidLevelsOk ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Fluids</span>
                    </div>
                  </div>
                  {checklist.issues && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm font-medium mb-1">Issues Reported:</p>
                      <p className="text-sm">{checklist.issues}</p>
                    </div>
                  )}
                  {checklist.odometerReading && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Odometer: {checklist.odometerReading.toLocaleString()} miles
                    </p>
                  )}
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteChecklistMutation.mutate(checklist.id)}
                      disabled={deleteChecklistMutation.isPending}
                      data-testid={`button-delete-checklist-${checklist.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No vehicle checklists yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          {loadingFeedback ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : feedback && feedback.length > 0 ? (
            feedback.map((fb) => (
              <Card key={fb.id} data-testid={`feedback-${fb.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{fb.subject}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{fb.category.replace('_', ' ')}</Badge>
                    <Badge className={STATUS_COLORS[fb.status]}>{fb.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3">{fb.description}</p>
                  {fb.adminResponse && (
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-md mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Your Response:</span>
                      </div>
                      <p className="text-sm">{fb.adminResponse}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {formatDistance(new Date(fb.createdAt), new Date(), { addSuffix: true })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dismissFeedbackMutation.mutate(fb.id)}
                        disabled={dismissFeedbackMutation.isPending}
                        data-testid={`button-dismiss-feedback-${fb.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageFeedback(fb)}
                        data-testid={`button-manage-feedback-${fb.id}`}
                      >
                        Respond
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No driver feedback yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Supplies Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent data-testid="dialog-manage-request">
          <DialogHeader>
            <DialogTitle>Manage Supplies Request</DialogTitle>
            <DialogDescription>
              Update the status and add admin notes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={requestStatus} onValueChange={setRequestStatus}>
                <SelectTrigger data-testid="select-request-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="ORDERED">Ordered</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Add notes about this request..."
                rows={4}
                data-testid="textarea-request-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)} data-testid="button-cancel-request">
              Cancel
            </Button>
            <Button
              onClick={() => updateRequestMutation.mutate()}
              disabled={updateRequestMutation.isPending}
              data-testid="button-save-request"
            >
              {updateRequestMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent data-testid="dialog-manage-feedback">
          <DialogHeader>
            <DialogTitle>Respond to Feedback</DialogTitle>
            <DialogDescription>
              Update the status and add your response
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={feedbackStatus} onValueChange={setFeedbackStatus}>
                <SelectTrigger data-testid="select-feedback-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="REVIEWING">Reviewing</SelectItem>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="DISMISSED">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Your Response</Label>
              <Textarea
                value={feedbackResponse}
                onChange={(e) => setFeedbackResponse(e.target.value)}
                placeholder="Respond to this feedback..."
                rows={5}
                data-testid="textarea-feedback-response"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)} data-testid="button-cancel-feedback">
              Cancel
            </Button>
            <Button
              onClick={() => updateFeedbackMutation.mutate()}
              disabled={updateFeedbackMutation.isPending}
              data-testid="button-save-feedback"
            >
              {updateFeedbackMutation.isPending ? "Saving..." : "Save Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
