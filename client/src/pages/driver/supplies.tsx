import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Clock } from "lucide-react";
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

interface SuppliesRequest {
  id: string;
  driverId: string;
  itemName: string;
  quantity: number;
  urgency: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "ORDERED" | "DELIVERED" | "REJECTED";
  adminNotes: string | null;
  createdAt: string;
}

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  APPROVED: { label: "Approved", variant: "default" },
  ORDERED: { label: "Ordered", variant: "default" },
  DELIVERED: { label: "Delivered", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

const URGENCY_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  LOW: { label: "Low", variant: "outline" },
  MEDIUM: { label: "Medium", variant: "secondary" },
  HIGH: { label: "High", variant: "destructive" },
};

export default function DriverSupplies() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [urgency, setUrgency] = useState("MEDIUM");
  const [reason, setReason] = useState("");

  const { data: requests, isLoading } = useQuery<SuppliesRequest[]>({
    queryKey: ["/api/driver/supplies-requests"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/supplies-request", {
        itemName,
        quantity: parseInt(quantity),
        urgency,
        reason: reason || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/supplies-requests"] });
      toast({
        title: "Request Submitted",
        description: "Your supplies request has been submitted to admin",
      });
      setShowDialog(false);
      setItemName("");
      setQuantity("1");
      setUrgency("MEDIUM");
      setReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!itemName || !quantity || parseInt(quantity) < 1) {
      toast({
        title: "Validation Error",
        description: "Please provide item name and valid quantity",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  const pendingCount = requests?.filter(r => r.status === "PENDING").length || 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" data-testid="icon-supplies" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-supplies">Supplies Request</h1>
            <p className="text-muted-foreground">Request supplies needed for your routes</p>
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-new-request">
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6">
          <Badge variant="secondary" data-testid="badge-pending-count">
            <Clock className="h-3 w-3 mr-1" />
            {pendingCount} Pending Request{pendingCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : requests && requests.length > 0 ? (
          requests.map((request) => (
            <Card key={request.id} data-testid={`request-${request.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{request.itemName}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={URGENCY_BADGES[request.urgency].variant}>
                    {URGENCY_BADGES[request.urgency].label}
                  </Badge>
                  <Badge variant={STATUS_BADGES[request.status].variant}>
                    {STATUS_BADGES[request.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium">{request.quantity}</span>
                  </div>
                  {request.reason && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason: </span>
                      <span>{request.reason}</span>
                    </div>
                  )}
                  {request.adminNotes && (
                    <div className="text-sm p-2 bg-muted rounded-md">
                      <span className="font-medium">Admin Notes: </span>
                      <span className="text-muted-foreground">{request.adminNotes}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDistance(new Date(request.createdAt), new Date(), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Requests Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Submit your first supplies request to get started
              </p>
              <Button onClick={() => setShowDialog(true)} data-testid="button-first-request">
                <Plus className="h-4 w-4 mr-2" />
                Create Request
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="dialog-new-request">
          <DialogHeader>
            <DialogTitle>New Supplies Request</DialogTitle>
            <DialogDescription>
              Submit a request for supplies needed for your routes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name *</Label>
              <Input
                id="itemName"
                placeholder="e.g., First Aid Kit, Cleaning Supplies"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                data-testid="input-item-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency *</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger data-testid="select-urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this item is needed..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                data-testid="textarea-reason"
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
              data-testid="button-submit-request"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
