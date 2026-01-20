// Driver routes page - view assigned routes
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Route as RouteIcon, MapPin, Clock, Users, CheckCircle2, XCircle, Circle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface TodayRouteData {
  routeName: string;
  startTime: string;
  endTime: string;
  stops: Array<{
    id: string;
    name: string;
    address: string;
    scheduledTime: string;
    notes?: string;
  }>;
}

interface RouteProgress {
  routeStopId: string;
  status: string;
  stop?: { id: string };
}

interface TodayShift {
  id: string;
}

export default function DriverRoutes() {
  const { toast } = useToast();
  const [shiftId, setShiftId] = useState<string | null>(null);
  
  const { data: todayRoute, isLoading } = useQuery<TodayRouteData | null>({
    queryKey: ["/api/driver/today-route"],
  });

  // Fetch today's shift to get the shift ID
  const { data: todayShift } = useQuery<TodayShift[]>({
    queryKey: ["/api/driver/shifts/today"],
    enabled: !!todayRoute,
  });

  // Set shift ID when available
  useEffect(() => {
    if (todayShift && Array.isArray(todayShift) && todayShift.length > 0) {
      setShiftId(todayShift[0].id);
    }
  }, [todayShift]);

  // Fetch route progress
  const { data: routeProgress, isLoading: progressLoading } = useQuery<RouteProgress[]>({
    queryKey: ["/api/driver/route-progress", shiftId],
    enabled: !!shiftId,
  });

  // Initialize route progress if not exists
  const initializeMutation = useMutation({
    mutationFn: async () => {
      if (!shiftId) throw new Error("No shift ID");
      return apiRequest("POST", "/api/driver/route-progress/initialize", { shiftId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-progress", shiftId] });
    },
  });

  // Update stop status mutation
  const updateStopMutation = useMutation({
    mutationFn: async ({ routeStopId, status }: { routeStopId: string; status: string }) => {
      if (!shiftId) throw new Error("No shift ID");
      return apiRequest("POST", "/api/driver/route-progress/update-stop", { shiftId, routeStopId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-progress", shiftId] });
      toast({
        title: "Stop updated",
        description: "Stop status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update stop status.",
        variant: "destructive",
      });
    },
  });

  // Initialize progress on first load
  useEffect(() => {
    if (shiftId && routeProgress && routeProgress.length === 0 && !progressLoading) {
      initializeMutation.mutate();
    }
  }, [shiftId, routeProgress, progressLoading]);

  if (isLoading) {
    return <DriverRoutesSkeleton />;
  }

  return (
    
    <div className="space-y-6 overflow-x-hidden w-full max-w-full">
      <div>
        <h1 className="text-2xl font-semibold mb-1">My Routes</h1>
        <p className="text-sm text-muted-foreground">
          View your assigned routes and stops
        </p>
      </div>

      {todayRoute ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RouteIcon className="h-5 w-5" />
              Today's Route
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1 break-words">{todayRoute.routeName}</h3>
                <div className="flex items-center gap-2 sm:gap-4 text-sm text-muted-foreground flex-wrap min-w-0">
                  <span className="flex items-center gap-1 min-w-0">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{todayRoute.startTime} - {todayRoute.endTime}</span>
                  </span>
                  <span className="flex items-center gap-1 min-w-0">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span>{todayRoute.stops?.length || 0} stops</span>
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <StatusBadge status="active" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>Route Stops</span>
              </h4>
              
              {todayRoute.stops && todayRoute.stops.length > 0 ? (
                <div className="space-y-3">
                  {todayRoute.stops.map((stop: any, index: number) => {
                    const progress = routeProgress?.find((p: any) => p.stop?.id === stop.id);
                    const status = progress?.status || "PENDING";
                    
                    return (
                      <div
                        key={stop.id}
                        className={`flex items-start gap-4 p-4 rounded-md border ${
                          status === "COMPLETED" 
                            ? "bg-success/5 border-success/20" 
                            : status === "SKIPPED"
                            ? "bg-muted/50 border-muted"
                            : "bg-card hover-elevate"
                        }`}
                        data-testid={`stop-item-${index}`}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          status === "COMPLETED"
                            ? "bg-success/20 text-success"
                            : status === "SKIPPED"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {status === "COMPLETED" ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : status === "SKIPPED" ? (
                            <XCircle className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-bold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                            <div className="flex items-start gap-2 min-w-0 flex-1 flex-wrap">
                              <h5 className="font-semibold text-sm sm:text-base break-words min-w-0">{stop.name}</h5>
                              {status !== "PENDING" && (
                                <Badge variant={status === "COMPLETED" ? "default" : "secondary"} className="text-xs flex-shrink-0">
                                  {status === "COMPLETED" ? "Completed" : "Skipped"}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-primary whitespace-nowrap flex-shrink-0">
                              {stop.scheduledTime}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {stop.address}
                          </p>
                          {stop.notes && (
                            <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-accent/50">
                              Note: {stop.notes}
                            </p>
                          )}
                          
                          {shiftId && progress && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {status === "PENDING" && (
                                <>
                                  <Button
                                    size="default"
                                    onClick={() => updateStopMutation.mutate({ 
                                      routeStopId: progress.routeStopId, 
                                      status: "COMPLETED" 
                                    })}
                                    disabled={updateStopMutation.isPending}
                                    data-testid={`complete-stop-${index}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Complete
                                  </Button>
                                  <Button
                                    size="default"
                                    variant="outline"
                                    onClick={() => updateStopMutation.mutate({ 
                                      routeStopId: progress.routeStopId, 
                                      status: "SKIPPED" 
                                    })}
                                    disabled={updateStopMutation.isPending}
                                    data-testid={`skip-stop-${index}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Skip
                                  </Button>
                                </>
                              )}
                              {status !== "PENDING" && (
                                <Button
                                  size="default"
                                  variant="ghost"
                                  onClick={() => updateStopMutation.mutate({ 
                                    routeStopId: progress.routeStopId, 
                                    status: "PENDING" 
                                  })}
                                  disabled={updateStopMutation.isPending}
                                  data-testid={`reset-stop-${index}`}
                                >
                                  <Circle className="h-4 w-4 mr-1" />
                                  Reset
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No stops scheduled for this route
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <RouteIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Route Assigned</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any routes assigned for today
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    
  );
}

function DriverRoutesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="space-y-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
