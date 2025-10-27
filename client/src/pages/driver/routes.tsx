// Driver routes page - view assigned routes
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route as RouteIcon, MapPin, Clock, Users } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DriverRoutes() {
  const { data: todayRoute, isLoading } = useQuery({
    queryKey: ["/api/driver/today-route"],
  });

  if (isLoading) {
    return <DriverRoutesSkeleton />;
  }

  return (
    <div className="space-y-6">
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
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-semibold text-xl mb-1">{todayRoute.routeName}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {todayRoute.startTime} - {todayRoute.endTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {todayRoute.stops?.length || 0} stops
                  </span>
                </div>
              </div>
              <StatusBadge status="active" />
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Route Stops
              </h4>
              
              {todayRoute.stops && todayRoute.stops.length > 0 ? (
                <div className="space-y-3">
                  {todayRoute.stops.map((stop: any, index: number) => (
                    <div
                      key={stop.id}
                      className="flex items-start gap-4 p-4 rounded-md bg-card border hover-elevate"
                      data-testid={`stop-item-${index}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h5 className="font-semibold text-base">{stop.name}</h5>
                          <span className="text-sm font-medium text-primary whitespace-nowrap">
                            {stop.scheduledTime}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {stop.address}
                        </p>
                        {stop.notes && (
                          <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-accent/50">
                            Note: {stop.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
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
