import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Bus,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  User,
  UserCheck,
  UserMinus,
  UserX,
  Pencil,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";

interface RouteRunSummaryProps {
  routeRunId: string;
  onFinalize?: () => void;
  onBack?: () => void;
  isAdmin?: boolean;
  canEditAttendance?: boolean;
}

interface SummaryData {
  routeRun: {
    id: string;
    routeId: string;
    serviceDate: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    startMileage: number | null;
    endMileage: number | null;
  };
  route: {
    id: string;
    name: string;
    shiftType: string | null;
  };
  participants: Array<{
    id: string;
    userId: string;
    role: string;
    firstName: string;
    lastName: string;
  }>;
  stops: {
    total: number;
    completed: number;
  };
  attendance: {
    total: number;
    rode: number;
    absentPremarked: number;
    pending: number;
  };
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    attendance: string;
    pickupStopId: string | null;
    pickupTime: string | null;
    dropoffStopId: string | null;
    dropoffTime: string | null;
    lastModifiedBy: string | null;
    lastModifiedAt: string | null;
  }>;
  mileage: {
    start: number | null;
    end: number | null;
  };
  duration: {
    startedAt: string | null;
    endedAt: string | null;
    minutes: number | null;
  };
  attendanceLogs: Array<{
    id: string;
    studentId: string;
    actorUserId: string;
    oldValueJson: { status: string };
    newValueJson: { status: string };
    reason: string | null;
    createdAt: string;
  }>;
}

