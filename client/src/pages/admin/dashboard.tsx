// Admin dashboard with fleet overview
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Users, Route as RouteIcon, AlertTriangle, UserCircle, Clock } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";

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
  routeName?: string;
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
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentIncidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/admin/recent-incidents"],
  });

  const { data: activeDrivers, isLoading: driversLoading } = useQuery<ActiveDriver[]>({
    queryKey: ["/api/admin/active-drivers"],
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
              <div className="space-y-3">
                {recentIncidents.slice(0, 5).map((incident: any) => (
                  <div
                    key={incident.id}
                    className="p-3 rounded-md bg-accent/50 hover-elevate"
                    data-testid={`incident-item-${incident.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-sm">{incident.title}</p>
                      <StatusBadge status={incident.severity} />
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
