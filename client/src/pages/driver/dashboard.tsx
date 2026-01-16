// Driver dashboard with simple clock-in/out and separate route starting
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, LogIn, LogOut, Timer, Calendar, AlertCircle, Coffee, Play, MessageSquare, CheckCircle, Truck, ClipboardCheck } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/lib/config";
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
import { Checkbox } from "@/components/ui/checkbox";
import { EmergencyButton } from "@/components/emergency-button";
import { PullToRefresh } from "@/components/pull-to-refresh";

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
  inspectionCompletedAt: string | null;
  routeStartedAt: string | null;
  routeName: string;
  vehicleName: string;
  vehiclePlate: string;
}

interface ClockStatus {
  isClockedIn: boolean;
  clockInTime: string | null;
  isOnBreak: boolean;
  breakStartTime: string | null;
}

const SHIFT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MORNING: { label: "AM", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  AFTERNOON: { label: "PM", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  EXTRA: { label: "Extra", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
};

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRE_TRIP_INSPECTION_ITEMS = [
  { key: 'headTailBrakeLightsOk', label: 'Head, Tail, Brake & Clearance Lights', category: 'Lights' },
  { key: 'turnSignalHazardOk', label: 'Turn Signals & Hazard Lights', category: 'Lights' },
  { key: 'interiorLightsOk', label: 'Interior Lights', category: 'Lights' },
  { key: 'tiresOk', label: 'Tires (inflation, tread, damage, lug nuts)', category: 'Exterior' },
  { key: 'undercarriageLeaksOk', label: 'No Undercarriage Leaks', category: 'Exterior' },
  { key: 'windshieldWipersFluidOk', label: 'Windshield Wipers & Fluid', category: 'Exterior' },
  { key: 'windshieldConditionOk', label: 'Windshield Condition (no cracks/pits)', category: 'Exterior' },
  { key: 'mirrorsOk', label: 'Mirrors (secure, not cracked)', category: 'Exterior' },
  { key: 'newBodyDamage', label: 'No New Body Damage', category: 'Exterior', inverted: true },
  { key: 'doorsConditionOk', label: 'Doors Open/Close Properly', category: 'Exterior' },
  { key: 'driverPassengerAreaOk', label: 'Driver & Passenger Area Clean', category: 'Interior' },
  { key: 'gaugesSwitchesControlsOk', label: 'Gauges, Switches & Controls Working', category: 'Interior' },
  { key: 'acPerformanceOk', label: 'AC Performance', category: 'Interior' },
  { key: 'heatPerformanceOk', label: 'Heat Performance', category: 'Interior' },
  { key: 'backSeatConditionOk', label: 'Back Seats (secured, no damage)', category: 'Interior' },
  { key: 'seatbeltsOk', label: 'Seatbelts (working, no damage)', category: 'Interior' },
  { key: 'emergencyEquipmentOk', label: 'Safety Equipment (fire extinguisher, triangles, first aid, seatbelt cutter)', category: 'Safety' },
];

function VehicleInspectionDialog({ 
  open, 
  onOpenChange, 
  shift,
  onComplete 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: EnrichedShift;
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [beginningMileage, setBeginningMileage] = useState("");
  const [notes, setNotes] = useState("");

  const allChecksComplete = PRE_TRIP_INSPECTION_ITEMS.every(item => checks[item.key] === true) && beginningMileage.trim() !== "";

  const completeInspectionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/driver/shift/${shift.id}/complete-inspection`, {
        ...checks,
        beginningMileage: parseInt(beginningMileage, 10),
        notes,
        checklistType: "PRE_TRIP",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/today-shifts"] });
      toast({
        title: "Pre-Trip Inspection Complete",
        description: "Vehicle inspection completed successfully",
      });
      onComplete();
      onOpenChange(false);
      setChecks({});
      setBeginningMileage("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to complete inspection",
        variant: "destructive",
      });
    },
  });

  const categories = Array.from(new Set(PRE_TRIP_INSPECTION_ITEMS.map(item => item.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]" data-testid="dialog-vehicle-inspection">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pre-Trip Inspection
          </DialogTitle>
          <DialogDescription>
            Complete inspection for {shift.vehicleName} ({shift.vehiclePlate})
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="beginning-mileage" className="text-sm font-semibold">
                Beginning Mileage <span className="text-destructive">*</span>
              </Label>
              <Input
                id="beginning-mileage"
                type="number"
                placeholder="Enter current odometer reading"
                value={beginningMileage}
                onChange={(e) => setBeginningMileage(e.target.value)}
                data-testid="input-beginning-mileage"
              />
            </div>

            {categories.map(category => (
              <div key={category} className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">{category}</h4>
                {PRE_TRIP_INSPECTION_ITEMS.filter(item => item.category === category).map(({ key, label }) => (
                  <div key={key} className="flex items-start space-x-2">
                    <Checkbox
                      id={key}
                      checked={checks[key] || false}
                      onCheckedChange={(checked) => 
                        setChecks(prev => ({ ...prev, [key]: checked === true }))
                      }
                      data-testid={`checkbox-${key}`}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={key}
                      className="text-sm leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="inspection-notes">Notes (Optional)</Label>
              <Textarea
                id="inspection-notes"
                placeholder="Add any concerns or observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                data-testid="textarea-inspection-notes"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-inspection"
          >
            Cancel
          </Button>
          <Button
            onClick={() => completeInspectionMutation.mutate()}
            disabled={!allChecksComplete || completeInspectionMutation.isPending}
            data-testid="button-complete-inspection"
          >
            {completeInspectionMutation.isPending ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Inspection
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftCard({ shift, clockStatus }: { shift: EnrichedShift; clockStatus: ClockStatus | undefined }) {
  const { toast } = useToast();
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const isRouteStarted = !!shift.routeStartedAt;
  const isInspectionComplete = !!shift.inspectionCompletedAt;
  const isActive = shift.status === "ACTIVE";
  const isCompleted = shift.status === "COMPLETED";

  const startRouteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/driver/shift/${shift.id}/start-route`, {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/today-shifts"] });
      toast({
        title: "Route Started",
        description: "You can now begin route operations",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to start route",
        variant: "destructive",
      });
    },
  });

  const handleStartRoute = () => {
    // Guard: Cannot start route without a routeId
    if (!shift.routeId) {
      toast({
        title: "No Route Assigned",
        description: "This shift does not have an assigned route",
        variant: "destructive",
      });
      return;
    }

    if (!clockStatus?.isClockedIn) {
      toast({
        title: "Clock In Required",
        description: "You must clock in before starting a route",
        variant: "destructive",
      });
      return;
    }

    if (!isInspectionComplete) {
      // Show inspection dialog
      setShowInspectionDialog(true);
    } else {
      // Inspection already complete, just start route
      startRouteMutation.mutate();
    }
  };

  const handleInspectionComplete = () => {
    // After inspection is complete, automatically start the route
    startRouteMutation.mutate();
  };

  return (
    <>
      <Card 
        className={isActive ? "border-primary/50 bg-gradient-to-br from-card to-primary/5" : ""}
        data-testid={`shift-card-${shift.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                className={SHIFT_TYPE_LABELS[shift.shiftType].color}
                data-testid={`badge-shift-type-${shift.id}`}
              >
                {SHIFT_TYPE_LABELS[shift.shiftType].label}
              </Badge>
              {isActive && (
                <StatusBadge 
                  status="active" 
                  className="text-xs" 
                  data-testid={`status-shift-${shift.id}`}
                />
              )}
              {isCompleted && (
                <StatusBadge 
                  status="offline" 
                  className="text-xs" 
                  data-testid={`status-shift-${shift.id}`}
                />
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span data-testid={`text-shift-time-${shift.id}`} className="whitespace-nowrap">
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
              <Truck className="h-4 w-4" />
              <span data-testid={`text-vehicle-${shift.id}`}>
                {shift.vehicleName} - {shift.vehiclePlate}
              </span>
            </div>
          </div>

          {/* Inspection Status */}
          {!isCompleted && (
            <div className={`p-3 rounded-md border ${isInspectionComplete ? "bg-green-500/10 border-green-500/20" : "bg-muted/50 border-muted"}`}>
              <div className="flex items-center gap-2">
                {isInspectionComplete ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Inspection Complete
                    </span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Inspection Required
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Route Status */}
          {isRouteStarted && !isCompleted && (
            <div className="p-3 rounded-md border bg-primary/10 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Route Active</p>
                  <p className="text-sm font-medium text-primary">
                    Operations in progress
                  </p>
                </div>
                <Play className="h-5 w-5 text-primary" />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {!isCompleted && !isRouteStarted ? (
              shift.routeId ? (
                <Button
                  className="flex-1"
                  onClick={handleStartRoute}
                  disabled={!clockStatus?.isClockedIn || startRouteMutation.isPending}
                  data-testid={`button-start-route-${shift.id}`}
                >
                  {startRouteMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Route
                    </>
                  )}
                </Button>
              ) : (
                <div 
                  className="flex-1 text-center text-sm text-muted-foreground py-2 border border-dashed rounded-md"
                  data-testid={`text-no-route-${shift.id}`}
                >
                  No route assigned
                </div>
              )
            ) : isRouteStarted && !isCompleted ? (
              <Link href={`/driver/route/${shift.id}`} className="flex-1">
                <Button className="w-full" data-testid={`button-manage-route-${shift.id}`}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Manage Route
                </Button>
              </Link>
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

      <VehicleInspectionDialog
        open={showInspectionDialog}
        onOpenChange={setShowInspectionDialog}
        shift={shift}
        onComplete={handleInspectionComplete}
      />
    </>
  );
}

export default function DriverDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [clockOutNotes, setClockOutNotes] = useState("");
  
  const { data: clockStatus, isLoading: clockStatusLoading } = useQuery<ClockStatus>({
    queryKey: ["/api/driver/clock-status"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: todayShifts, isLoading: shiftsLoading, error } = useQuery<EnrichedShift[]>({
    queryKey: ["/api/driver/today-shifts"],
  });

  const { data: breakStatus } = useQuery<{ activeBreak: any }>({
    queryKey: ["/api/driver/break/status"],
    enabled: clockStatus?.isClockedIn,
    refetchInterval: 5000,
  });

  const isOnBreak = breakStatus?.activeBreak !== null;
  const elapsedTime = useElapsedTime(clockStatus?.isClockedIn ? clockStatus.clockInTime : null);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/clock-in", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/clock-status"] });
      toast({
        title: "Clocked In",
        description: "You are now clocked in",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to clock in",
        variant: "destructive",
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (notes?: string) => {
      return await apiRequest("POST", "/api/driver/clock-out", {
        notes: notes || undefined
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/clock-status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/break/status"] });
      setShowClockOutDialog(false);
      setClockOutNotes("");
      toast({
        title: "Clocked Out",
        description: "You are now clocked out",
      });
    },
    onError: (error: Error) => {
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

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = getLoginUrl();
      }, 500);
    }
  }, [error, toast]);

  if (clockStatusLoading || shiftsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24" />
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
            Manage your shifts and routes
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
    <PullToRefresh queryKeys={[["/api/driver/shifts/today"], ["/api/driver/clock-status"]]}>
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-semibold" data-testid="title-dashboard">
            Driver Dashboard
          </h1>
          {user?.isLeadDriver && (
            <Badge variant="default" className="bg-primary" data-testid="badge-lead-driver">
              Lead Driver
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Clock in/out and manage your route operations
        </p>
      </div>

      <IncompleteProfileBanner />

      {/* Clock Status Card */}
      <Card className={clockStatus?.isClockedIn ? "border-primary/50 bg-gradient-to-br from-card to-primary/5" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clockStatus?.isClockedIn ? (
            <>
              <div className={`p-3 rounded-md border ${isOnBreak ? "bg-orange-500/10 border-orange-500/20" : "bg-primary/10 border-primary/20"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isOnBreak ? "On Break" : "Clocked In"}
                    </p>
                    <p 
                      className={`text-2xl font-bold font-mono ${isOnBreak ? "text-orange-600 dark:text-orange-400" : "text-primary"}`}
                      data-testid="elapsed-time"
                    >
                      {elapsedTime}
                    </p>
                  </div>
                  {isOnBreak ? (
                    <Coffee className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Timer className="h-6 w-6 text-primary" />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  variant={isOnBreak ? "default" : "outline"}
                  onClick={() => {
                    if (isOnBreak) {
                      endBreakMutation.mutate();
                    } else {
                      startBreakMutation.mutate();
                    }
                  }}
                  disabled={startBreakMutation.isPending || endBreakMutation.isPending}
                  data-testid="button-break-toggle"
                >
                  {startBreakMutation.isPending || endBreakMutation.isPending ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : isOnBreak ? (
                    <Play className="h-4 w-4 mr-2" />
                  ) : (
                    <Coffee className="h-4 w-4 mr-2" />
                  )}
                  {isOnBreak ? "End Break" : "Start Break"}
                </Button>
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={() => setShowClockOutDialog(true)}
                  disabled={clockOutMutation.isPending}
                  data-testid="button-clock-out"
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
              </div>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={() => clockInMutation.mutate()}
              disabled={clockInMutation.isPending}
              data-testid="button-clock-in"
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
          )}
        </CardContent>
      </Card>

      {/* Today's Date */}
      <div className="flex items-center gap-2 p-4 rounded-md bg-muted/30 border">
        <Calendar className="h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Today's Shifts</p>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Scheduled Shifts */}
      <div className="space-y-4">
        {sortedShifts.length > 0 ? (
          <div className="grid gap-4">
            {sortedShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} clockStatus={clockStatus} />
            ))}
          </div>
        ) : (
          <Card data-testid="card-no-shifts">
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Scheduled Shifts</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any scheduled shifts for today.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Emergency Button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Safety</CardTitle>
        </CardHeader>
        <CardContent>
          <EmergencyButton />
        </CardContent>
      </Card>

      {/* Clock Out Notes Dialog */}
      <Dialog open={showClockOutDialog} onOpenChange={setShowClockOutDialog}>
        <DialogContent data-testid="dialog-clockout-notes">
          <DialogHeader>
            <DialogTitle>Clock Out</DialogTitle>
            <DialogDescription>
              Add any notes about your shift (optional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clockout-notes">Notes (Optional)</Label>
              <Textarea
                id="clockout-notes"
                placeholder="Add any notes about your shift..."
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
                setShowClockOutDialog(false);
                setClockOutNotes("");
              }}
              data-testid="button-cancel-clockout"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
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
    </div>
    </PullToRefresh>
  );
}
