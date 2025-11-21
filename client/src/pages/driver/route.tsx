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
  ChevronUp,
  Clock,
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ShiftRouteContext } from "@shared/schema";

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

  const { data: routeContext, isLoading } = useQuery<ShiftRouteContext>({
    queryKey: ["/api/driver/route", shiftId],
    enabled: !!shiftId,
  });

  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [rideEventDialog, setRideEventDialog] = useState<RideEventDialog>(null);
  const [selectedStopId, setSelectedStopId] = useState<string>("");

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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route", shiftId] });
      toast({
        title: "Attendance updated",
        description: "Student attendance has been recorded",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attendance",
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
      toast({
        title: "Error",
        description: error.message || "Failed to record ride event",
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

  // Mutation to finish route
  const finishRouteMutation = useMutation({
    mutationFn: async () => {
      if (!shiftId) throw new Error("No shift ID");
      return apiRequest("POST", `/api/driver/shift/${shiftId}/finish-route`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route", shiftId] });
      toast({
        title: "Route completed!",
        description: "Great job! The route has been completed.",
      });
      // Navigate back to dashboard
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
    <div className="space-y-6 p-4">
      {/* Route Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl" data-testid="title-route-name">
                {route.name}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <Bus className="h-4 w-4" />
                  {vehicle?.name || "No Vehicle"} ({vehicle?.plateNumber || "N/A"})
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {shift.plannedStart} - {shift.plannedEnd}
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
            <div className="text-right">
              <div className="text-2xl font-bold" data-testid="text-progress-count">
                {progress.completedStops}/{progress.totalStops}
              </div>
              <div className="text-sm text-muted-foreground">Stops Complete</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Inspection Warning */}
      {inspectionBlocked && (
        <Alert className="border-destructive" data-testid="alert-inspection-required">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">Vehicle Inspection Required</h3>
                <p className="text-sm text-muted-foreground">
                  Complete the vehicle inspection checklist before starting this route.
                </p>
              </div>
              <Button
                variant="default"
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
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {student.firstName} {student.lastName}
                            {hasDisembarked && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            )}
                          </div>
                          {student.plannedStopName && (
                            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Planned: {student.plannedStopName}
                            </div>
                          )}
                        </div>

                        {/* Attendance Status */}
                        {hasAttendance && (
                          <Badge
                            variant={isRiding ? "default" : "secondary"}
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
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <span>
                                Boarded at <strong>{student.boardEvent.stopName}</strong> •{" "}
                                {new Date(student.boardEvent.recordedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          )}
                          {hasDisembarked && student.deboardEvent && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <LogOut className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span>
                                Deboarded at <strong>{student.deboardEvent.stopName}</strong> •{" "}
                                {new Date(student.deboardEvent.recordedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {!hasAttendance && !routeCompleted && (
                          <>
                            <Button
                              size="sm"
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
                              <UserCheck className="h-4 w-4 mr-1" />
                              Riding
                            </Button>
                            <Button
                              size="sm"
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
                              <UserX className="h-4 w-4 mr-1" />
                              Absent
                            </Button>
                          </>
                        )}
                        {isRiding && !hasBoarded && !routeCompleted && (
                          <Button
                            size="sm"
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
                            data-testid={`button-board-${student.id}`}
                          >
                            <LogIn className="h-4 w-4 mr-1" />
                            Board
                          </Button>
                        )}
                        {hasBoarded && !hasDisembarked && !routeCompleted && (
                          <Button
                            size="sm"
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
                            data-testid={`button-deboard-${student.id}`}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Deboard
                          </Button>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-shrink-0">
                            {isCompleted ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                            ) : (
                              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold flex items-center gap-2" data-testid={`text-stop-name-${stop.id}`}>
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              {stop.name}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {stop.address}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
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
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
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
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              onClick={() => completeStopMutation.mutate(stop.routeStopId)}
                              disabled={!canComplete || completeStopMutation.isPending}
                              data-testid={`button-mark-complete-${stop.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark Stop Complete
                            </Button>
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
                onClick={() => finishRouteMutation.mutate()}
                disabled={finishRouteMutation.isPending}
                data-testid="button-finish-route"
              >
                <Flag className="h-5 w-5 mr-2" />
                Finish Route
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
