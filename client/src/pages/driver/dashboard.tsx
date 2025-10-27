// Driver dashboard with clock-in/out and route display
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MapPin, Users, CheckCircle, LogIn, LogOut, Timer } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";

// Hook to calculate elapsed time
function useElapsedTime(startTime: string | Date | null): string {
  const [elapsed, setElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    if (!startTime) {
      setElapsed("00:00:00");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 1000); // difference in seconds

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setElapsed(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

export default function DriverDashboard() {
  const { toast } = useToast();

  const { data: currentTimeEntry, isLoading: timeLoading } = useQuery({
    queryKey: ["/api/driver/current-time-entry"],
  });

  const { data: todayRoute, isLoading: routeLoading } = useQuery({
    queryKey: ["/api/driver/today-route"],
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/clock-in", {});
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/driver/current-time-entry"] });
      toast({
        title: "Clocked In",
        description: "Your shift has started successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to clock in. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/clock-out", {});
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/driver/current-time-entry"] });
      toast({
        title: "Clocked Out",
        description: "Your shift has ended successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to clock out. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isClockedIn = currentTimeEntry && !currentTimeEntry.clockOut;
  const elapsedTime = useElapsedTime(isClockedIn ? currentTimeEntry.clockIn : null);

  if (timeLoading || routeLoading) {
    return <DriverDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Driver Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage your shifts and routes
        </p>
      </div>

      <IncompleteProfileBanner />

      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Current Status</p>
              {isClockedIn ? (
                <div className="space-y-2">
                  <StatusBadge status="active" className="text-sm" />
                  <p className="text-xs text-muted-foreground">
                    Clocked in at{" "}
                    {new Date(currentTimeEntry.clockIn).toLocaleTimeString()}
                  </p>
                  <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-primary/10 border border-primary/20">
                    <Timer className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Elapsed Time</p>
                      <p className="text-2xl font-bold text-primary font-mono" data-testid="elapsed-time">
                        {elapsedTime}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <StatusBadge status="offline" />
              )}
            </div>
            {isClockedIn ? (
              <Button
                size="lg"
                variant="destructive"
                onClick={() => clockOutMutation.mutate()}
                disabled={clockOutMutation.isPending}
                data-testid="button-clock-out"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Clock Out
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
                data-testid="button-clock-in"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Clock In
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Today's Route
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayRoute ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base">{todayRoute.routeName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {todayRoute.startTime} - {todayRoute.endTime}
                  </p>
                </div>
                <StatusBadge status="active" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Stops ({todayRoute.stops?.length || 0})
                </p>
                <div className="space-y-2">
                  {todayRoute.stops && todayRoute.stops.length > 0 ? (
                    todayRoute.stops.map((stop: any, index: number) => (
                      <div
                        key={stop.id}
                        className="flex items-center gap-3 p-3 rounded-md bg-accent/50"
                        data-testid={`stop-item-${index}`}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{stop.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {stop.address}
                          </p>
                        </div>
                        <p className="text-sm font-medium whitespace-nowrap">
                          {stop.scheduledTime}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No stops scheduled
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No route assigned for today
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DriverDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40" />
      <Skeleton className="h-96" />
    </div>
  );
}
