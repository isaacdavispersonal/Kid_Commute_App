import { storage } from "../storage";
import { db } from "../db";
import { 
  type ClockEvent, 
  type TimesheetEntry, 
  type InsertTimesheetEntry,
  type PayPeriod,
  type Shift,
  timesheetEntries,
} from "@shared/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";

const PHOENIX_TZ = "America/Phoenix";

interface DerivationResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface OvertimeBreakdown {
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
}

function toPhoenixDate(utcDate: Date): string {
  return utcDate.toLocaleDateString("en-US", { 
    timeZone: PHOENIX_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).split("/").reverse().join("-").replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$3-$2");
}

function formatDateYMD(date: Date, timezone: string = PHOENIX_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  
  return `${year}-${month}-${day}`;
}

function calculateDailyOvertimeBreakdown(totalHours: number): OvertimeBreakdown {
  let regularHours = 0;
  let overtimeHours = 0;
  let doubleTimeHours = 0;

  if (totalHours <= 8) {
    regularHours = totalHours;
  } else if (totalHours <= 12) {
    regularHours = 8;
    overtimeHours = totalHours - 8;
  } else {
    regularHours = 8;
    overtimeHours = 4;
    doubleTimeHours = totalHours - 12;
  }

  return {
    regularHours: Number(regularHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    doubleTimeHours: Number(doubleTimeHours.toFixed(2)),
    totalHours: Number(totalHours.toFixed(2)),
  };
}

function calculateHoursFromClockPair(
  clockIn: Date, 
  clockOut: Date | null, 
  breakMinutes: number = 0
): number {
  if (!clockOut) {
    return 0;
  }
  
  const diffMs = clockOut.getTime() - clockIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const breakHours = breakMinutes / 60;
  
  return Math.max(0, diffHours - breakHours);
}

function calculateBreakMinutesFromEvents(events: ClockEvent[]): number {
  let totalBreakMinutes = 0;
  const breakStack: ClockEvent[] = [];

  for (const event of events) {
    if (event.type === "BREAK_START") {
      breakStack.push(event);
    } else if (event.type === "BREAK_END" && breakStack.length > 0) {
      const breakStart = breakStack.pop()!;
      const startTime = new Date(breakStart.timestamp);
      const endTime = new Date(event.timestamp);
      const breakMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      totalBreakMinutes += breakMinutes;
    }
  }

  return Math.round(totalBreakMinutes);
}

export async function checkForOverlappingEntries(
  driverId: string, 
  startTime: Date, 
  endTime: Date | null
): Promise<boolean> {
  // First, check for any existing OPEN entries (no end time) for this driver
  // These always count as overlaps since they represent an unfinished shift
  const existingOpenEntries = await db
    .select()
    .from(timesheetEntries)
    .where(
      and(
        eq(timesheetEntries.driverId, driverId),
        isNull(timesheetEntries.endAtUtc)
      )
    );
  
  if (existingOpenEntries.length > 0) {
    console.log(`[Timesheet] Found ${existingOpenEntries.length} open entries for driver ${driverId}`);
    return true;
  }

  if (endTime) {
    // Check for overlapping closed entries
    const overlappingEntries = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.driverId, driverId),
          or(
            // New entry starts within an existing entry
            and(
              lte(timesheetEntries.startAtUtc, startTime),
              gte(timesheetEntries.endAtUtc, startTime)
            ),
            // New entry ends within an existing entry
            and(
              lte(timesheetEntries.startAtUtc, endTime),
              gte(timesheetEntries.endAtUtc, startTime)
            ),
            // New entry completely contains an existing entry
            and(
              gte(timesheetEntries.startAtUtc, startTime),
              lte(timesheetEntries.endAtUtc, endTime)
            )
          )
        )
      );
    
    return overlappingEntries.length > 0;
  }
  
  // For open entries (no end time), we already checked for existing open entries above
  return false;
}

