// Admin time exceptions queue for reviewing and resolving clock event issues
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, User, CheckCircle, Calendar, PlayCircle, StopCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ClockEvent {
  id: string;
  driverId: string;
  shiftId: string | null;
  type: "IN" | "OUT";
  timestamp: string;
  source: "USER" | "AUTO" | "ADMIN_EDIT";
  notes: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedNotes: string | null;
}

interface EnrichedClockEvent extends ClockEvent {
  driverName: string;
  shiftDate: string | null;
  shiftType: string | null;
}

export default function AdminTimeExceptions() {
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<EnrichedClockEvent | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: unresolvedEvents, isLoading, error } = useQuery<ClockEvent[]>({
    queryKey: ["/api/admin/clock-events/unresolved"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: allUsers, error: usersError } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/admin/clock-events/${id}/resolve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clock-events/unresolved"] });
      setSelectedEvent(null);
      setResolveNotes("");
      toast({
        title: "Event Resolved",
        description: "Clock event has been marked as resolved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve clock event",
        variant: "destructive",
      });
    },
  });

  const autoClockoutMutation = useMutation({
    mutationFn: async (graceHours?: number) => {
      return await apiRequest("POST", "/api/admin/auto-clockout", { graceHours });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clock-events/unresolved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      toast({
        title: "Auto-Clockout Complete",
        description: data.message || `Processed ${data.processed} orphaned shift(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run auto-clockout",
        variant: "destructive",
      });
    },
  });

  // Fetch shift details for each event's shiftId
  const shiftQueries = useQuery({
    queryKey: ["/api/admin/shifts-for-events", unresolvedEvents],
    queryFn: async () => {
      if (!unresolvedEvents || unresolvedEvents.length === 0) return new Map();
      
      const shiftMap = new Map();
      const uniqueShiftIds = Array.from(new Set(unresolvedEvents.filter(e => e.shiftId).map(e => e.shiftId)));
      
      for (const shiftId of uniqueShiftIds) {
        const response = await fetch(`/api/admin/shifts/${shiftId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch shift ${shiftId}: ${response.statusText}`);
        }
        const shift = await response.json();
        shiftMap.set(shiftId, shift);
      }
      
      return shiftMap;
    },
    enabled: !!unresolvedEvents && unresolvedEvents.length > 0,
    retry: 2, // Retry failed requests twice
  });

  // Handle users error with useEffect to prevent repeated toasts
  useEffect(() => {
    if (usersError) {
      toast({
        title: "Warning",
        description: "Failed to load user data. Driver names may not display correctly.",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  // Handle shift query error with useEffect
  useEffect(() => {
    if (shiftQueries.error) {
      toast({
        title: "Warning",
        description: "Failed to load some shift data. Context may be incomplete.",
        variant: "destructive",
      });
    }
  }, [shiftQueries.error, toast]);

  // Handle errors with UI feedback
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="title-exceptions">
            Time Exceptions Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and resolve unresolved clock events
          </p>
        </div>
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Exceptions</AlertTitle>
          <AlertDescription>
            {(error as any).message || "Failed to load unresolved clock events. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Enrich events with driver and shift information
  const enrichedEvents: EnrichedClockEvent[] = (unresolvedEvents || []).map((event) => {
    const user = allUsers?.find((u) => u.id === event.driverId);
    const shift = event.shiftId ? shiftQueries.data?.get(event.shiftId) : null;
    
    return {
      ...event,
      driverName: user ? `${user.firstName} ${user.lastName}` : "Unknown Driver",
      shiftDate: shift?.date || null,
      shiftType: shift?.shiftType || null,
    };
  });

  const handleResolve = (event: EnrichedClockEvent) => {
    setSelectedEvent(event);
    setResolveNotes("");
  };

  const submitResolve = () => {
    if (selectedEvent) {
      resolveMutation.mutate({
        id: selectedEvent.id,
        notes: resolveNotes,
      });
    }
  };

  if (isLoading || shiftQueries.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="title-exceptions">
            Time Exceptions Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and resolve unresolved clock events
          </p>
        </div>
        <Button
          onClick={() => autoClockoutMutation.mutate(2)}
          disabled={autoClockoutMutation.isPending}
          data-testid="button-auto-clockout"
        >
          {autoClockoutMutation.isPending ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Run Auto-Clockout
            </>
          )}
        </Button>
      </div>

      {enrichedEvents.length === 0 ? (
        <Card data-testid="card-no-exceptions">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">All Clear!</h3>
            <p className="text-sm text-muted-foreground">
              There are no unresolved clock events at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="destructive" data-testid="alert-unresolved-count">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{enrichedEvents.length} Unresolved Event(s)</AlertTitle>
          <AlertDescription>
            These clock events require admin attention. Review each one and mark as resolved after addressing.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {enrichedEvents.map((event) => (
          <Card key={event.id} data-testid={`event-card-${event.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  {event.type === "IN" ? (
                    <PlayCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <StopCircle className="h-5 w-5 text-red-600" />
                  )}
                  <CardTitle className="text-base">
                    Clock {event.type === "IN" ? "In" : "Out"} Event
                  </CardTitle>
                  <Badge 
                    variant="secondary" 
                    className={
                      event.source === "AUTO" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
                      event.source === "ADMIN_EDIT" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                      ""
                    }
                    data-testid={`badge-source-${event.id}`}
                  >
                    {event.source}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleResolve(event)}
                  data-testid={`button-resolve-${event.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Driver</p>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium" data-testid={`text-driver-${event.id}`}>
                      {event.driverName}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Time</p>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span data-testid={`text-time-${event.id}`}>
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Shift Date</p>
                  {event.shiftDate ? (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span data-testid={`text-shift-date-${event.id}`}>
                        {new Date(event.shiftDate + 'T00:00:00').toLocaleDateString()}
                      </span>
                    </div>
                  ) : event.shiftId ? (
                    <span 
                      className="text-xs text-muted-foreground italic" 
                      data-testid={`text-shift-missing-${event.id}`}
                    >
                      Shift data unavailable
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No shift linked</span>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Shift Type</p>
                  {event.shiftType ? (
                    <Badge 
                      variant="outline" 
                      data-testid={`badge-shift-type-${event.id}`}
                    >
                      {event.shiftType}
                    </Badge>
                  ) : event.shiftId ? (
                    <span 
                      className="text-xs text-muted-foreground italic"
                      data-testid={`text-shift-type-missing-${event.id}`}
                    >
                      Unavailable
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
              {event.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p 
                    className="text-sm bg-muted p-2 rounded"
                    data-testid={`text-notes-${event.id}`}
                  >
                    {event.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Clock Event</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Driver:</span> {selectedEvent.driverName}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Event:</span> Clock {selectedEvent.type}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Time:</span> {new Date(selectedEvent.timestamp).toLocaleString()}
                </p>
                {selectedEvent.notes && (
                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground mb-1">Event Notes:</p>
                    <p className="text-sm">{selectedEvent.notes}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolve-notes">Resolution Notes (Optional)</Label>
                <Textarea
                  id="resolve-notes"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Add notes about how this issue was resolved..."
                  rows={4}
                  data-testid="input-resolve-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedEvent(null)}
              data-testid="button-cancel-resolve"
            >
              Cancel
            </Button>
            <Button
              onClick={submitResolve}
              disabled={resolveMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