export default function RouteRunSummary({
  routeRunId,
  onFinalize,
  onBack,
  isAdmin = false,
  canEditAttendance = true,
}: RouteRunSummaryProps) {
  const { toast } = useToast();
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    currentStatus: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [showMileageDialog, setShowMileageDialog] = useState(false);
  const [startMileage, setStartMileage] = useState("");
  const [endMileage, setEndMileage] = useState("");
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  const { data: summary, isLoading, error } = useQuery<SummaryData>({
    queryKey: ["/api/route-runs", routeRunId, "summary"],
  });

  const correctAttendanceMutation = useMutation({
    mutationFn: async (data: {
      studentId: string;
      newStatus: string;
      reason: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/route-runs/${routeRunId}/correct-attendance`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Attendance corrected successfully" });
      queryClient.invalidateQueries({
        queryKey: ["/api/route-runs", routeRunId, "summary"],
      });
      setShowCorrectionDialog(false);
      setSelectedStudent(null);
      setNewStatus("");
      setCorrectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to correct attendance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMileageMutation = useMutation({
    mutationFn: async (data: {
      startMileage?: number;
      endMileage?: number;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/route-runs/${routeRunId}/mileage`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mileage updated successfully" });
      queryClient.invalidateQueries({
        queryKey: ["/api/route-runs", routeRunId, "summary"],
      });
      setShowMileageDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update mileage",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/route-runs/${routeRunId}/finalize`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Route finalized successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/route-runs"] });
      onFinalize?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to finalize route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/route-runs/${routeRunId}/reopen`,
        { reason: "Admin reopened for corrections" }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Route reopened for corrections" });
      queryClient.invalidateQueries({
        queryKey: ["/api/route-runs", routeRunId, "summary"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reopen route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCorrectAttendance = (student: {
    id: string;
    firstName: string;
    lastName: string;
    attendance: string;
  }) => {
    setSelectedStudent({
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      currentStatus: student.attendance,
    });
    setNewStatus(student.attendance);
    setCorrectionReason("");
    setShowCorrectionDialog(true);
  };

  const submitCorrection = () => {
    if (!selectedStudent || !newStatus) return;
    if (newStatus === selectedStudent.currentStatus) {
      toast({ title: "No change made", description: "Select a different status" });
      return;
    }
    correctAttendanceMutation.mutate({
      studentId: selectedStudent.id,
      newStatus,
      reason: correctionReason,
    });
  };

  const openMileageDialog = () => {
    setStartMileage(summary?.mileage?.start?.toString() || "");
    setEndMileage(summary?.mileage?.end?.toString() || "");
    setShowMileageDialog(true);
  };

  const submitMileage = () => {
    const updates: { startMileage?: number; endMileage?: number } = {};
    if (startMileage) updates.startMileage = parseFloat(startMileage);
    if (endMileage) updates.endMileage = parseFloat(endMileage);
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    updateMileageMutation.mutate(updates);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "riding":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
            <UserCheck className="h-3 w-3 mr-1" />
            Rode
          </Badge>
        );
      case "absent":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
            <UserMinus className="h-3 w-3 mr-1" />
            Absent
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
            <UserX className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load route summary. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const isFinalized = summary.routeRun.status === "FINALIZED";
  const isPendingReview = summary.routeRun.status === "ENDED_PENDING_REVIEW";
  const totalMiles = 
    summary.mileage.end && summary.mileage.start
      ? (summary.mileage.end - summary.mileage.start).toFixed(1)
      : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-route-name">
                {summary.route.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {format(new Date(summary.routeRun.serviceDate), "EEEE, MMMM d, yyyy")}
                {summary.route.shiftType && ` • ${summary.route.shiftType}`}
              </p>
            </div>
            <Badge
              variant={isFinalized ? "secondary" : "outline"}
              className={
                isFinalized
                  ? "bg-blue-500/10 text-blue-600 border-blue-200"
                  : "bg-amber-500/10 text-amber-600 border-amber-200"
              }
              data-testid="badge-status"
            >
              {isFinalized ? "Finalized" : "Pending Review"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  Duration
                </div>
                <p className="text-lg font-semibold" data-testid="text-duration">
                  {summary.duration.minutes
                    ? `${Math.floor(summary.duration.minutes / 60)}h ${summary.duration.minutes % 60}m`
                    : "--"}
                </p>
                {summary.duration.startedAt && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(summary.duration.startedAt), "h:mm a")}
                    {summary.duration.endedAt && (
                      <> - {format(new Date(summary.duration.endedAt), "h:mm a")}</>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={openMileageDialog}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Gauge className="h-4 w-4" />
                    Mileage
                  </div>
                  {canEditAttendance && (
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <p className="text-lg font-semibold" data-testid="text-mileage">
                  {totalMiles ? `${totalMiles} mi` : "--"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.mileage.start ?? "—"} → {summary.mileage.end ?? "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Stops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 rounded-full h-2 transition-all"
                    style={{
                      width: `${(summary.stops.completed / Math.max(summary.stops.total, 1)) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium" data-testid="text-stops">
                  {summary.stops.completed} / {summary.stops.total}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Attendance Summary
                </CardTitle>
                {summary.attendanceLogs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistoryDialog(true)}
                    data-testid="button-view-history"
                  >
                    <History className="h-4 w-4 mr-1" />
                    History ({summary.attendanceLogs.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Rode: {summary.attendance.rode}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Absent: {summary.attendance.absentPremarked}</span>
                </div>
                {summary.attendance.pending > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span>Pending: {summary.attendance.pending}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Students ({summary.students.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-64">
                <div className="divide-y">
                  {summary.students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 hover-elevate"
                      data-testid={`row-student-${student.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {student.firstName} {student.lastName}
                        </p>
                        {student.pickupTime && (
                          <p className="text-xs text-muted-foreground">
                            Picked up: {format(new Date(student.pickupTime), "h:mm a")}
                          </p>
                        )}
                        {student.dropoffTime && (
                          <p className="text-xs text-muted-foreground">
                            Dropped off: {format(new Date(student.dropoffTime), "h:mm a")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(student.attendance)}
                        {canEditAttendance && (isPendingReview || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCorrectAttendance(student)}
                            data-testid={`button-edit-${student.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {summary.participants.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bus className="h-4 w-4" />
                  Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {summary.participants.map((p) => (
                    <Badge key={p.id} variant="outline">
                      {p.firstName} {p.lastName}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({p.role.toLowerCase()})
                      </span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="p-4 border-t bg-background space-y-2">
        {isFinalized && isAdmin && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            data-testid="button-reopen"
          >
            {reopenMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reopen for Corrections
          </Button>
        )}
        
        {isPendingReview && (
          <Button
            className="w-full"
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending}
            data-testid="button-finalize"
          >
            {finalizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Confirm & Finalize
          </Button>
        )}

        {onBack && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={onBack}
            data-testid="button-back"
          >
            Back
          </Button>
        )}
      </div>

      <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Attendance</DialogTitle>
            <DialogDescription>
              Update attendance status for {selectedStudent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <div>{getStatusBadge(selectedStudent?.currentStatus || "PENDING")}</div>
            </div>
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="riding">Rode</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why are you making this correction?"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                data-testid="input-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCorrectionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCorrection}
              disabled={correctAttendanceMutation.isPending || !newStatus}
              data-testid="button-submit-correction"
            >
              {correctAttendanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMileageDialog} onOpenChange={setShowMileageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Mileage</DialogTitle>
            <DialogDescription>
              Enter the odometer readings for this route
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start Mileage</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g., 45123.4"
                value={startMileage}
                onChange={(e) => setStartMileage(e.target.value)}
                data-testid="input-start-mileage"
              />
            </div>
            <div className="space-y-2">
              <Label>End Mileage</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g., 45145.7"
                value={endMileage}
                onChange={(e) => setEndMileage(e.target.value)}
                data-testid="input-end-mileage"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMileageDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitMileage}
              disabled={updateMileageMutation.isPending}
              data-testid="button-submit-mileage"
            >
              {updateMileageMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Mileage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attendance Change History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-3">
              {summary.attendanceLogs.map((log) => {
                const student = summary.students.find((s) => s.id === log.studentId);
                return (
                  <div key={log.id} className="border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">
                        {student
                          ? `${student.firstName} ${student.lastName}`
                          : "Unknown Student"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), "h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {log.oldValueJson?.status || "—"}
                      </Badge>
                      →
                      <Badge variant="outline" className="text-xs">
                        {log.newValueJson?.status || "—"}
                      </Badge>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{log.reason}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