export async function deriveTimesheetEntryFromClockEvents(
  driverId: string,
  clockInEvent: ClockEvent,
  clockOutEvent: ClockEvent | null,
  shiftId: string | null,
  allEvents: ClockEvent[]
): Promise<TimesheetEntry | null> {
  const startAtUtc = new Date(clockInEvent.timestamp);
  const endAtUtc = clockOutEvent ? new Date(clockOutEvent.timestamp) : null;

  const hasOverlap = await checkForOverlappingEntries(driverId, startAtUtc, endAtUtc);
  if (hasOverlap) {
    return null;
  }

  const breakMinutes = calculateBreakMinutesFromEvents(allEvents);
  const totalHours = calculateHoursFromClockPair(startAtUtc, endAtUtc, breakMinutes);
  
  const overtimeBreakdown = calculateDailyOvertimeBreakdown(totalHours);

  const entryDate = formatDateYMD(startAtUtc, PHOENIX_TZ);
  const payPeriod = await storage.getPayPeriodByDate(entryDate);

  const status = endAtUtc ? "READY" : "DRAFT";

  const entryData: InsertTimesheetEntry = {
    driverId,
    payPeriodId: payPeriod?.id || null,
    startAtUtc,
    endAtUtc,
    breakMinutes,
    status,
    source: "CLOCK",
    shiftId,
    regularHours: overtimeBreakdown.regularHours.toString(),
    overtimeHours: overtimeBreakdown.overtimeHours.toString(),
    doubleTimeHours: overtimeBreakdown.doubleTimeHours.toString(),
    totalHours: overtimeBreakdown.totalHours.toString(),
  };

  return await storage.createTimesheetEntry(entryData);
}

export async function deriveTimesheetEntriesForPeriod(
  payPeriodId: string
): Promise<DerivationResult> {
  const result: DerivationResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  const payPeriod = await storage.getPayPeriod(payPeriodId);
  if (!payPeriod) {
    result.errors.push(`Pay period ${payPeriodId} not found`);
    return result;
  }

  const startDate = new Date(`${payPeriod.startDate}T00:00:00Z`);
  const endDate = new Date(`${payPeriod.endDate}T23:59:59Z`);

  const existingEntries = await storage.getTimesheetEntriesForPayPeriod(payPeriodId);
  const existingShiftIds = new Set(
    existingEntries.filter(e => e.shiftId).map(e => e.shiftId)
  );
  const existingTimestamps = new Set(
    existingEntries.map(e => e.startAtUtc.toISOString())
  );

  const drivers = await storage.getUsersByRole("driver");

  for (const driver of drivers) {
    try {
      const clockEventsRaw = await storage.getClockEventsByDriver(
        driver.id,
        startDate,
        endDate
      );

      const clockEvents = clockEventsRaw.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let currentInEvent: ClockEvent | null = null;
      let currentShiftId: string | null = null;
      let eventsForCurrentPair: ClockEvent[] = [];

      for (const event of clockEvents) {
        if (event.type === "IN") {
          if (currentInEvent) {
            const existsAlready = 
              (currentShiftId && existingShiftIds.has(currentShiftId)) ||
              existingTimestamps.has(new Date(currentInEvent.timestamp).toISOString());

            if (existsAlready) {
              result.skipped++;
            } else {
              try {
                const entry = await deriveTimesheetEntryFromClockEvents(
                  driver.id,
                  currentInEvent,
                  null,
                  currentShiftId,
                  eventsForCurrentPair
                );
                if (entry) {
                  result.created++;
                } else {
                  result.skipped++;
                }
              } catch (err) {
                result.errors.push(
                  `Failed to create entry for driver ${driver.id}: ${err}`
                );
              }
            }
          }

          currentInEvent = event;
          currentShiftId = event.shiftId || null;
          eventsForCurrentPair = [event];
        } else if (event.type === "OUT" && currentInEvent) {
          eventsForCurrentPair.push(event);

          const existsAlready = 
            (currentShiftId && existingShiftIds.has(currentShiftId)) ||
            existingTimestamps.has(new Date(currentInEvent.timestamp).toISOString());

          if (existsAlready) {
            result.skipped++;
          } else {
            try {
              const entry = await deriveTimesheetEntryFromClockEvents(
                driver.id,
                currentInEvent,
                event,
                currentShiftId,
                eventsForCurrentPair
              );
              if (entry) {
                result.created++;
              } else {
                result.skipped++;
              }
            } catch (err) {
              result.errors.push(
                `Failed to create entry for driver ${driver.id}: ${err}`
              );
            }
          }

          currentInEvent = null;
          currentShiftId = null;
          eventsForCurrentPair = [];
        } else if (event.type === "BREAK_START" || event.type === "BREAK_END") {
          eventsForCurrentPair.push(event);
        }
      }

      if (currentInEvent) {
        const existsAlready = 
          (currentShiftId && existingShiftIds.has(currentShiftId)) ||
          existingTimestamps.has(new Date(currentInEvent.timestamp).toISOString());

        if (existsAlready) {
          result.skipped++;
        } else {
          try {
            const entry = await deriveTimesheetEntryFromClockEvents(
              driver.id,
              currentInEvent,
              null,
              currentShiftId,
              eventsForCurrentPair
            );
            if (entry) {
              result.created++;
            } else {
              result.skipped++;
            }
          } catch (err) {
            result.errors.push(
              `Failed to create DRAFT entry for driver ${driver.id}: ${err}`
            );
          }
        }
      }
    } catch (err) {
      result.errors.push(`Error processing driver ${driver.id}: ${err}`);
    }
  }

  return result;
}

