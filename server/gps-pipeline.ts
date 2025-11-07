import { db } from "./db";
import { vehicles } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { log } from "./vite";

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

  async ingest(update: CanonicalGPSUpdate): Promise<void> {
    try {
      const dedupeKey = this.generateDedupeKey(update);
      
      if (this.processedEvents.has(dedupeKey)) {
        log(`[gps-pipeline] Duplicate event detected, skipping: ${dedupeKey}`, "info");
        return;
      }

      const vehicle = await this.resolveVehicle(update.vehicleIdentifier);
      
      if (!vehicle) {
        log(
          `[gps-pipeline] No vehicle found for ${JSON.stringify(update.vehicleIdentifier)}`,
          "warn"
        );
        return;
      }

      await this.updateVehicleLocation(vehicle.id, update);

      this.processedEvents.add(dedupeKey);
      
      setTimeout(() => {
        this.processedEvents.delete(dedupeKey);
      }, this.dedupeWindowMs);

      log(
        `[gps-pipeline] Updated vehicle ${vehicle.name} (${vehicle.plateNumber}) from ${update.source}`,
        "info"
      );
    } catch (error) {
      log(`[gps-pipeline] Error ingesting GPS update: ${error}`, "error");
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
