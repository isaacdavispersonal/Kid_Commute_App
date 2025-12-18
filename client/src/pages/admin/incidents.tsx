import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

interface EnrichedIncident {
  id: string;
  reporterId: string;
  vehicleId: string | null;
  routeId: string | null;
  studentId: string | null;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "pending" | "reviewed" | "resolved";
  location: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  reporterFirstName: string;
  reporterLastName: string;
  reporterEmail: string;
  studentFirstName: string | null;
  studentLastName: string | null;
}

export default function AdminIncidentsPage() {
  const { toast } = useToast();
  const [selectedIncident, setSelectedIncident] = useState<EnrichedIncident | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  const search = useSearch();
  const [, navigate] = useLocation();

  const { data: incidents, isLoading } = useQuery<EnrichedIncident[]>({
    queryKey: ["/api/admin/incidents"],
  });

  // Auto-select incident from URL parameter
  useEffect(() => {
    if (incidents && search) {
      const params = new URLSearchParams(search);
      const incidentId = params.get("id");
      if (incidentId) {
        const incident = incidents.find(i => i.id === incidentId);
        if (incident) {
          setSelectedIncident(incident);
          // Clear the URL parameter after opening
          navigate("/admin/incidents", { replace: true });
        }
      }
    }
  }, [incidents, search, navigate]);

  const resolveMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      return await apiRequest("PATCH", `/api/admin/incidents/${incidentId}`, { status: "resolved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/incidents"] });
      toast({
        title: "Incident Resolved",
        description: "The incident has been marked as resolved",
      });
      setSelectedIncident(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve incident. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredIncidents = incidents?.filter((incident) => {
    if (filter === "pending") return incident.status === "pending" || incident.status === "reviewed";
    if (filter === "resolved") return incident.status === "resolved";
    return true;
  });

  const pendingCount = incidents?.filter(i => i.status !== "resolved").length || 0;

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "low":
        return "outline";
      case "medium":
        return "secondary";
      case "high":
        return "destructive";
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning">Pending</Badge>;
      case "reviewed":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary">Reviewed</Badge>;
      case "resolved":
        return <Badge variant="outline" className="bg-success/10 text-success border-success">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <IncidentsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Incident Management</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage incident reports from drivers
          </p>
        </div>
      </div>

      {pendingCount > 0 && filter === "all" && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
              <p className="text-sm text-warning">
                <span className="font-semibold">{pendingCount}</span> incident{pendingCount !== 1 ? 's' : ''} awaiting review
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          data-testid="filter-all"
        >
          All Incidents ({incidents?.length || 0})
        </Button>
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
          data-testid="filter-pending"
        >
          Pending ({pendingCount})
        </Button>
        <Button
          variant={filter === "resolved" ? "default" : "outline"}
          onClick={() => setFilter("resolved")}
          data-testid="filter-resolved"
        >
          Resolved ({incidents?.filter(i => i.status === "resolved").length || 0})
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredIncidents && filteredIncidents.length > 0 ? (
          filteredIncidents.map((incident) => (
            <Card 
              key={incident.id} 
              className="hover-elevate cursor-pointer" 
              onClick={() => setSelectedIncident(incident)}
              data-testid={`card-incident-${incident.id}`}
            >
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-1">{incident.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {incident.description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 items-end flex-shrink-0">
                    <Badge variant={getSeverityVariant(incident.severity)}>
                      {incident.severity.toUpperCase()}
                    </Badge>
                    {getStatusBadge(incident.status)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{incident.reporterFirstName} {incident.reporterLastName}</span>
                  </div>
                  {incident.studentFirstName && incident.studentLastName && (
                    <Badge variant="secondary" className="text-xs">
                      Child: {incident.studentFirstName} {incident.studentLastName}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(incident.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                  {incident.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{incident.location}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                No incidents to display
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedIncident && (
        <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
          <DialogContent className="max-w-2xl" data-testid="dialog-incident-details">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5" />
                Incident Details
              </DialogTitle>
              <DialogDescription>
                Review the complete incident report and take action
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">{selectedIncident.title}</h3>
                <div className="flex gap-2 items-center">
                  <Badge variant={getSeverityVariant(selectedIncident.severity)}>
                    {selectedIncident.severity.toUpperCase()}
                  </Badge>
                  {getStatusBadge(selectedIncident.status)}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-0.5">Reported By</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-reporter-name">
                      {selectedIncident.reporterFirstName} {selectedIncident.reporterLastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedIncident.reporterEmail}</p>
                  </div>
                </div>

                {selectedIncident.studentFirstName && selectedIncident.studentLastName && (
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium mb-0.5">Child Involved</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-student-name">
                        {selectedIncident.studentFirstName} {selectedIncident.studentLastName}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-0.5">Time Reported</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-incident-time">
                      {format(new Date(selectedIncident.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                {selectedIncident.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium mb-0.5">Location</p>
                      <p className="text-sm text-muted-foreground">{selectedIncident.location}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-0.5">Description</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-incident-description">
                      {selectedIncident.description}
                    </p>
                  </div>
                </div>
              </div>

              {selectedIncident.status !== "resolved" && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => resolveMutation.mutate(selectedIncident.id)}
                    disabled={resolveMutation.isPending}
                    className="flex-1"
                    data-testid="button-resolve-incident"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function IncidentsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-80" />
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
