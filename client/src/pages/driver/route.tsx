import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

export default function DriverRoutePage() {
  const params = useParams();
  const shiftId = params.shiftId;

  const { data: routeContext, isLoading } = useQuery({
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

  return (
    <div className="space-y-6 p-4">
      {/* Route Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{route.name}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Bus className="h-4 w-4" />
                  {vehicle?.name || "No Vehicle"} ({vehicle?.plateNumber || "N/A"})
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {shift.plannedStart} - {shift.plannedEnd}
                </div>
                <Badge variant="default">
                  {shift.shiftType}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {progress.completedStops}/{progress.totalStops}
              </div>
              <div className="text-sm text-muted-foreground">Stops Complete</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Inspection Warning */}
      {inspectionBlocked && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Vehicle Inspection Required</h3>
                <p className="text-sm text-muted-foreground">
                  Complete the vehicle inspection checklist before starting this route.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stop List */}
      <div className="space-y-3">
        {stops.map((stop: any, index: number) => {
          const isExpanded = expandedStops.has(stop.id);
          const isCompleted = stop.progress.status === "COMPLETED";
          const isPending = stop.progress.status === "PENDING";
          const isActive = progress.activeStopId === stop.routeStopId && isPending;

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
                          <h3 className="font-semibold flex items-center gap-2">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            {stop.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {stop.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {stop.scheduledTime && (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {stop.scheduledTime}
                            </Badge>
                          )}
                          {isPending && stop.stopsAway > 0 && (
                            <Badge variant="secondary">
                              {stop.stopsAway} stop{stop.stopsAway !== 1 ? "s" : ""} away
                            </Badge>
                          )}
                          {isPending && stop.stopsAway === 0 && (
                            <Badge variant="default">Next Stop</Badge>
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
                      {/* Student List */}
                      {stop.students.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Students at this stop:</h4>
                          <div className="space-y-1">
                            {stop.students.map((student: any) => (
                              <div
                                key={student.id}
                                className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                              >
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {student.firstName} {student.lastName}
                                </span>
                                {student.attendance && (
                                  <Badge variant="secondary" className="ml-auto">
                                    {student.attendance.status}
                                  </Badge>
                                )}
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
                          <Button className="flex-1" data-testid={`button-mark-complete-${stop.id}`}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark Stop Complete
                          </Button>
                        </div>
                      )}

                      {isCompleted && stop.progress.completedAt && (
                        <div className="text-sm text-muted-foreground pt-4 border-t">
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