export async function syncTimesheetEntriesFromShifts(
  startDate: string,
  endDate: string
): Promise<DerivationResult> {
  const result: DerivationResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  const shifts = await storage.getShiftsByDateRange(startDate, endDate);

  const completedShifts = shifts.filter(
    s => s.status === "COMPLETED" && s.driverId
  );

  for (const shift of completedShifts) {
    try {
      const clockEvents = await storage.getClockEventsByShift(shift.id);
      
      if (clockEvents.length === 0) {
        result.skipped++;
        continue;
      }

      const inEvents = clockEvents.filter(e => e.type === "IN");
      const outEvents = clockEvents.filter(e => e.type === "OUT");

      if (inEvents.length === 0) {
        result.skipped++;
        continue;
      }

      const sortedEvents = clockEvents.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const firstIn = inEvents.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )[0];

      const lastOut = outEvents.length > 0 
        ? outEvents.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]
        : null;

      const existingEntries = await storage.getTimesheetEntries({ 
        driverId: shift.driverId! 
      });
      
      const alreadyExists = existingEntries.some(e => e.shiftId === shift.id);
      if (alreadyExists) {
        result.skipped++;
        continue;
      }

      try {
        const entry = await deriveTimesheetEntryFromClockEvents(
          shift.driverId!,
          firstIn,
          lastOut,
          shift.id,
          sortedEvents
        );

        if (entry) {
          result.created++;
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors.push(
          `Failed to create entry for shift ${shift.id}: ${err}`
        );
      }
    } catch (err) {
      result.errors.push(`Error processing shift ${shift.id}: ${err}`);
    }
  }

  return result;
}

export async function updateTimesheetEntryHours(entryId: string): Promise<TimesheetEntry | null> {
  const entry = await storage.getTimesheetEntry(entryId);
  if (!entry) {
    return null;
  }

  const totalHours = calculateHoursFromClockPair(
    entry.startAtUtc,
    entry.endAtUtc,
    entry.breakMinutes || 0
  );

  const overtimeBreakdown = calculateDailyOvertimeBreakdown(totalHours);

  return await storage.updateTimesheetEntry(entryId, {
    regularHours: overtimeBreakdown.regularHours.toString(),
    overtimeHours: overtimeBreakdown.overtimeHours.toString(),
    doubleTimeHours: overtimeBreakdown.doubleTimeHours.toString(),
    totalHours: overtimeBreakdown.totalHours.toString(),
  });
}

export async function recalculateWeeklyOvertime(
  driverId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<void> {
  const entries = await storage.getTimesheetEntries({
    driverId,
  });

  const startDate = new Date(`${weekStartDate}T00:00:00Z`);
  const endDate = new Date(`${weekEndDate}T23:59:59Z`);

  const weekEntries = entries.filter(e => {
    const entryDate = new Date(e.startAtUtc);
    return entryDate >= startDate && entryDate <= endDate;
  });

  const totalWeeklyHours = weekEntries.reduce((sum, e) => {
    return sum + parseFloat(e.totalHours || "0");
  }, 0);

  if (totalWeeklyHours > 40) {
    const excessHours = totalWeeklyHours - 40;
    console.log(
      `[Timesheet] Driver ${driverId} has ${excessHours.toFixed(2)} weekly overtime hours`
    );
  }
}
