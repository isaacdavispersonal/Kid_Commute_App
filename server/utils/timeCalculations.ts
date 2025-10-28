// Time calculation utilities for shift and payroll reporting
import type { ClockEvent, Shift } from "@shared/schema";

export interface ShiftHours {
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

export interface DailyHours {
  date: string;
  totalPlannedHours: number;
  totalActualHours: number;
  shifts: ShiftHours[];
}

export interface DriverPayrollSummary {
  driverId: string;
  startDate: string;
  endDate: string;
  totalPlannedHours: number;
  totalActualHours: number;
  totalShifts: number;
  completedShifts: number;
  missedShifts: number;
  dailyBreakdown: DailyHours[];
}

/**
 * Calculate hours worked for a single shift based on clock events
 * Handles multiple punch segments (e.g., lunch breaks, multiple clock-ins)
 * Caps orphaned clock-ins at shift planned end time + grace period
 */
export function calculateShiftHours(shift: Shift, clockEvents: ClockEvent[], graceHours: number = 2): ShiftHours {
  // Sort clock events by timestamp
  const sortedEvents = clockEvents.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Parse all IN/OUT pairs
  const punchSegments: Array<{ clockIn: Date; clockOut: Date | null; hours: number }> = [];
  let currentIn: ClockEvent | null = null;
  let firstClockIn: Date | null = null;
  let lastClockOut: Date | null = null;

  // Calculate shift end time + grace period (for capping orphaned clock-ins)
  const shiftEndDateTime = new Date(`${shift.date}T${shift.plannedEnd}`);
  const graceEndTime = new Date(shiftEndDateTime.getTime() + graceHours * 60 * 60 * 1000);

  for (const event of sortedEvents) {
    if (event.type === "IN") {
      if (currentIn) {
        // Already have an IN without OUT - duplicate IN (data quality issue)
        // Close the previous segment at this new IN's timestamp (not at grace end)
        const clockInTime = new Date(currentIn.timestamp);
        const implicitClockOut = new Date(event.timestamp);
        const segmentHours = (implicitClockOut.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        
        punchSegments.push({
          clockIn: clockInTime,
          clockOut: implicitClockOut,
          hours: Number(Math.max(0, segmentHours).toFixed(2)),
        });
        
        lastClockOut = implicitClockOut;
      }
      currentIn = event;
      if (!firstClockIn) {
        firstClockIn = new Date(event.timestamp);
      }
    } else if (event.type === "OUT") {
      if (currentIn) {
        // Matched pair
        const clockInTime = new Date(currentIn.timestamp);
        const clockOutTime = new Date(event.timestamp);
        const segmentHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        
        punchSegments.push({
          clockIn: clockInTime,
          clockOut: clockOutTime,
          hours: Number(Math.max(0, segmentHours).toFixed(2)),
        });
        
        lastClockOut = clockOutTime;
        currentIn = null;
      }
      // If OUT without IN, ignore it (orphaned OUT)
    }
  }

  // Handle orphaned IN (still clocked in)
  if (currentIn) {
    const clockInTime = new Date(currentIn.timestamp);
    const now = new Date();
    
    // Cap orphaned clock-in at the grace end time, not "now"
    const effectiveEnd = now < graceEndTime ? now : graceEndTime;
    const segmentHours = (effectiveEnd.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    
    punchSegments.push({
      clockIn: clockInTime,
      clockOut: null, // Still in progress or orphaned
      hours: Number(Math.max(0, segmentHours).toFixed(2)),
    });
  }

  // Calculate total actual hours from all segments
  const actualHours = punchSegments.reduce((sum, segment) => sum + segment.hours, 0);

  // Calculate planned hours
  const plannedStart = new Date(`${shift.date}T${shift.plannedStart}`);
  const plannedEnd = new Date(`${shift.date}T${shift.plannedEnd}`);
  const plannedHours = (plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60);

  // Determine status
  let status: ShiftHours["status"] = "missing_clockin";
  
  if (punchSegments.length === 0) {
    status = "missing_clockin";
  } else if (currentIn) {
    // Last segment has no clock-out
    status = "missing_clockout";
  } else if (punchSegments.length > 0 && punchSegments.every(s => s.clockOut !== null)) {
    // All segments have clock-outs
    status = "complete";
  } else {
    status = "in_progress";
  }

  return {
    shiftId: shift.id,
    date: shift.date,
    shiftType: shift.shiftType,
    plannedHours: Number(plannedHours.toFixed(2)),
    actualHours: Number(actualHours.toFixed(2)),
    clockInTime: firstClockIn,
    clockOutTime: lastClockOut,
    status,
    punchSegments,
  };
}

/**
 * Group shifts by date and calculate daily totals
 */
export function calculateDailyHours(shifts: Shift[], allClockEvents: Map<string, ClockEvent[]>, graceHours: number = 2): DailyHours[] {
  const dailyMap = new Map<string, ShiftHours[]>();

  // Group shifts by date and calculate hours for each
  for (const shift of shifts) {
    const clockEvents = allClockEvents.get(shift.id) || [];
    const shiftHours = calculateShiftHours(shift, clockEvents, graceHours);

    if (!dailyMap.has(shift.date)) {
      dailyMap.set(shift.date, []);
    }
    dailyMap.get(shift.date)!.push(shiftHours);
  }

  // Calculate daily totals
  const dailyHours: DailyHours[] = [];
  for (const [date, shifts] of Array.from(dailyMap.entries())) {
    const totalPlannedHours = shifts.reduce((sum: number, s: ShiftHours) => sum + s.plannedHours, 0);
    const totalActualHours = shifts.reduce((sum: number, s: ShiftHours) => {
      // Only count complete shifts in daily totals
      return sum + (s.status === "complete" ? s.actualHours : 0);
    }, 0);

    dailyHours.push({
      date,
      totalPlannedHours: Number(totalPlannedHours.toFixed(2)),
      totalActualHours: Number(totalActualHours.toFixed(2)),
      shifts: shifts.sort((a: ShiftHours, b: ShiftHours) => a.shiftType.localeCompare(b.shiftType)),
    });
  }

  // Sort by date
  return dailyHours.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate comprehensive payroll summary for a driver over a date range
 */
export function generatePayrollSummary(
  driverId: string,
  shifts: Shift[],
  allClockEvents: Map<string, ClockEvent[]>,
  startDate: string,
  endDate: string,
  graceHours: number = 2
): DriverPayrollSummary {
  const dailyHours = calculateDailyHours(shifts, allClockEvents, graceHours);

  const totalPlannedHours = dailyHours.reduce((sum, d) => sum + d.totalPlannedHours, 0);
  const totalActualHours = dailyHours.reduce((sum, d) => sum + d.totalActualHours, 0);

  const allShiftHours = dailyHours.flatMap(d => d.shifts);
  const completedShifts = allShiftHours.filter(s => s.status === "complete").length;
  const missedShifts = shifts.filter(s => s.status === "MISSED").length;

  return {
    driverId,
    startDate,
    endDate,
    totalPlannedHours: Number(totalPlannedHours.toFixed(2)),
    totalActualHours: Number(totalActualHours.toFixed(2)),
    totalShifts: shifts.length,
    completedShifts,
    missedShifts,
    dailyBreakdown: dailyHours,
  };
}

/**
 * Format hours as HH:MM string
 */
export function formatHoursAsTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Calculate overtime hours based on a threshold (e.g., 40 hours/week)
 */
export function calculateOvertime(actualHours: number, regularThreshold: number = 40): {
  regularHours: number;
  overtimeHours: number;
} {
  if (actualHours <= regularThreshold) {
    return {
      regularHours: Number(actualHours.toFixed(2)),
      overtimeHours: 0,
    };
  }

  return {
    regularHours: regularThreshold,
    overtimeHours: Number((actualHours - regularThreshold).toFixed(2)),
  };
}
