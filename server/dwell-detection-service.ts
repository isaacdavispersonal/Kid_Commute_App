import { db } from "./db";
import {
  vehicleDwellSessions,
  routeProgress,
  routeStops,
  stops,
  shifts,
  clockEvents,
  type VehicleDwellSession,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateDistance } from "./gps-utils";
import { log } from "./vite";

interface DwellCheck {
  vehicleId: string;
  latitude: number;
  longitude: number;
  shiftId: string | null;
  speed?: number; // Speed in km/h or mph
}

export interface StopCompletionEvent {
  shiftId: string;
  routeStopId: string;
  stopName: string;
  dwellDuration: number; // in seconds
  completedAt: Date;
}

type StopCompletionListener = (event: StopCompletionEvent) => void;

class DwellDetectionService {
  private readonly STOP_PROXIMITY_METERS = 50; // Vehicle must be within 50m of stop
  private readonly DWELL_THRESHOLD_SECONDS = 30; // Must dwell for 30 seconds
  private readonly SPEED_THRESHOLD_KMH = 5; // Must be moving less than 5 km/h
  private readonly SESSION_TIMEOUT_MINUTES = 10; // Abandon sessions older than 10 min

  private completionListeners: StopCompletionListener[] = [];

  /**
   * Register a listener for stop completion events
   */
  onStopCompletion(listener: StopCompletionListener) {
    this.completionListeners.push(listener);
  }

  /**
   * Emit stop completion event to all listeners
   */
  private emitStopCompletion(event: StopCompletionEvent) {
    for (const listener of this.completionListeners) {
      try {
        listener(event);
      } catch (error) {
        log(`[dwell] Error in completion listener: ${error}`, "error");
      }
    }
  }

  /**
   * Get active dwell session for a vehicle
   */
  private async getActiveDwellSession(
    vehicleId: string
  ): Promise<VehicleDwellSession | null> {
    const [session] = await db
      .select()
      .from(vehicleDwellSessions)
      .where(
        and(
          eq(vehicleDwellSessions.vehicleId, vehicleId),
          eq(vehicleDwellSessions.status, "ACTIVE")
        )
      )
      .limit(1);

    return session || null;
  }

  /**
   * Get pending stops for a shift
   */
  private async getPendingStopsForShift(shiftId: string) {
    const pendingProgress = await db
      .select({
        routeProgress: routeProgress,
        routeStop: routeStops,
        stop: stops,
      })
      .from(routeProgress)
      .innerJoin(routeStops, eq(routeProgress.routeStopId, routeStops.id))
      .innerJoin(stops, eq(routeStops.stopId, stops.id))
      .where(
        and(
          eq(routeProgress.shiftId, shiftId),
          eq(routeProgress.status, "PENDING")
        )
      )
      .orderBy(routeStops.stopOrder);

    return pendingProgress;
  }

  /**
   * Check if vehicle is near a stop
   */
  private findNearbyStop(
    latitude: number,
    longitude: number,
    pendingStops: Awaited<ReturnType<typeof this.getPendingStopsForShift>>
  ) {
    for (const stopData of pendingStops) {
      const { stop } = stopData;
      
      if (!stop.latitude || !stop.longitude) {
        continue;
      }

      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(stop.latitude),
        parseFloat(stop.longitude)
      );

      if (distance <= this.STOP_PROXIMITY_METERS) {
        return stopData;
      }
    }

