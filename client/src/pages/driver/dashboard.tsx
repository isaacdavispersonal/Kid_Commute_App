// Driver dashboard with shift-based clock-in/out
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, LogIn, LogOut, Timer, Calendar, AlertCircle, Coffee, Play, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
      const diff = Math.floor((now - start) / 1000);

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setElapsed(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

interface EnrichedShift {
  id: string;
  driverId: string;
  routeId: string | null;
  vehicleId: string | null;
  date: string;
  shiftType: "MORNING" | "AFTERNOON" | "EXTRA";
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "MISSED";
  plannedStart: string;
  plannedEnd: string;
  notes: string | null;
  routeName: string;
  vehicleName: string;
  vehiclePlate: string;
  clockEvents: Array<{
    id: string;
    type: "IN" | "OUT";
    timestamp: string;
    source: string;
  }>;
}

const SHIFT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MORNING: { label: "Morning", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  AFTERNOON: { label: "Afternoon", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  EXTRA: { label: "Extra", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
};

function ShiftCard({ shift }: { shift: EnrichedShift }) {
  const { toast } = useToast();
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [clockOutNotes, setClockOutNotes] = useState("");
  
  const lastClockEvent = shift.clockEvents[shift.clockEvents.length - 1];
  const isClockedIn = lastClockEvent?.type === "IN";
  const elapsedTime = useElapsedTime(isClockedIn ? lastClockEvent.timestamp : null);
  const isUnscheduledShift = shift.routeId === null;

  // Fetch active break status
  const { data: breakStatus } = useQuery<{ activeBreak: any }>({
    queryKey: ["/api/driver/break/status"],
    enabled: isClockedIn, // Only fetch when clocked in
    refetchInterval: 5000, // Refetch every 5 seconds when clocked in
  });

  const isOnBreak = breakStatus?.activeBreak !== null;

  const clockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/driver/shifts/${shift.id}/clock-in`, {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/today-shifts"] });
      toast({
        title: "Clocked In",
        description: `Clocked in for ${SHIFT_TYPE_LABELS[shift.shiftType].label} shift`,
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
        description: (error as any).message || "Failed to clock in",
        variant: "destructive",
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (notes?: string) => {
      return await apiRequest("POST", `/api/driver/shifts/${shift.id}/clock-out`, {
        notes: notes || undefined
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/today-shifts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/break/status"] });
      setShowNotesDialog(false);
      setClockOutNotes("");
      toast({
        title: "Clocked Out",
        description: `Clocked out from ${SHIFT_TYPE_LABELS[shift.shiftType].label} shift`,
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
        description: (error as any).message || "Failed to clock out",
        variant: "destructive",
      });
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/break/start", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/break/status"] });
      toast({
        title: "Break Started",
        description: "Your break has been recorded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to start break",
        variant: "destructive",
      });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/break/end", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/break/status"] });
      toast({
        title: "Break Ended",
        description: "Back to work",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to end break",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card 
        className={isClockedIn ? "border-primary/50 bg-gradient-to-br from-card to-primary/5" : ""}
        data-testid={`shift-card-${shift.id}`}
      >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge 
              className={SHIFT_TYPE_LABELS[shift.shiftType].color}
              data-testid={`badge-shift-type-${shift.id}`}
            >
              {SHIFT_TYPE_LABELS[shift.shiftType].label}
            </Badge>
            {shift.status === "ACTIVE" && (
              <StatusBadge 
                status="active" 
                className="text-xs" 
                data-testid={`status-shift-${shift.id}`}
              />
            )}
            {shift.status === "COMPLETED" && (
              <StatusBadge 
                status="offline" 
                className="text-xs" 
                data-testid={`status-shift-${shift.id}`}
              />
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span data-testid={`text-shift-time-${shift.id}`}>
              {shift.plannedStart} - {shift.plannedEnd}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span 
              className="font-medium" 
              data-testid={`text-route-name-${shift.id}`}
            >
              {shift.routeName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span data-testid={`text-vehicle-${shift.id}`}>
              {shift.vehicleName} - {shift.vehiclePlate}
            </span>
          </div>
        </div>

        {isClockedIn && (
          <div className={`p-3 rounded-md border ${isOnBreak ? "bg-orange-500/10 border-orange-500/20" : "bg-primary/10 border-primary/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {isOnBreak ? "On Break" : "Elapsed Time"}
                </p>
                <p 
                  className={`text-xl font-bold font-mono ${isOnBreak ? "text-orange-600 dark:text-orange-400" : "text-primary"}`}
                  data-testid={`elapsed-time-${shift.id}`}
                >
                  {elapsedTime}
                </p>
              </div>
              {isOnBreak ? (
                <Coffee className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <Timer className="h-5 w-5 text-primary" />
              )}
            </div>
          </div>
        )}

        {shift.clockEvents.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Clock Events</p>
            {shift.clockEvents.slice(-3).map((event) => (
              <div 
                key={event.id} 
                className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                data-testid={`clock-event-${event.id}`}
              >
                <span className={event.type === "IN" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {event.type === "IN" ? "Clock In" : "Clock Out"}
                </span>
                <span className="text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {isClockedIn ? (
            <>
              <Button
                variant={isOnBreak ? "default" : "outline"}
                onClick={() => {
                  if (isOnBreak) {
                    endBreakMutation.mutate();
                  } else {
                    startBreakMutation.mutate();
                  }
                }}
                disabled={startBreakMutation.isPending || endBreakMutation.isPending}
                data-testid={`button-break-${shift.id}`}
              >
                {startBreakMutation.isPending || endBreakMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    {isOnBreak ? "Ending..." : "Starting..."}
                  </>
                ) : isOnBreak ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    End Break
                  </>
                ) : (
                  <>
                    <Coffee className="h-4 w-4 mr-2" />
                    Start Break
                  </>
                )}
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => {
                  if (isUnscheduledShift) {
                    setShowNotesDialog(true);
                  } else {
                    clockOutMutation.mutate(undefined);
                  }
                }}
                disabled={clockOutMutation.isPending}
                data-testid={`button-clock-out-${shift.id}`}
              >
                {clockOutMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Clocking Out...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-2" />
                    Clock Out
                  </>
                )}
              </Button>
            </>
          ) : shift.status !== "COMPLETED" ? (
            <Button
              className="flex-1"
              onClick={() => clockInMutation.mutate()}
              disabled={clockInMutation.isPending}
              data-testid={`button-clock-in-${shift.id}`}
            >
              {clockInMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Clocking In...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Clock In
                </>
              )}
            </Button>
          ) : (
            <div 
              className="flex-1 text-center text-sm text-muted-foreground py-2"
              data-testid={`text-completed-${shift.id}`}
            >
              Shift Completed
            </div>
          )}
        </div>
      </CardContent>
      </Card>

      {/* Notes Dialog for Unscheduled Shift Clock-Out */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent data-testid="dialog-unscheduled-notes">
          <DialogHeader>
            <DialogTitle>Clock Out - Add Notes</DialogTitle>
            <DialogDescription>
              Please provide notes about the work completed during this unscheduled shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Describe the work performed, locations visited, issues encountered, etc."
                value={clockOutNotes}
                onChange={(e) => setClockOutNotes(e.target.value)}
                rows={4}
                data-testid="textarea-clockout-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNotesDialog(false);
                setClockOutNotes("");
              }}
              data-testid="button-cancel-notes"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!clockOutNotes.trim()) {
                  toast({
                    title: "Notes Required",
                    description: "Please add notes before clocking out of an unscheduled shift.",
                    variant: "destructive",
                  });
                  return;
                }
                clockOutMutation.mutate(clockOutNotes);
              }}
              disabled={clockOutMutation.isPending}
              data-testid="button-confirm-clockout"
            >
              {clockOutMutation.isPending ? "Clocking Out..." : "Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DriverDashboard() {
  const { toast } = useToast();
  
  const { data: todayShifts, isLoading, error } = useQuery<EnrichedShift[]>({
    queryKey: ["/api/driver/today-shifts"],
  });

  const unscheduledClockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/clock-in-unscheduled", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/today-shifts"] });
      toast({
        title: "Clocked In",
        description: "Created unscheduled shift and clocked in successfully",
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
        description: (error as any).message || "Failed to clock in for unscheduled shift",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error && !isUnauthorizedError(error as Error)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="title-dashboard">
            Driver Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your shifts and clock in/out for each shift
          </p>
        </div>

        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Shifts</AlertTitle>
          <AlertDescription>
            {(error as any).message || "Failed to load today's shifts. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sortedShifts = todayShifts?.sort((a, b) => {
    const order = { MORNING: 0, AFTERNOON: 1, EXTRA: 2 };
    const typeOrder = order[a.shiftType] - order[b.shiftType];
    if (typeOrder !== 0) return typeOrder;
    return a.plannedStart.localeCompare(b.plannedStart);
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1" data-testid="title-dashboard">
          Driver Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your shifts and clock in/out for each shift
        </p>
      </div>

      <IncompleteProfileBanner />

      <div className="flex items-center gap-2 p-4 rounded-md bg-muted/30 border">
        <Calendar className="h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Today's Shifts</p>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Unscheduled Clock In Card */}
        <Card className="border-dashed" data-testid="card-unscheduled-shift">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Unscheduled Shift</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Clock in for work not on your schedule
                </p>
              </div>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                Extra
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => unscheduledClockInMutation.mutate()}
              disabled={unscheduledClockInMutation.isPending}
              data-testid="button-clock-in-unscheduled"
            >
              {unscheduledClockInMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Creating Shift...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Clock In (Unscheduled)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Scheduled Shifts */}
        {sortedShifts.length > 0 ? (
          <div className="grid gap-4">
            {sortedShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        ) : (
          <Card data-testid="card-no-shifts">
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Scheduled Shifts</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any scheduled shifts for today. Use the unscheduled clock-in above if you need to work.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Feedback Floating Action Button */}
      <Link href="/driver/feedback">
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl z-50"
          data-testid="button-quick-feedback"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
