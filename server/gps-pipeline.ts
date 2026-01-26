import { db } from "./db";
import { vehicles, shifts, clockEvents } from "@shared/schema";
import { eq, or, and, sql, gte, desc } from "drizzle-orm";
import { createLogger } from "./logger";
import { geofenceDetectionService } from "./geofence-service";
import { dwellDetectionService } from "./dwell-detection-service";

const logger = createLogger("gps-pipeline");

export interface CanonicalGPSUpdate {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
  source: "samsara" | "generic";
  vehicleIdentifier: {
    samsaraId?: string;
    plateNumber?: string;
    fleetTrackId?: string;
  };
  provenance: {
    eventId?: string;
    rawPayload?: any;
  };
}

class GPSIngestionPipeline {
  private processedEvents = new Set<string>();
  private readonly dedupeWindowMs = 5000;

  /**
   * Get the active shift for a vehicle (if any)
   * A shift is active if it has a recent CLOCK_IN event but no CLOCK_OUT
   * Uses timestamp-based comparison to work correctly regardless of server timezone
   */
  private async getActiveShift(vehicleId: string): Promise<string | null> {
    // Look for shifts within the last 24 hours to catch late/overnight shifts
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    // Find recent shifts for this vehicle with their clock events
    // Filter clock events server-side to reduce data transfer
    const recentShifts = await db
      .select({
        shiftId: shifts.id,
        shiftDate: shifts.date,
        plannedStart: shifts.plannedStart,
        plannedEnd: shifts.plannedEnd,
        eventType: clockEvents.type,
        eventTime: clockEvents.timestamp,
      })
      .from(shifts)
      .leftJoin(clockEvents, 
        and(
          eq(clockEvents.shiftId, shifts.id),
          gte(clockEvents.timestamp, twentyFourHoursAgo) // Server-side filter
        )
      )
      .where(eq(shifts.vehicleId, vehicleId))
      .orderBy(desc(clockEvents.timestamp)); // Most recent first

    // Group by shift and find the one with most recent IN event
    const shiftData = new Map<string, {
      lastEvent: { type: string; time: Date } | null;
      date: string;
      plannedStart: string;
      plannedEnd: string;
    }>();

    for (const row of recentShifts) {
      if (!shiftData.has(row.shiftId)) {
        shiftData.set(row.shiftId, {
          lastEvent: null,
          date: row.shiftDate,
          plannedStart: row.plannedStart,
          plannedEnd: row.plannedEnd,
        });
      }

      const data = shiftData.get(row.shiftId)!;
      // Since we ordered DESC, first event we see is the most recent
      if (row.eventType && row.eventTime && !data.lastEvent) {
        data.lastEvent = {
          type: row.eventType,
          time: row.eventTime,
        };
      }
    }

    // Find a shift where the most recent event is IN
    for (const [shiftId, data] of shiftData.entries()) {
      if (data.lastEvent && data.lastEvent.type === 'IN') {
        logger.debug(`Found active shift ${shiftId} for vehicle ${vehicleId}`);
        return shiftId;
      }
    }

    // No active shift found - debug level since this is expected for idle vehicles
    logger.debug(`No active shift found for vehicle ${vehicleId}`);
    return null;
  }

  async ingest(update: CanonicalGPSUpdate): Promise<void> {
    try {
      const dedupeKey = this.generateDedupeKey(update);
      
      if (this.processedEvents.has(dedupeKey)) {
        logger.debug(`Duplicate event detected, skipping: ${dedupeKey}`);
        return;
      }

      const vehicle = await this.resolveVehicle(update.vehicleIdentifier);
      
      if (!vehicle) {
        logger.warn(`No vehicle found for ${JSON.stringify(update.vehicleIdentifier)}`);
        return;
      }

      await this.updateVehicleLocation(vehicle.id, update);

      // Get active shift once for both services
      const activeShiftId = await this.getActiveShift(vehicle.id);

      // Only check geofences and dwell if vehicle has an active shift
      // This prevents null shiftId issues and improves performance
      if (activeShiftId) {
        // Check geofences after updating location
        await geofenceDetectionService.checkVehicleGeofences({
          vehicleId: vehicle.id,
          latitude: update.latitude,
          longitude: update.longitude,
          shiftId: activeShiftId,
        });

        // Check for dwell at stops (run after geofence for context)
        await dwellDetectionService.checkVehicleDwell({
          vehicleId: vehicle.id,
          latitude: update.latitude,
          longitude: update.longitude,
          shiftId: activeShiftId,
          speed: update.speed,
        });
      }

      this.processedEvents.add(dedupeKey);
      
      setTimeout(() => {
        this.processedEvents.delete(dedupeKey);
      }, this.dedupeWindowMs);

      logger.debug(`Updated vehicle ${vehicle.name} (${vehicle.plateNumber}) from ${update.source}`);
    } catch (error) {
      logger.error(`Error ingesting GPS update: ${error}`);
      throw error;
    }
  }

  private generateDedupeKey(update: CanonicalGPSUpdate): string {
    const vehicleId =
      update.vehicleIdentifier.samsaraId ||
      update.vehicleIdentifier.plateNumber ||
      update.vehicleIdentifier.fleetTrackId;
    
    const timestampKey = Math.floor(update.timestamp.getTime() / 1000);
    
    return `${vehicleId}:${timestampKey}:${update.latitude}:${update.longitude}`;
  }

  private async resolveVehicle(identifier: CanonicalGPSUpdate["vehicleIdentifier"]) {
    const conditions = [];

    if (identifier.fleetTrackId) {
      conditions.push(eq(vehicles.id, identifier.fleetTrackId));
    }
    
    if (identifier.samsaraId) {
      conditions.push(eq(vehicles.samsaraVehicleId, identifier.samsaraId));
    }
    
    if (identifier.plateNumber) {
      conditions.push(eq(vehicles.plateNumber, identifier.plateNumber));
    }

    if (conditions.length === 0) {
      return null;
    }

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(or(...conditions))
      .limit(1);

    return vehicle || null;
  }

  private async updateVehicleLocation(
    vehicleId: string,
    update: CanonicalGPSUpdate
  ): Promise<void> {
    const updateData: any = {
      currentLat: update.latitude.toString(),
      currentLng: update.longitude.toString(),
      lastLocationUpdate: update.timestamp,
      updatedAt: new Date(),
    };

    // Store speed and heading if available
    if (update.speed !== undefined) {
      updateData.currentSpeedMph = update.speed.toString();
    }
    if (update.heading !== undefined) {
      updateData.currentHeadingDeg = update.heading.toString();
    }

    if (update.source === "samsara" && update.vehicleIdentifier.samsaraId) {
      updateData.samsaraVehicleId = update.vehicleIdentifier.samsaraId;
      updateData.samsaraLastSync = new Date();
    }

    await db
      .update(vehicles)
      .set(updateData)
      .where(eq(vehicles.id, vehicleId));
  }
}

export const gpsIngestionPipeline = new GPSIngestionPipeline();