    return null;
  }

  /**
   * Check if vehicle is stationary (low speed or speed not available)
   */
  private isStationary(speed?: number): boolean {
    if (speed === undefined || speed === null) {
      return true; // Assume stationary if no speed data
    }
    return speed < this.SPEED_THRESHOLD_KMH;
  }

  /**
   * Start a new dwell session
   */
  private async startDwellSession(
    check: DwellCheck,
    stopData: {
      routeProgress: typeof routeProgress.$inferSelect;
      routeStop: typeof routeStops.$inferSelect;
      stop: typeof stops.$inferSelect;
    }
  ): Promise<void> {
    await db.insert(vehicleDwellSessions).values({
      vehicleId: check.vehicleId,
      shiftId: check.shiftId,
      routeStopId: stopData.routeStop.id,
      routeProgressId: stopData.routeProgress.id,
      status: "ACTIVE",
      arrivalLat: check.latitude.toString(),
      arrivalLng: check.longitude.toString(),
      arrivalAt: new Date(),
    });

    log(`[dwell] Started dwell session at stop "${stopData.stop.name}"`, "info");
  }

  /**
   * Complete a dwell session and mark stop as completed
   */
  private async completeDwellSession(
    session: VehicleDwellSession,
    check: DwellCheck
  ): Promise<void> {
    const dwellDuration = Math.floor(
      (new Date().getTime() - new Date(session.arrivalAt).getTime()) / 1000
    );

    // Update dwell session
    await db
      .update(vehicleDwellSessions)
      .set({
        status: "COMPLETED",
        departureLat: check.latitude.toString(),
        departureLng: check.longitude.toString(),
        departureAt: new Date(),
        dwellDurationSeconds: dwellDuration,
        autoCompletedStop: true,
        updatedAt: new Date(),
      })
      .where(eq(vehicleDwellSessions.id, session.id));

    // Mark route progress as completed
    if (session.routeProgressId) {
      await db
        .update(routeProgress)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          autoCompleted: true,
          dwellSessionId: session.id,
          updatedAt: new Date(),
        })
        .where(eq(routeProgress.id, session.routeProgressId));

      // Get stop details for event
      const [progressDetails] = await db
        .select({
          routeStop: routeStops,
          stop: stops,
        })
        .from(routeProgress)
        .innerJoin(routeStops, eq(routeProgress.routeStopId, routeStops.id))
        .innerJoin(stops, eq(routeStops.stopId, stops.id))
        .where(eq(routeProgress.id, session.routeProgressId))
        .limit(1);

      if (progressDetails && session.shiftId) {
        // Emit completion event
        this.emitStopCompletion({
          shiftId: session.shiftId,
          routeStopId: session.routeStopId!,
          stopName: progressDetails.stop.name,
          dwellDuration,
          completedAt: new Date(),
        });

        log(
          `[dwell] Auto-completed stop "${progressDetails.stop.name}" after ${dwellDuration}s dwell`,
          "info"
        );
      }
    }
  }

  /**
   * Abandon a dwell session if vehicle moved away
   */
  private async abandonDwellSession(
    session: VehicleDwellSession,
    check: DwellCheck
  ): Promise<void> {
    await db
      .update(vehicleDwellSessions)
      .set({
        status: "ABANDONED",
        departureLat: check.latitude.toString(),
        departureLng: check.longitude.toString(),
        departureAt: new Date(),
        dwellDurationSeconds: Math.floor(
          (new Date().getTime() - new Date(session.arrivalAt).getTime()) / 1000
        ),
        updatedAt: new Date(),
      })
      .where(eq(vehicleDwellSessions.id, session.id));

    log(`[dwell] Abandoned dwell session (vehicle moved away)`, "info");
  }

  /**
   * Main dwell detection logic
   */
  async checkVehicleDwell(check: DwellCheck): Promise<void> {
    try {
      // CRITICAL: No shift = no active route to check
      // Without a shift, we cannot determine route stops or update route progress
      if (!check.shiftId) {
        // Abandon any active sessions for this vehicle since shift ended
        const activeSession = await this.getActiveDwellSession(check.vehicleId);
        if (activeSession) {
          await this.abandonDwellSession(activeSession, check);
        }
        return;
      }

      const activeSession = await this.getActiveDwellSession(check.vehicleId);

      // If vehicle is moving, check if we need to abandon active session
      if (!this.isStationary(check.speed)) {
        if (activeSession) {
          await this.abandonDwellSession(activeSession, check);
        }
        return;
      }

      // Vehicle is stationary - check if near a pending stop
      const pendingStops = await this.getPendingStopsForShift(check.shiftId);
      const nearbyStop = this.findNearbyStop(
        check.latitude,
        check.longitude,
        pendingStops
      );

      if (!nearbyStop) {
        // Not near any pending stop - abandon session if exists
        if (activeSession) {
          await this.abandonDwellSession(activeSession, check);
        }
        return;
      }

      // Vehicle is stationary near a pending stop
      if (!activeSession) {
        // Start new dwell session
        await this.startDwellSession(check, nearbyStop);
        return;
      }

      // Check if still at same stop
      if (activeSession.routeStopId !== nearbyStop.routeStop.id) {
        // Moved to different stop - abandon old session and start new one
        await this.abandonDwellSession(activeSession, check);
        await this.startDwellSession(check, nearbyStop);
        return;
      }

      // Still at same stop - check if dwell threshold met
      const dwellDuration = Math.floor(
        (new Date().getTime() - new Date(activeSession.arrivalAt).getTime()) /
          1000
      );

      if (dwellDuration >= this.DWELL_THRESHOLD_SECONDS) {
        await this.completeDwellSession(activeSession, check);
      }
    } catch (error) {
      // Isolated error handling - don't fail GPS updates
      log(
        `[dwell] Error checking dwell for vehicle ${check.vehicleId}: ${error}`,
        "error"
      );
    }
  }

  /**
   * Cleanup old abandoned sessions
   */
  async cleanupOldSessions(): Promise<void> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - this.SESSION_TIMEOUT_MINUTES);

    await db
      .update(vehicleDwellSessions)
      .set({
        status: "ABANDONED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vehicleDwellSessions.status, "ACTIVE"),
          sql`${vehicleDwellSessions.arrivalAt} < ${cutoffTime}`
        )
      );
  }
}

export const dwellDetectionService = new DwellDetectionService();
