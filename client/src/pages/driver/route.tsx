import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  Bus,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  MapPin,
  User,
  UserCheck,
  UserX,
  ClipboardCheck,
  LogIn,
  LogOut,
  Flag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ShiftRouteContext } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

const POST_TRIP_INSPECTION_ITEMS = [
  { key: 'cameraUnplugged', label: 'Camera Unplugged' },
  { key: 'trashRemoved', label: 'All Trash Removed' },
  { key: 'headlightsPoweredOff', label: 'Headlights Powered Off (if not auto-off)' },
  { key: 'doorsLocked', label: 'Vehicle Doors Locked' },
];

type RideEventDialog = {
  studentId: string;
  studentName: string;
  eventType: "BOARD" | "DEBOARD";
  plannedStopId: string | null;
  plannedStopName: string | null;
} | null;

export default function DriverRoutePage() {
  const params = useParams();
  const shiftId = params.shiftId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Only lead drivers can mark attendance (absent/riding)
  // Regular drivers can only record board/deboard events
  const canMarkAttendance = user?.isLeadDriver === true;

  const { data: routeContext, isLoading } = useQuery<ShiftRouteContext>({
    queryKey: ["/api/driver/route", shiftId],
    enabled: !!shiftId,
  });

  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [rideEventDialog, setRideEventDialog] = useState<RideEventDialog>(null);
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [showPostTripDialog, setShowPostTripDialog] = useState(false);
  const [postTripChecks, setPostTripChecks] = useState<Record<string, boolean>>({});
  const [endingMileage, setEndingMileage] = useState("");
  const [newDamageFound, setNewDamageFound] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [postTripNotes, setPostTripNotes] = useState("");

  const toggleStop = (stopId: string) => {
    const newExpanded = new Set(expandedStops);
    if (newExpanded.has(stopId)) {
      newExpanded.delete(stopId);
    } else {
      newExpanded.add(stopId);
    }
    setExpandedStops(newExpanded);
  };

  // Mutation to mark student attendance
  const attendanceMutation = useMutation({
    mutationFn: async ({
      studentId,
      status,
    }: {
      studentId: string;
      status: "riding" | "absent";
    }) => {
      if (!shiftId || !routeContext) throw new Error("Missing shift context");
      return apiRequest("POST", "/api/attendance", {
        studentId,
        date: routeContext.shift.date,
        status,
        shiftId, // Track AM/PM attendance separately
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route", shiftId] });
      toast({
        title: "Attendance updated",
        description: "Student attendance has been recorded",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to update attendance";
      toast({
        title: "Cannot Update Attendance",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Mutation to record ride event (board/deboard)
  const rideEventMutation = useMutation({
    mutationFn: async ({
      studentId,
      actualStopId,
      eventType,
    }: {
      studentId: string;
      actualStopId: string;
      eventType: "BOARD" | "DEBOARD";
    }) => {
      if (!shiftId) throw new Error("No shift ID");
      return apiRequest("POST", "/api/driver/ride-events", {
        shiftId,
        studentId,
        actualStopId,
        eventType,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route", shiftId] });
      toast({
        title: `Student ${variables.eventType === "BOARD" ? "boarded" : "deboarded"}`,
        description: "Ride event has been recorded",
      });
      setRideEventDialog(null);
      setSelectedStopId("");
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to record ride event";
      toast({
        title: "Cannot Record Ride Event",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Mutation to complete a stop
  const completeStopMutation = useMutation({
    mutationFn: async (routeStopId: string) => {
      if (!shiftId) throw new Error("No shift ID");
      return apiRequest("POST", "/api/driver/route-progress/update-stop", {
        shiftId,
        routeStopId,
        status: "COMPLETED",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route", shiftId] });
      toast({
        title: "Stop completed",
        description: "Moving to next stop",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete stop",
        variant: "destructive",
      });
    },
  });

  // Mutation to finish route with post-trip inspection
  const finishRouteMutation = useMutation({
    mutationFn: async (postTripData: {
      endingMileage: number;
      cameraUnplugged: boolean;
      trashRemoved: boolean;
      newDamageFound: boolean;
      headlightsPoweredOff: boolean;
      doorsLocked: boolean;
      notes?: string;
    }) => {
      if (!shiftId) throw new Error("No shift ID");
      return apiRequest("POST", `/api/driver/shift/${shiftId}/finish-route`, {
        postTripInspection: postTripData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route", shiftId] });
      toast({
        title: "Route completed!",
        description: "Great job! Post-trip inspection saved.",
      });
      setShowPostTripDialog(false);
      setTimeout(() => setLocation("/driver"), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Cannot finish route",
        description: error.message || "Failed to finish route",
        variant: "destructive",
      });
    },
  });

  // Handler for finishing route with post-trip inspection
  const handleFinishRoute = () => {
    setShowPostTripDialog(true);
  };

  const handlePostTripSubmit = () => {
    if (!endingMileage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the ending mileage",
        variant: "destructive",
      });
      return;
    }

    const allItemsChecked = POST_TRIP_INSPECTION_ITEMS.every(item => postTripChecks[item.key] === true);
    if (!allItemsChecked) {
      toast({
        title: "Incomplete Checklist",
        description: "Please complete all post-trip inspection items",
        variant: "destructive",
      });
      return;
    }

    let notes = postTripNotes;
    if (newDamageFound && damageNotes.trim()) {
      notes = `NEW DAMAGE REPORTED: ${damageNotes}${postTripNotes ? `\n\nAdditional notes: ${postTripNotes}` : ''}`;
    }

    finishRouteMutation.mutate({
      endingMileage: parseInt(endingMileage, 10),
      cameraUnplugged: postTripChecks.cameraUnplugged || false,
      trashRemoved: postTripChecks.trashRemoved || false,
      newDamageFound,
      headlightsPoweredOff: postTripChecks.headlightsPoweredOff || false,
      doorsLocked: postTripChecks.doorsLocked || false,
      notes: notes || undefined,
    });
  };

  // Open ride event dialog
  const openRideEventDialog = (
    studentId: string,
    studentName: string,
    eventType: "BOARD" | "DEBOARD",
    plannedStopId: string | null,
    plannedStopName: string | null
  ) => {
    setRideEventDialog({
      studentId,
      studentName,
      eventType,
      plannedStopId,
      plannedStopName,
    });
    // Default to planned stop
    setSelectedStopId(plannedStopId || "");
  };

  // Handle ride event submission
  const handleRideEventSubmit = () => {
    if (!rideEventDialog || !selectedStopId) return;
    
    rideEventMutation.mutate({
      studentId: rideEventDialog.studentId,
      actualStopId: selectedStopId,
      eventType: rideEventDialog.eventType,
    });
  };

  if (isLoading) {
    return <RoutePageSkeleton />;
  }

  if (!routeContext) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Route not found</p>
      </div>
    );
  }

  const { shift, route, vehicle, students, stops, progress } = routeContext;

  // Check if inspection is required but not complete
  const inspectionBlocked = !shift.inspectionComplete;

  // Check if route is completed
  const routeCompleted = !!shift.routeCompletedAt;

  // Calculate if we can finish the route
  const allStopsComplete = progress.completedStops === progress.totalStops && progress.totalStops > 0;
  const allStudentsProcessed = students.every(s => 
    s.attendance === "absent" || s.deboardEvent !== null
  );
  const canFinishRoute = allStopsComplete && allStudentsProcessed && !routeCompleted;

  // Helper to check if stop can be completed
  const canCompleteStop = (stop: ShiftRouteContext["stops"][0]) => {
    // Must have inspection complete
    if (inspectionBlocked) return false;
    
    // Must be the active stop or route completed
    if (progress.activeStopId !== stop.routeStopId && !routeCompleted) return false;
    
    return true;
  };

  return (
    
    <div className="space-y-6 p-4 overflow-x-hidden w-full max-w-full">
      {/* Route Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-xl sm:text-2xl break-words" data-testid="title-route-name">
                {route.name}
              </CardTitle>
              <div className="flex items-center gap-2 sm:gap-4 text-sm text-muted-foreground flex-wrap min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <Bus className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{vehicle?.name || "No Vehicle"} ({vehicle?.plateNumber || "N/A"})</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{shift.plannedStart} - {shift.plannedEnd}</span>
                </div>
                <Badge variant="default" data-testid="badge-shift-type">
                  {shift.shiftType}
                </Badge>
                {routeCompleted && (
                  <Badge variant="outline" className="border-green-600 text-green-600 dark:border-green-400 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-progress-count">
                {progress.completedStops}/{progress.totalStops}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Stops Complete</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Route Completed Notice */}
      {routeCompleted && (
        <Alert className="border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-950" data-testid="alert-route-completed">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">Route Completed</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  This route was finished at {new Date(shift.routeCompletedAt!).toLocaleTimeString()}. 
                  Attendance and ride events can no longer be modified.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setLocation("/driver")}
                data-testid="button-back-to-dashboard"
              >
                Back to Dashboard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Inspection Warning */}
      {inspectionBlocked && !routeCompleted && (
        <Alert className="border-destructive" data-testid="alert-inspection-required">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">Vehicle Inspection Required</h3>
                <p className="text-sm text-muted-foreground">
                  Complete the vehicle inspection checklist before starting this route.
                </p>
              </div>
              <Button
                variant="default"
                className="flex-shrink-0"
                onClick={() => setLocation("/driver/checklist")}
                data-testid="button-go-to-inspection"
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Go to Inspection
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Students Section */}
      {!inspectionBlocked && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <div className="space-y-3">
                {students.map((student) => {
                  const hasAttendance = student.attendance !== null;
                  const isRiding = student.attendance === "riding";
                  const isAbsent = student.attendance === "absent";
                  const hasBoarded = student.boardEvent !== null;
                  const hasDisembarked = student.deboardEvent !== null;

                  return (
                    <div
                      key={student.id}
                      className={`p-4 rounded-lg border ${
                        hasDisembarked
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                          : isAbsent
                          ? "bg-muted/30"
                          : "bg-card"
                      }`}
                      data-testid={`item-student-${student.id}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            <span className="break-words">{student.firstName} {student.lastName}</span>
                            {hasDisembarked && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            )}
                          </div>
                          {student.plannedStopName && (
                            <div className="text-sm text-muted-foreground mt-1 flex items-start gap-1 min-w-0">
                              <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                              <span className="break-words">Planned: {student.plannedStopName}</span>
                            </div>
                          )}
                        </div>

                        {/* Attendance Status */}
                        {hasAttendance && (
                          <Badge
                            variant={isRiding ? "default" : "secondary"}
                            className="flex-shrink-0"
                            data-testid={`badge-attendance-${student.id}`}
                          >
                            {isRiding ? "Riding" : "Absent"}
                          </Badge>
                        )}
                      </div>

                      {/* Ride Events */}
                      {(hasBoarded || hasDisembarked) && (
                        <div className="space-y-2 mb-3 text-sm">
                          {hasBoarded && student.boardEvent && (
                            <div className="flex items-start gap-2 text-muted-foreground min-w-0">
                              <LogIn className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              <span className="break-words min-w-0">
                                Boarded at <strong className="break-words">{student.boardEvent.stopName}</strong> • {new Date(student.boardEvent.recordedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          )}
                          {hasDisembarked && student.deboardEvent && (
                            <div className="flex items-start gap-2 text-muted-foreground min-w-0">
                              <LogOut className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <span className="break-words min-w-0">
                                Deboarded at <strong className="break-words">{student.deboardEvent.stopName}</strong> • {new Date(student.deboardEvent.recordedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons with Loading States */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Attendance marking - only for lead drivers */}
                        {!hasAttendance && !routeCompleted && canMarkAttendance && (
                          <>
                            <Button
                              size="touch"
                              variant="default"
                              onClick={() =>
                                attendanceMutation.mutate({
                                  studentId: student.id,
                                  status: "riding",
                                })
                              }
                              disabled={attendanceMutation.isPending}
                              data-testid={`button-mark-riding-${student.id}`}
                            >
                              {attendanceMutation.isPending ? (
                                <Clock className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4 mr-1" />
                              )}
                              {attendanceMutation.isPending ? "Saving..." : "Riding"}
                            </Button>
                            <Button
                              size="touch"
                              variant="secondary"
                              onClick={() =>
                                attendanceMutation.mutate({
                                  studentId: student.id,
                                  status: "absent",
                                })
                              }
                              disabled={attendanceMutation.isPending}
                              data-testid={`button-mark-absent-${student.id}`}
                            >
                              {attendanceMutation.isPending ? (
                                <Clock className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4 mr-1" />
                              )}
                              {attendanceMutation.isPending ? "Saving..." : "Absent"}
                            </Button>
                          </>
                        )}
                        {/* Pending status indicator for non-lead drivers */}
                        {!hasAttendance && !routeCompleted && !canMarkAttendance && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Pending
                          </Badge>
                        )}
                        {/* Board button - available to all drivers, but only shows when student is riding OR is pending */}
                        {(isRiding || (!hasAttendance && !canMarkAttendance)) && !hasBoarded && !routeCompleted && (
                          <Button
                            size="touch"
                            variant="default"
                            onClick={() =>
                              openRideEventDialog(
                                student.id,
                                `${student.firstName} ${student.lastName}`,
                                "BOARD",
                                student.plannedStopId,
                                student.plannedStopName
                              )
                            }
                            disabled={rideEventMutation.isPending}
                            data-testid={`button-board-${student.id}`}
                          >
                            {rideEventMutation.isPending ? (
                              <Clock className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <LogIn className="h-4 w-4 mr-1" />
                            )}
                            Board
                          </Button>
                        )}
                        {hasBoarded && !hasDisembarked && !routeCompleted && (
                          <Button
                            size="touch"
                            variant="outline"
                            onClick={() =>
                              openRideEventDialog(
                                student.id,
                                `${student.firstName} ${student.lastName}`,
                                "DEBOARD",
                                student.plannedStopId,
                                student.plannedStopName
                              )
                            }
                            disabled={rideEventMutation.isPending}
                            data-testid={`button-deboard-${student.id}`}
                          >
                            {rideEventMutation.isPending ? (
                              <Clock className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4 mr-1" />
                            )}
                            Deboard
                          </Button>
                        )}
                        {/* Locked indicator when route is completed */}
                        {routeCompleted && (
                          <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-locked-${student.id}`}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No students assigned to this route
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stop List */}
      {!inspectionBlocked && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Route Stops</h2>
          {stops.map((stop, index) => {
            const isExpanded = expandedStops.has(stop.id);
            const isCompleted = stop.progress.status === "COMPLETED";
            const isPending = stop.progress.status === "PENDING";
            const isActive = progress.activeStopId === stop.routeStopId && isPending;
            const canComplete = canCompleteStop(stop);

            return (
              <Collapsible
                key={stop.id}
                open={isExpanded}
                onOpenChange={() => toggleStop(stop.id)}
              >
                <Card
                  className={`${
                    isCompleted
                      ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                      : isActive
                      ? "border-primary"
                      : ""
                  }`}
                  data-testid={`card-stop-${stop.id}`}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate">
                      <div className="flex items-start gap-3 w-full min-w-0">
                        {/* Stop number/check indicator */}
                        <div className="flex-shrink-0 mt-0.5">
                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                          ) : (
                            <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs font-semibold">
                              {index + 1}
                            </div>
                          )}
                        </div>
                        
                        {/* Stop info - constrained width */}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold flex items-start gap-1.5" data-testid={`text-stop-name-${stop.id}`}>
                                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span className="break-words">{stop.name}</span>
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {stop.address}
                              </p>
                            </div>
                            <ChevronDown className={`h-5 w-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          
                          {/* Badges row */}
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            {stop.scheduledTime && (
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                {stop.scheduledTime}
                              </Badge>
                            )}
                            {isPending && stop.stopsAway > 0 && (
                              <Badge variant="secondary" data-testid={`badge-stops-away-${stop.id}`}>
                                {stop.stopsAway} stop{stop.stopsAway !== 1 ? "s" : ""} away
                              </Badge>
                            )}
                            {isPending && stop.stopsAway === 0 && (
                              <Badge variant="default" data-testid={`badge-next-stop-${stop.id}`}>
                                Next Stop
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Actions */}
                        {isPending && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                onClick={() => completeStopMutation.mutate(stop.routeStopId)}
                                disabled={!canComplete || completeStopMutation.isPending}
                                data-testid={`button-mark-complete-${stop.id}`}
                              >
                                {completeStopMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Completing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark Stop Complete
                                  </>
                                )}
                              </Button>
                            </div>
                            {/* Disabled Reason */}
                            {!canComplete && !completeStopMutation.isPending && (
                              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/50 border border-dashed" data-testid={`text-complete-blocked-${stop.id}`}>
                                <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-muted-foreground">
                                  Complete previous stops first or process remaining students
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {isCompleted && stop.progress.completedAt && (
                          <div className="text-sm text-muted-foreground" data-testid={`text-completed-time-${stop.id}`}>
                            Completed at {new Date(stop.progress.completedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Finish Route Button */}
      {canFinishRoute && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Flag className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg">Ready to Finish Route</h3>
                  <p className="text-sm text-muted-foreground">
                    All stops complete and all students processed
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleFinishRoute}
                disabled={finishRouteMutation.isPending}
                data-testid="button-finish-route"
              >
                {finishRouteMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Finishing...
                  </>
                ) : (
                  <>
                    <Flag className="h-5 w-5 mr-2" />
                    Finish Route
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ride Event Dialog */}
      <Dialog open={!!rideEventDialog} onOpenChange={() => setRideEventDialog(null)}>
        <DialogContent data-testid="dialog-ride-event">
          <DialogHeader>
            <DialogTitle>
              {rideEventDialog?.eventType === "BOARD" ? "Board Student" : "Deboard Student"}
            </DialogTitle>
            <DialogDescription>
              Record {rideEventDialog?.eventType === "BOARD" ? "boarding" : "deboarding"} for{" "}
              <strong>{rideEventDialog?.studentName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Stop</label>
              <Select value={selectedStopId} onValueChange={setSelectedStopId}>
                <SelectTrigger data-testid="select-stop">
                  <SelectValue placeholder="Select a stop" />
                </SelectTrigger>
                <SelectContent>
                  {stops.map((stop) => (
                    <SelectItem key={stop.id} value={stop.id} data-testid={`option-stop-${stop.id}`}>
                      {stop.name}
                      {stop.id === rideEventDialog?.plannedStopId && " (Planned)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rideEventDialog?.plannedStopName && (
                <p className="text-xs text-muted-foreground">
                  Planned stop: {rideEventDialog.plannedStopName}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRideEventDialog(null)}
              data-testid="button-cancel-ride-event"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRideEventSubmit}
              disabled={!selectedStopId || rideEventMutation.isPending}
              data-testid="button-confirm-ride-event"
            >
              {rideEventDialog?.eventType === "BOARD" ? "Board" : "Deboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Trip Inspection Dialog */}
      <Dialog open={showPostTripDialog} onOpenChange={setShowPostTripDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]" data-testid="dialog-post-trip-inspection">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Post-Trip Inspection
            </DialogTitle>
            <DialogDescription>
              Complete post-trip inspection before finishing the route
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="ending-mileage" className="text-sm font-semibold">
                  Ending Mileage <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ending-mileage"
                  type="number"
                  placeholder="Enter current odometer reading"
                  value={endingMileage}
                  onChange={(e) => setEndingMileage(e.target.value)}
                  data-testid="input-ending-mileage"
                />
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Checklist</h4>
                {POST_TRIP_INSPECTION_ITEMS.map(({ key, label }) => (
                  <div key={key} className="flex items-start space-x-2">
                    <Checkbox
                      id={key}
                      checked={postTripChecks[key] || false}
                      onCheckedChange={(checked) => 
                        setPostTripChecks(prev => ({ ...prev, [key]: checked === true }))
                      }
                      data-testid={`checkbox-post-${key}`}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={key}
                      className="text-sm leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Damage Check</h4>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="newDamageFound"
                    checked={newDamageFound}
                    onCheckedChange={(checked) => setNewDamageFound(checked === true)}
                    data-testid="checkbox-new-damage"
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="newDamageFound"
                    className="text-sm leading-tight text-destructive font-medium"
                  >
                    New Damage Found (Interior or Exterior)
                  </label>
                </div>
                
                {newDamageFound && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="damage-notes" className="text-sm">
                      Describe the damage <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="damage-notes"
                      placeholder="Describe the new damage in detail..."
                      value={damageNotes}
                      onChange={(e) => setDamageNotes(e.target.value)}
                      rows={3}
                      data-testid="textarea-damage-notes"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-trip-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="post-trip-notes"
                  placeholder="Any other observations..."
                  value={postTripNotes}
                  onChange={(e) => setPostTripNotes(e.target.value)}
                  rows={2}
                  data-testid="textarea-post-trip-notes"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPostTripDialog(false)}
              data-testid="button-cancel-post-trip"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePostTripSubmit}
              disabled={finishRouteMutation.isPending || (!endingMileage.trim()) || (newDamageFound && !damageNotes.trim())}
              data-testid="button-complete-post-trip"
            >
              {finishRouteMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete & Finish Route
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    
  );
}

function RoutePageSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
      </Card>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-16 w-full" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
