// Driver routes page - view all assigned routes for today (AM/PM)
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Route as RouteIcon, MapPin, Clock, Users, CheckCircle2, XCircle, Circle, ChevronRight, Car } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";
import { useRegisterRefresh } from "@/contexts/RefreshContext";

interface TodayRouteData {
  id: string;
  routeId: string;
  vehicleId: string | null;
  date: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  routeName: string;
  routeColor: string | null;
  groupColor: string | null;
  vehicleName: string;
  vehiclePlate: string;
  status: string | null;
  routeStartedAt: string | null;
  routeCompletedAt: string | null;
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

export default function DriverRoutes() {
  const { toast } = useToast();
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  
  const { data: todayRoutes = [], isLoading, refetch: refetchRoutes } = useQuery<TodayRouteData[]>({
    queryKey: ["/api/driver/today-route"],
  });

  // Get the selected route details
  const selectedRoute = todayRoutes.find(r => r.id === selectedShiftId) || (todayRoutes.length > 0 ? todayRoutes[0] : null);
  const activeShiftId = selectedRoute?.id || null;

  // Fetch route progress for selected shift
  const { data: routeProgress, isLoading: progressLoading, refetch: refetchProgress } = useQuery<RouteProgress[]>({
    queryKey: ["/api/driver/route-progress", activeShiftId],
    enabled: !!activeShiftId,
  });

  // Pull-to-refresh support
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchRoutes(), refetchProgress()]);
  }, [refetchRoutes, refetchProgress]);
  
  useRegisterRefresh("driver-routes", handleRefresh);

  // Initialize route progress if not exists
  const initializeMutation = useMutation({
    mutationFn: async () => {
      if (!activeShiftId) throw new Error("No shift ID");
      return apiRequest("POST", "/api/driver/route-progress/initialize", { shiftId: activeShiftId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-progress", activeShiftId] });
    },
  });

  // Update stop status mutation
  const updateStopMutation = useMutation({
    mutationFn: async ({ routeStopId, status }: { routeStopId: string; status: string }) => {
      if (!activeShiftId) throw new Error("No shift ID");
      return apiRequest("POST", "/api/driver/route-progress/update-stop", { shiftId: activeShiftId, routeStopId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-progress", activeShiftId] });
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

  if (isLoading) {
    return <DriverRoutesSkeleton />;
  }

  // Format time for display
  const formatTime = (time: string | null) => {
    if (!time) return "--:--";
    return time;
  };

  // Get route status badge
  const getRouteStatusBadge = (route: TodayRouteData) => {
    if (route.routeCompletedAt) return <Badge variant="secondary" className="bg-success/10 text-success">Completed</Badge>;
    if (route.routeStartedAt) return <Badge variant="default">In Progress</Badge>;
    return <Badge variant="outline">Scheduled</Badge>;
  };

  return (
    <div className="space-y-6 overflow-x-hidden w-full max-w-full">
      <div>
        <h1 className="text-2xl font-semibold mb-1">My Routes</h1>
        <p className="text-sm text-muted-foreground">
          View your assigned routes for today
        </p>
      </div>

      {todayRoutes.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <RouteIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Routes Assigned</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any routes assigned for today
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Route Selection Cards - Show if multiple routes */}
          {todayRoutes.length > 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {todayRoutes.map((route, index) => (
                <Card 
                  key={route.id}
                  className={`cursor-pointer transition-all ${
                    route.id === (selectedShiftId || todayRoutes[0]?.id)
                      ? "ring-2 ring-primary"
                      : "hover-elevate"
                  }`}
                  onClick={() => setSelectedShiftId(route.id)}
                  data-testid={`route-card-${index}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: route.routeColor || route.groupColor || 'hsl(var(--primary))' }}
                        >
                          <RouteIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{route.routeName}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(route.plannedStart)} - {formatTime(route.plannedEnd)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getRouteStatusBadge(route)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    {route.vehicleName && route.vehicleName !== "Unknown Vehicle" && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Car className="h-3 w-3" />
                        <span>{route.vehicleName}</span>
                        {route.vehiclePlate && <span>({route.vehiclePlate})</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Selected Route Details */}
          {selectedRoute && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: selectedRoute.routeColor || selectedRoute.groupColor || 'hsl(var(--primary))' }}
                    >
                      <RouteIcon className="h-4 w-4 text-white" />
                    </div>
                    <span>{selectedRoute.routeName}</span>
                  </CardTitle>
                  {getRouteStatusBadge(selectedRoute)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(selectedRoute.plannedStart)} - {formatTime(selectedRoute.plannedEnd)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{selectedRoute.stops?.length || 0} stops</span>
                  </span>
                  {selectedRoute.vehicleName && selectedRoute.vehicleName !== "Unknown Vehicle" && (
                    <span className="flex items-center gap-1">
                      <Car className="h-4 w-4" />
                      <span>{selectedRoute.vehicleName} {selectedRoute.vehiclePlate && `(${selectedRoute.vehiclePlate})`}</span>
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Route Stops</span>
                  </h4>
                  
                  {selectedRoute.stops && selectedRoute.stops.length > 0 ? (
                    <div className="space-y-3">
                      {selectedRoute.stops.map((stop: any, index: number) => {
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
                              
                              {activeShiftId && progress && (
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
          )}
        </>
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
