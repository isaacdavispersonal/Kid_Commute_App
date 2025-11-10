import { db } from "./db";
import { 
  geofences, 
  vehicleGeofenceState, 
  geofenceEvents,
  shifts,
  type Geofence,
  type VehicleGeofenceState,
  type InsertGeofenceEvent
} from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { calculateDistance } from "./gps-utils";
import { log } from "./vite";

interface GeofenceCheck {
  vehicleId: string;
  latitude: number;
  longitude: number;
  shiftId: string | null;
}

export interface GeofenceEvent {
  type: "ENTRY" | "EXIT";
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  geofenceType: string;
  shiftId: string | null;
  latitude: number;
  longitude: number;
  occurredAt: Date;
}

type EventListener = (event: GeofenceEvent) => void;

class GeofenceDetectionService {
  private activeGeofences: Geofence[] = [];
  private lastRefresh = 0;
  private readonly GEOFENCE_CACHE_TTL = 60000; // 1 minute
  private eventListeners: EventListener[] = [];

  async refreshGeofences() {
    const now = Date.now();
    if (now - this.lastRefresh < this.GEOFENCE_CACHE_TTL) {
      return;
    }

    this.activeGeofences = await db
      .select()
      .from(geofences)
      .where(eq(geofences.isActive, true));

    this.lastRefresh = now;
  }

  /**
   * Register a listener for geofence events (for WebSocket broadcasting)
   */
  onGeofenceEvent(listener: EventListener) {
    this.eventListeners.push(listener);
  }

