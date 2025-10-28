// Driver time history page showing all shifts and calculated hours
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, PlayCircle, StopCircle, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

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
  MORNING: { label: "Morning", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  AFTERNOON: { label: "Afternoon", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  EXTRA: { label: "Extra", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  complete: { label: "Complete", variant: "default" },
  in_progress: { label: "In Progress", variant: "secondary" },
  missing_clockout: { label: "Missing Clock Out", variant: "destructive" },
  missing_clockin: { label: "Missing Clock In", variant: "outline" },
};

export default function DriverTimeHistory() {
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("week");

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

  // Fetch shifts with calculated hours
  const { data: shifts, isLoading, error } = useQuery<EnrichedShift[]>({
    queryKey: ["/api/driver/shifts", range.startDate, range.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range.startDate) params.append("startDate", range.startDate);
      if (range.endDate) params.append("endDate", range.endDate);
      
      const response = await fetch(`/api/driver/shifts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shifts");
      }
      return response.json();
    },
  });

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
        <div className="flex gap-2">
          <Button
            variant={dateRange === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("week")}
            data-testid="button-range-week"
          >
            Last 7 Days
          </Button>
          <Button
            variant={dateRange === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("month")}
            data-testid="button-range-month"
          >
            Last 30 Days
          </Button>
          <Button
            variant={dateRange === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("all")}
            data-testid="button-range-all"
          >
            All Time
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
            {shifts.map((shift) => (
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
                  {/* Punch Segments */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Clock Events</p>
                    {shift.calculatedHours.punchSegments.length > 0 ? (
                      <div className="space-y-1">
                        {shift.calculatedHours.punchSegments.map((segment, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded"
                            data-testid={`segment-${shift.id}-${idx}`}
                          >
                            <div className="flex items-center gap-2">
                              <PlayCircle className="h-3 w-3 text-green-600" />
                              <span data-testid={`text-clock-in-${shift.id}-${idx}`}>
                                {new Date(segment.clockIn).toLocaleTimeString()}
                              </span>
                              {segment.clockOut ? (
                                <>
                                  <span className="text-muted-foreground">→</span>
                                  <StopCircle className="h-3 w-3 text-red-600" />
                                  <span data-testid={`text-clock-out-${shift.id}-${idx}`}>
                                    {new Date(segment.clockOut).toLocaleTimeString()}
                                  </span>
                                </>
                              ) : (
                                <Badge variant="secondary" className="ml-2">
                                  In Progress
                                </Badge>
                              )}
                            </div>
                            <span
                              className="font-medium"
                              data-testid={`text-segment-hours-${shift.id}-${idx}`}
                            >
                              {segment.hours.toFixed(2)}h
                            </span>
                          </div>
                        ))}
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
    </div>
  );
}
