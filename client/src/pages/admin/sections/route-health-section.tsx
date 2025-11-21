import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

interface RouteHealth {
  routeId: string;
  routeName: string;
  isActive: boolean;
  assignedDriver: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  driverStatus: "ON_TIME" | "LATE" | "NOT_STARTED" | "NO_DRIVER";
  studentCount: number;
  unresolvedIncidents: number;
  lastActivity: string | null;
}

export default function RouteHealthSection() {
  const { data: routes, isLoading } = useQuery<RouteHealth[]>({
    queryKey: ["/api/admin/route-health"],
  });

  const activeRoutes = routes?.filter(r => r.isActive) || [];
  const inactiveRoutes = routes?.filter(r => !r.isActive) || [];
  const routesWithIssues = routes?.filter(r => r.unresolvedIncidents > 0 || r.driverStatus === "LATE" || r.driverStatus === "NO_DRIVER") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ON_TIME":
        return <Badge variant="outline" className="bg-success/10 text-success border-success"><CheckCircle2 className="w-3 h-3 mr-1" />On Time</Badge>;
      case "LATE":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning"><Clock className="w-3 h-3 mr-1" />Late</Badge>;
      case "NOT_STARTED":
        return <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary"><Clock className="w-3 h-3 mr-1" />Not Started</Badge>;
      case "NO_DRIVER":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive"><XCircle className="w-3 h-3 mr-1" />No Driver</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRoutes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {inactiveRoutes.length} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Routes with Issues</CardTitle>
            <AlertTriangle className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{routesWithIssues.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unresolved Incidents</CardTitle>
            <TrendingUp className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {routes?.reduce((sum, r) => sum + r.unresolvedIncidents, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all routes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Route Status ({routes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routes && routes.length > 0 ? (
            <div className="space-y-3">
              {routes.map((route) => (
                <div
                  key={route.routeId}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`route-health-${route.routeId}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{route.routeName}</h3>
                      {route.isActive ? (
                        <Badge variant="outline" className="bg-success/10 text-success">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-700">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {route.assignedDriver ? (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {route.assignedDriver.firstName} {route.assignedDriver.lastName}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-warning">
                          <Users className="w-3 h-3" />
                          No driver assigned
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {route.studentCount} students
                      </div>
                      {route.unresolvedIncidents > 0 && (
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          {route.unresolvedIncidents} incidents
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(route.driverStatus)}
                    {route.lastActivity && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last activity: {format(new Date(route.lastActivity), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No routes available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
