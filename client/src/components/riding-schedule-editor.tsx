import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const MONDAY = 1;
export const TUESDAY = 2;
export const WEDNESDAY = 4;
export const THURSDAY = 8;
export const FRIDAY = 16;
export const SATURDAY = 32;
export const SUNDAY = 64;

const WEEKDAYS_BITMASK = MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY; // 31

interface DayConfig {
  bit: number;
  label: string;
  testId: string;
}

const DAYS: DayConfig[] = [
  { bit: MONDAY, label: "M", testId: "toggle-day-mon" },
  { bit: TUESDAY, label: "T", testId: "toggle-day-tue" },
  { bit: WEDNESDAY, label: "W", testId: "toggle-day-wed" },
  { bit: THURSDAY, label: "T", testId: "toggle-day-thu" },
  { bit: FRIDAY, label: "F", testId: "toggle-day-fri" },
  { bit: SATURDAY, label: "S", testId: "toggle-day-sat" },
  { bit: SUNDAY, label: "S", testId: "toggle-day-sun" },
];

interface RidingScheduleEditorProps {
  studentId: string;
  routeId: string;
  shiftType: "MORNING" | "AFTERNOON" | "EXTRA";
  currentBitmask?: number;
  onSave?: () => void;
}

export function RidingScheduleEditor({
  studentId,
  routeId,
  shiftType,
  currentBitmask = WEEKDAYS_BITMASK,
  onSave,
}: RidingScheduleEditorProps) {
  const { toast } = useToast();
  const [bitmask, setBitmask] = useState<number>(currentBitmask);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: serviceDays, isLoading } = useQuery<{ serviceDaysBitmask: number }>({
    queryKey: ["/api/students", studentId, "service-days", routeId, shiftType],
    queryFn: async () => {
      const response = await fetch(
        `/api/students/${studentId}/service-days/${routeId}/${shiftType}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          // No rule exists - return default weekdays schedule
          return { serviceDaysBitmask: WEEKDAYS_BITMASK };
        }
        throw new Error("Failed to fetch service days");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (serviceDays?.serviceDaysBitmask !== undefined) {
      setBitmask(serviceDays.serviceDaysBitmask);
      setHasChanges(false);
    }
  }, [serviceDays]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/students/${studentId}/service-days`, {
        routeId,
        shiftType,
        serviceDaysBitmask: bitmask,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/students", studentId, "service-days", routeId, shiftType],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setHasChanges(false);
      toast({
        title: "Schedule Updated",
        description: "Riding schedule has been saved successfully.",
      });
      onSave?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save riding schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleDay = (bit: number) => {
    const newBitmask = bitmask ^ bit;
    setBitmask(newBitmask);
    setHasChanges(true);
  };

  const isDaySelected = (bit: number) => (bitmask & bit) !== 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading schedule...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {DAYS.map((day) => (
          <Button
            key={day.testId}
            type="button"
            variant="outline"
            size="sm"
            className={`w-9 h-9 p-0 toggle-elevate ${
              isDaySelected(day.bit) ? "toggle-elevated bg-primary text-primary-foreground border-primary" : ""
            }`}
            onClick={() => toggleDay(day.bit)}
            data-testid={day.testId}
          >
            {day.label}
          </Button>
        ))}
      </div>
      {hasChanges && (
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-schedule"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Saving...
            </>
          ) : (
            "Save Schedule"
          )}
        </Button>
      )}
    </div>
  );
}