  /**
   * Emit geofence event to all listeners
   */
  private emitEvent(event: GeofenceEvent) {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log(`[geofence] Error in event listener: ${error}`, "error");
      }
    }
  }

  /**
   * Check if a point is inside a geofence based on schedule
   */
  private isGeofenceActiveNow(geofence: Geofence): boolean {
    if (!geofence.scheduleStartTime || !geofence.scheduleEndTime) {
      return true; // No schedule restriction
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= geofence.scheduleStartTime && currentTime <= geofence.scheduleEndTime;
  }

  /**
   * Check if a point is inside a circular geofence
   */
  private isInsideGeofence(
    lat: number,
    lng: number,
    geofence: Geofence
  ): boolean {
    if (!geofence.centerLat || !geofence.centerLng) {
      return false;
    }

    const distance = calculateDistance(
      lat,
      lng,
      parseFloat(geofence.centerLat),
      parseFloat(geofence.centerLng)
    );

    return distance <= geofence.radiusMeters;
  }

  /**
   * Batch-load all geofence states for a vehicle
   */
  private async loadVehicleStates(
    vehicleId: string
  ): Promise<Map<string, VehicleGeofenceState>> {
    const states = await db
      .select()
      .from(vehicleGeofenceState)
      .where(eq(vehicleGeofenceState.vehicleId, vehicleId));

    const stateMap = new Map<string, VehicleGeofenceState>();
    for (const state of states) {
      stateMap.set(state.geofenceId, state);
    }
    return stateMap;
  }

  /**
   * Filter geofences by bounding box for optimization
   */
  private filterGeofencesByBoundingBox(
    lat: number,
    lng: number,
    geofences: Geofence[]
  ): Geofence[] {
    // Use a simple bounding box filter to reduce candidate geofences
    // This is a rough optimization - could be improved with geohashing
    const MAX_RADIUS_DEGREES = 0.05; // ~5.5km at equator

    return geofences.filter(g => {
      if (!g.centerLat || !g.centerLng) return false;

      const centerLat = parseFloat(g.centerLat);
      const centerLng = parseFloat(g.centerLng);

      return (
        Math.abs(lat - centerLat) <= MAX_RADIUS_DEGREES &&
        Math.abs(lng - centerLng) <= MAX_RADIUS_DEGREES
      );
    });
  }

  /**
   * Check a vehicle's position against all active geofences
   * Optimized to batch-load states and filter candidates
   */
  async checkVehicleGeofences(check: GeofenceCheck): Promise<void> {
    try {
      await this.refreshGeofences();

      const { vehicleId, latitude, longitude, shiftId } = check;

      // Batch-load all current states for this vehicle
      const stateMap = await this.loadVehicleStates(vehicleId);

      // Filter geofences by bounding box for performance
      const candidateGeofences = this.filterGeofencesByBoundingBox(
        latitude,
        longitude,
        this.activeGeofences
      );

      // Batch database operations
      const statesToUpdate: Array<{
        geofenceId: string;
        isInside: boolean;
        hadTransition: boolean;
      }> = [];
      const eventsToLog: InsertGeofenceEvent[] = [];
      const newStatesToCreate: Array<{
        vehicleId: string;
        geofenceId: string;
        isInside: boolean;
      }> = [];

      for (const geofence of candidateGeofences) {
        if (!this.isGeofenceActiveNow(geofence)) {
          continue;
        }

        const isInside = this.isInsideGeofence(latitude, longitude, geofence);
        const existingState = stateMap.get(geofence.id);

        if (!existingState) {
          // New geofence state needed
          newStatesToCreate.push({
            vehicleId,
            geofenceId: geofence.id,
            isInside,
          });
          continue;
        }

        // Detect transition
        const hadTransition = isInside !== existingState.isInside;

        if (hadTransition) {
          const eventType = isInside ? "ENTRY" : "EXIT";

          eventsToLog.push({
            vehicleId,
            geofenceId: geofence.id,
            shiftId,
            eventType,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            occurredAt: new Date(),
            payload: {
              geofenceName: geofence.name,
              geofenceType: geofence.type,
            },
          });

          // Emit event for WebSocket notification
          this.emitEvent({
            type: eventType,
            vehicleId,
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            geofenceType: geofence.type,
            shiftId,
            latitude,
            longitude,
            occurredAt: new Date(),
          });

          log(`[geofence] Vehicle ${vehicleId} ${eventType} geofence "${geofence.name}"`, "info");
        }

        statesToUpdate.push({
          geofenceId: geofence.id,
          isInside,
          hadTransition,
        });
      }

      // Batch insert new states
      if (newStatesToCreate.length > 0) {
        await db.insert(vehicleGeofenceState).values(newStatesToCreate);
      }

      // Batch insert events
      if (eventsToLog.length > 0) {
        await db.insert(geofenceEvents).values(eventsToLog);
      }

      // Batch update states
      if (statesToUpdate.length > 0) {
        for (const update of statesToUpdate) {
          const state = stateMap.get(update.geofenceId);
          if (!state) continue;

          const updateData: any = {
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          };

          if (update.hadTransition) {
            updateData.isInside = update.isInside;
            updateData.lastTransitionAt = new Date();
          }

          await db
            .update(vehicleGeofenceState)
            .set(updateData)
            .where(eq(vehicleGeofenceState.id, state.id));
        }
      }
    } catch (error) {
      // Isolated error handling - don't fail GPS updates
      log(`[geofence] Error checking geofences for vehicle ${check.vehicleId}: ${error}`, "error");
    }
  }

  /**
   * Get recent geofence events for notification purposes
   */
  async getRecentEvents(
    vehicleId: string,
    sinceTimestamp: Date
  ): Promise<typeof geofenceEvents.$inferSelect[]> {
    return db
      .select()
      .from(geofenceEvents)
      .where(
        and(
          eq(geofenceEvents.vehicleId, vehicleId),
          sql`${geofenceEvents.occurredAt} > ${sinceTimestamp}`
        )
      )
      .orderBy(geofenceEvents.occurredAt);
  }

  /**
   * Get current geofence states for a vehicle
   */
  async getVehicleGeofenceStates(
    vehicleId: string
  ): Promise<VehicleGeofenceState[]> {
    return db
      .select()
      .from(vehicleGeofenceState)
      .where(eq(vehicleGeofenceState.vehicleId, vehicleId));
  }
}

export const geofenceDetectionService = new GeofenceDetectionService();
