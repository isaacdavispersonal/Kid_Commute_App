// Admin dashboard with fleet overview
import { useQuery, useMutation } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Users, Route as RouteIcon, AlertTriangle, UserCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AdminStats {
  activeVehicles: number;
  activeDrivers: number;
  totalRoutes: number;
  activeStudents: number;
}

interface ActiveDriver {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  routeName?: string | null;
  clockInTime?: string | null;
}

// Helper function to safely display driver names
function getDriverDisplayName(driver: ActiveDriver | undefined): string {
  if (!driver) return "Unknown Driver";
  
  const firstName = driver.firstName?.trim();
  const lastName = driver.lastName?.trim();
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else {
    return driver.email || "Unknown Driver";
  }
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: "pending" | "reviewed" | "resolved";
  createdAt: string;
}

export default function AdminDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentIncidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/admin/recent-incidents"],
  });

  const { data: activeDrivers, isLoading: driversLoading } = useQuery<ActiveDriver[]>({
    queryKey: ["/api/admin/active-drivers"],
  });

  const { data: anomalies, isLoading: anomaliesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/timecard-anomalies"],
    refetchInterval: 60000, // Refetch every minute
  });

  const resolveAnomalyMutation = useMutation({
    mutationFn: async (clockEventId: string) => {
      return await apiRequest(`/api/admin/clock-events/${clockEventId}/resolve`, {
        method: "PATCH",
        body: { notes: "Resolved from dashboard" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timecard-anomalies"] });
      toast({
        title: "Anomaly Resolved",
        description: "The timecard anomaly has been marked as resolved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve anomaly. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: attendanceOverview, isLoading: attendanceLoading } = useQuery<{
    pending: number;
    riding: number;
    absent: number;
    total: number;
  }>({
    queryKey: ["/api/admin/attendance/overview", today],
    queryFn: async () => {
      const response = await fetch(`/api/admin/attendance/overview/${today}`);
      if (!response.ok) throw new Error("Failed to fetch attendance overview");
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });

  if (statsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Fleet overview and system status
        </p>
      </div>

      <IncompleteProfileBanner />

      {/* Timecard Anomalies Alert */}
      {!anomaliesLoading && anomalies && anomalies.length > 0 && (
        <Alert variant="destructive" data-testid="alert-timecard-anomalies">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              Timecard Anomalies Detected
              <Badge variant="destructive">{anomalies.length}</Badge>
            </div>
            <Link href="/admin/time-management">
              <Button variant="outline" size="sm" className="gap-1" data-testid="button-view-all-anomalies">
                View All
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {anomalies.slice(0, 3).map((anomaly, idx) => (
                <div key={idx} className="text-sm p-2 rounded bg-background/50">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{anomaly.driverName}</span>
                        <Badge variant="outline" className="text-xs">
                          {anomaly.type === "MISSED_CLOCKOUT" && "Missed Clock Out"}
                          {anomaly.type === "ORPHANED_BREAK" && "Orphaned Break"}
                          {anomaly.type === "DOUBLE_CLOCKIN" && "Double Clock In"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{anomaly.message}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveAnomalyMutation.mutate(anomaly.clockEventId)}
                      disabled={resolveAnomalyMutation.isPending}
                      data-testid={`button-resolve-anomaly-${idx}`}
                    >
                      {resolveAnomalyMutation.isPending ? "Resolving..." : "Resolve"}
                    </Button>
                  </div>
                </div>
              ))}
              {anomalies.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  And {anomalies.length - 3} more anomalies requiring attention
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Active Vehicles"
          value={stats?.activeVehicles || 0}
          icon={Car}
          iconColor="text-success"
        />
        <StatCard
          title="Active Drivers"
          value={stats?.activeDrivers || 0}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          title="Total Routes"
          value={stats?.totalRoutes || 0}
          icon={RouteIcon}
          iconColor="text-primary"
        />
        <StatCard
          title="Active Students"
          value={stats?.activeStudents || 0}
          icon={UserCircle}
          iconColor="text-muted-foreground"
        />
      </div>

      {/* Attendance Overview */}
      <Card data-testid="card-attendance-overview">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Today's Attendance Overview
            <Badge variant="outline" className="ml-auto text-xs">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : attendanceOverview ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-accent/30 hover-elevate" data-testid="attendance-total">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-3xl font-bold">{attendanceOverview.total}</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 hover-elevate" data-testid="attendance-pending">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                    {attendanceOverview.pending}
                  </p>
                  {attendanceOverview.total > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((attendanceOverview.pending / attendanceOverview.total) * 100)}%
                    </p>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 hover-elevate" data-testid="attendance-riding">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">Riding</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {attendanceOverview.riding}
                  </p>
                  {attendanceOverview.total > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((attendanceOverview.riding / attendanceOverview.total) * 100)}%
                    </p>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 hover-elevate" data-testid="attendance-absent">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-400">
                    {attendanceOverview.absent}
                  </p>
                  {attendanceOverview.total > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((attendanceOverview.absent / attendanceOverview.total) * 100)}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attendance data available for today
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Drivers On Duty
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driversLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activeDrivers && activeDrivers.length > 0 ? (
              <div className="space-y-3">
                {activeDrivers.slice(0, 5).map((driver: any) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-3 rounded-md bg-accent/50 hover-elevate"
                    data-testid={`driver-item-${driver.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {getDriverDisplayName(driver)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {driver.routeName || "No route assigned"}
                          {driver.clockInTime && (
                            <span className="ml-2">
                              • Clocked in {new Date(driver.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status="active" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No drivers currently on duty
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidentsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentIncidents && recentIncidents.length > 0 ? (
              <div className="space-y-4">
                {/* Pending Incidents */}
                {(() => {
                  const pendingIncidents = recentIncidents.filter(
                    (i: Incident) => i.status === "pending" || i.status === "reviewed"
                  );
                  
                  if (pendingIncidents.length === 0) return null;
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">Pending</h4>
                        <StatusBadge status="pending" />
                      </div>
                      <div className="space-y-2">
                        {pendingIncidents.map((incident: Incident) => (
                          <div
                            key={incident.id}
                            className="p-3 rounded-md bg-accent/50 hover-elevate cursor-pointer"
                            onClick={() => navigate(`/admin/incidents?id=${incident.id}`)}
                            data-testid={`incident-item-${incident.id}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-medium text-sm">{incident.title}</p>
                              <Badge variant={incident.severity === "critical" ? "destructive" : "secondary"} className="text-xs">
                                {incident.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {incident.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(incident.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Resolved Incidents - Compact View */}
                {(() => {
                  const resolvedIncidents = recentIncidents.filter(
                    (i: Incident) => i.status === "resolved"
                  );
                  
                  if (resolvedIncidents.length === 0) return null;
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">Resolved</h4>
                        <StatusBadge status="resolved" />
                      </div>
                      <div className="space-y-1">
                        {resolvedIncidents.map((incident: Incident) => (
                          <div
                            key={incident.id}
                            className="p-2 rounded bg-muted/30 hover-elevate text-xs cursor-pointer"
                            onClick={() => navigate(`/admin/incidents?id=${incident.id}`)}
                            data-testid={`incident-item-${incident.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{incident.title}</span>
                              <span className="text-muted-foreground flex-shrink-0">
                                {new Date(incident.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent incidents
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
    </div>
  );
}
