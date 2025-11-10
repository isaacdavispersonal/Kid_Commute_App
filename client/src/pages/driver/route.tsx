import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ShiftRouteContext } from "@shared/schema";

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

  const { shift, route, vehicle, stops, progress } = routeContext;

  // Check if inspection is required but not complete
  const inspectionBlocked = !shift.inspectionComplete;

  // Helper to check if stop can be completed
  const canCompleteStop = (stop: ShiftRouteContext["stops"][0]) => {
    // Must have inspection complete
    if (inspectionBlocked) return false;
    
    // Must be the active stop
    if (progress.activeStopId !== stop.routeStopId) return false;
    
    // All students must have attendance marked
    const hasStudents = stop.students.length > 0;
    if (hasStudents) {
      const allMarked = stop.students.every(s => s.attendance !== null);
      return allMarked;
    }
    
    // If no students, can complete
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

      {/* Stop List */}
      <div className="space-y-3">
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
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="text-sm">{stop.students.length}</span>
                          </div>
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
                      {/* Student List with Attendance */}
                      {stop.students.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Students at this stop:</h4>
                          <div className="space-y-2">
                            {stop.students.map((student) => (
                              <div
                                key={student.id}
                                className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                                data-testid={`item-student-${student.id}`}
                              >
                                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="flex-1">
                                  {student.firstName} {student.lastName}
                                </span>
                                {student.attendance ? (
                                  <Badge
                                    variant={
                                      student.attendance.status === "riding"
                                        ? "default"
                                        : "secondary"
                                    }
                                    data-testid={`badge-attendance-${student.id}`}
                                  >
                                    {student.attendance.status === "riding" ? "Riding" : "Absent"}
                                  </Badge>
                                ) : isPending && !inspectionBlocked ? (
                                  <div className="flex gap-2">
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
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No students assigned to this stop
                        </p>
                      )}

                      {/* Actions */}
                      {isPending && !inspectionBlocked && (
                        <div className="flex gap-2 pt-4 border-t">
                          <Button
                            className="flex-1"
                            onClick={() => completeStopMutation.mutate(stop.routeStopId)}
                            disabled={!canComplete || completeStopMutation.isPending}
                            data-testid={`button-mark-complete-${stop.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {canComplete ? "Mark Stop Complete" : "Mark All Attendance First"}
                          </Button>
                        </div>
                      )}

                      {isCompleted && stop.progress.completedAt && (
                        <div className="text-sm text-muted-foreground pt-4 border-t" data-testid={`text-completed-time-${stop.id}`}>
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

      {/* All Stops Completed */}
      {progress.completedStops === progress.totalStops && progress.totalStops > 0 && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Route Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  All stops have been completed. Great job!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
