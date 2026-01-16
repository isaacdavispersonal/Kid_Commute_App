// Driver time history page showing all shifts and calculated hours
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, PlayCircle, StopCircle, TrendingUp, AlertCircle, Edit, X, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { PullToRefresh } from "@/components/pull-to-refresh";

interface ClockEvent {
  id: string;
  type: "IN" | "OUT";
  timestamp: string;
  source: string;
}

interface ShiftHours {
  shiftId: string;
  date: string;
  shiftType: string;
  plannedHours: number;
  actualHours: number;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  status: "complete" | "in_progress" | "missing_clockout" | "missing_clockin";
  punchSegments: Array<{ clockIn: Date; clockOut: Date | null; hours: number }>;
}

interface EnrichedShift {
  id: string;
  driverId: string;
  routeId: string | null;
  vehicleId: string | null;
  date: string;
  shiftType: "MORNING" | "AFTERNOON" | "EXTRA";
  status: string;
  plannedStart: string;
  plannedEnd: string;
  routeName: string;
  vehicleName: string;
  vehiclePlate: string;
  clockEvents: ClockEvent[];
  calculatedHours: ShiftHours;
}

const SHIFT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MORNING: { label: "AM", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  AFTERNOON: { label: "PM", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  EXTRA: { label: "Extra", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  complete: { label: "Complete", variant: "default" },
  in_progress: { label: "In Progress", variant: "secondary" },
  missing_clockout: { label: "Missing Clock Out", variant: "destructive" },
  missing_clockin: { label: "Missing Clock In", variant: "outline" },
};

export default function DriverTimeHistory() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("week");
  const [editingEvent, setEditingEvent] = useState<{ id: string; timestamp: string; type: "IN" | "OUT" } | null>(null);
  const [editedTimestamp, setEditedTimestamp] = useState<string>("");

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "week":
        return {
          startDate: format(subDays(now, 7), "yyyy-MM-dd"),
          endDate: format(now, "yyyy-MM-dd"),
        };
      case "month":
        return {
          startDate: format(subDays(now, 30), "yyyy-MM-dd"),
          endDate: format(now, "yyyy-MM-dd"),
        };
      case "all":
        return {};
      default:
        return {
          startDate: format(subDays(now, 7), "yyyy-MM-dd"),
          endDate: format(now, "yyyy-MM-dd"),
        };
    }
  };

  const range = getDateRange();

  // Fetch shifts with calculated hours - use apiRequest for proper auth on mobile
  const { data: shifts, isLoading, error, refetch } = useQuery<EnrichedShift[]>({
    queryKey: ["/api/driver/shifts", range.startDate, range.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range.startDate) params.append("startDate", range.startDate);
      if (range.endDate) params.append("endDate", range.endDate);
      
      const response = await apiRequest("GET", `/api/driver/shifts?${params.toString()}`);
      return response.json();
    },
  });

  // Edit clock event mutation
  const editClockEventMutation = useMutation({
    mutationFn: async (data: { id: string; timestamp: string }) => {
      const timestampDate = new Date(data.timestamp);
      return await apiRequest("PATCH", `/api/driver/clock-event/${data.id}`, {
        timestamp: timestampDate.toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/shifts"] });
      toast({
        title: "Clock Event Updated",
        description: "Your clock event has been successfully updated",
      });
      setEditingEvent(null);
      setEditedTimestamp("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to update clock event",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (event: ClockEvent) => {
    setEditingEvent({ id: event.id, timestamp: event.timestamp, type: event.type });
    // Format timestamp for datetime-local input
    const date = new Date(event.timestamp);
    const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
    setEditedTimestamp(formatted);
  };

  const handleSaveEdit = () => {
    if (editingEvent && editedTimestamp) {
      editClockEventMutation.mutate({ id: editingEvent.id, timestamp: editedTimestamp });
    }
  };

  // Calculate summary statistics
  const summary = shifts?.reduce(
    (acc, shift) => {
      acc.totalPlannedHours += shift.calculatedHours.plannedHours;
      acc.totalActualHours += shift.calculatedHours.actualHours;
      acc.totalShifts += 1;
      if (shift.calculatedHours.status === "complete") acc.completedShifts += 1;
      return acc;
    },
    { totalPlannedHours: 0, totalActualHours: 0, totalShifts: 0, completedShifts: 0 }
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="title-time-history">
            Time History
          </h1>
          <p className="text-sm text-muted-foreground">
            View your shift history and hours worked
          </p>
        </div>
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Time History</AlertTitle>
          <AlertDescription>
            {(error as any).message || "Failed to load your time history. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { await refetch(); }}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="title-time-history">
            Time History
          </h1>
          <p className="text-sm text-muted-foreground">
            View your shift history and hours worked
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="touch"
            variant={dateRange === "week" ? "default" : "outline"}
            onClick={() => setDateRange("week")}
            data-testid="button-range-week"
          >
            7 Days
          </Button>
          <Button
            size="touch"
            variant={dateRange === "month" ? "default" : "outline"}
            onClick={() => setDateRange("month")}
            data-testid="button-range-month"
          >
            30 Days
          </Button>
          <Button
            size="touch"
            variant={dateRange === "all" ? "default" : "outline"}
            onClick={() => setDateRange("all")}
            data-testid="button-range-all"
          >
            All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-hours">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-hours">
                {summary?.totalActualHours.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                of {summary?.totalPlannedHours.toFixed(2) || "0.00"} planned
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-shifts">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-shifts">
                {summary?.totalShifts || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary?.completedShifts || 0} completed
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-hours">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Hours/Shift</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-hours">
                {summary && summary.totalShifts > 0
                  ? (summary.totalActualHours / summary.totalShifts).toFixed(2)
                  : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">hours per shift</p>
            </CardContent>
          </Card>

          <Card data-testid="card-completion-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <StopCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completion-rate">
                {summary && summary.totalShifts > 0
                  ? Math.round((summary.completedShifts / summary.totalShifts) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">shifts completed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shifts List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Shift History</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : shifts && shifts.length > 0 ? (
          <div className="space-y-3">
            {shifts
              .sort((a, b) => {
                // Find the most recent clock OUT event for each shift
                const aClockOut = [...a.clockEvents].reverse().find(e => e.type === "OUT");
                const bClockOut = [...b.clockEvents].reverse().find(e => e.type === "OUT");
                
                // If both have clock outs, sort by most recent first
                if (aClockOut && bClockOut) {
                  return new Date(bClockOut.timestamp).getTime() - new Date(aClockOut.timestamp).getTime();
                }
                
                // If only one has a clock out, prioritize it
                if (aClockOut && !bClockOut) return -1;
                if (!aClockOut && bClockOut) return 1;
                
                // If neither have clock outs, sort by date (most recent first)
                return b.date.localeCompare(a.date);
              })
              .map((shift) => (
              <Card key={shift.id} data-testid={`card-shift-${shift.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" data-testid={`text-date-${shift.id}`}>
                          {new Date(shift.date + "T00:00:00").toLocaleDateString()}
                        </span>
                        <Badge
                          className={SHIFT_TYPE_LABELS[shift.shiftType].color}
                          data-testid={`badge-shift-type-${shift.id}`}
                        >
                          {SHIFT_TYPE_LABELS[shift.shiftType].label}
                        </Badge>
                        <Badge
                          variant={STATUS_LABELS[shift.calculatedHours.status].variant}
                          data-testid={`badge-status-${shift.id}`}
                        >
                          {STATUS_LABELS[shift.calculatedHours.status].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {shift.routeName} • {shift.vehicleName}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" data-testid={`text-hours-${shift.id}`}>
                        {shift.calculatedHours.actualHours.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">hours</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Clock Events */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Clock Events</p>
                    {shift.clockEvents.length > 0 ? (
                      <div className="space-y-1">
                        {shift.clockEvents.map((event, idx) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded group"
                            data-testid={`event-${event.id}`}
                          >
                            <div className="flex items-center gap-2">
                              {event.type === "IN" ? (
                                <PlayCircle className="h-3 w-3 text-green-600" />
                              ) : (
                                <StopCircle className="h-3 w-3 text-red-600" />
                              )}
                              <span className="font-medium">
                                {event.type === "IN" ? "Clock In" : "Clock Out"}
                              </span>
                              <span data-testid={`text-time-${event.id}`}>
                                {new Date(event.timestamp).toLocaleString()}
                              </span>
                              {event.source === "AUTO" && (
                                <Badge variant="outline" className="text-xs">Auto</Badge>
                              )}
                              {event.source === "AUTO_CLOCKOUT" && (
                                <Badge variant="destructive" className="text-xs">Max Duration</Badge>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEditClick(event)}
                              data-testid={`button-edit-${event.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {/* Summary */}
                        {shift.calculatedHours.punchSegments.length > 0 && (
                          <div className="mt-2 pt-2 border-t text-sm">
                            <div className="flex items-center justify-between font-medium">
                              <span>Total Hours</span>
                              <span data-testid={`text-total-hours-${shift.id}`}>
                                {shift.calculatedHours.actualHours.toFixed(2)}h
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No clock events recorded</p>
                    )}
                  </div>

                  {/* Planned vs Actual */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Planned Hours</p>
                      <p className="font-medium" data-testid={`text-planned-${shift.id}`}>
                        {shift.calculatedHours.plannedHours.toFixed(2)}h
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Actual Hours</p>
                      <p className="font-medium" data-testid={`text-actual-${shift.id}`}>
                        {shift.calculatedHours.actualHours.toFixed(2)}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-shifts">
                No shifts found for the selected time period
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Clock Event Dialog */}
      <Dialog open={editingEvent !== null} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent data-testid="dialog-edit-clock-event">
          <DialogHeader>
            <DialogTitle>Edit Clock Event</DialogTitle>
            <DialogDescription>
              Correct the timestamp for this {editingEvent?.type === "IN" ? "clock in" : "clock out"} event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timestamp">Timestamp</Label>
              <Input
                id="timestamp"
                type="datetime-local"
                value={editedTimestamp}
                onChange={(e) => setEditedTimestamp(e.target.value)}
                data-testid="input-timestamp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEvent(null)}
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editClockEventMutation.isPending}
              data-testid="button-save-edit"
            >
              <Check className="h-4 w-4 mr-2" />
              {editClockEventMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}
