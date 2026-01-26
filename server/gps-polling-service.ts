import { samsaraClient } from "./samsara-client";
import { gpsIngestionPipeline } from "./gps-pipeline";
import { log } from "./vite";

// Configurable batch size for parallel processing (default: 10)
// Guards against NaN, zero, or negative values
const parsedBatchSize = parseInt(process.env.GPS_BATCH_SIZE || "10", 10);
const GPS_BATCH_SIZE = Number.isNaN(parsedBatchSize) || parsedBatchSize <= 0 ? 10 : parsedBatchSize;

class GPSPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private readonly pollIntervalMs = 30000; // 30 seconds

  async start() {
    if (this.intervalId) {
      log("[gps-polling] Service already running", "warn");
      return;
    }

    if (!samsaraClient) {
      log("[gps-polling] Samsara client not configured (missing SAMSARA_API_TOKEN)", "warn");
      return;
    }

    log("[gps-polling] Starting GPS polling service (every 30 seconds)", "info");

    // Poll immediately on start
    await this.poll();

    // Then poll every 30 seconds
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log("[gps-polling] GPS polling service stopped", "info");
    }
  }

  // Helper to chunk array into batches
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Process a single vehicle with error isolation
  private async processVehicle(vehicle: any): Promise<{ success: boolean; samsaraId: string }> {
    try {
      await gpsIngestionPipeline.ingest({
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        speed: vehicle.speed,
        heading: vehicle.heading,
        timestamp: vehicle.timestamp,
        source: "samsara",
        vehicleIdentifier: {
          samsaraId: vehicle.samsaraId,
        },
        provenance: {
          eventId: `poll-${Date.now()}-${vehicle.samsaraId}`,
          rawPayload: vehicle,
        },
      });
      return { success: true, samsaraId: vehicle.samsaraId };
    } catch (error) {
      log(`[gps-polling] Failed to process vehicle ${vehicle.samsaraId}: ${error}`, "error");
      return { success: false, samsaraId: vehicle.samsaraId };
    }
  }

  private async poll() {
    if (this.isPolling) {
      log("[gps-polling] Previous poll still in progress, skipping", "info");
      return;
    }

    this.isPolling = true;
    const pollStartTime = Date.now();

    try {
      const result = await samsaraClient!.getVehicleLocationsFeed();

      log(
        `[gps-polling] Received ${result.vehicles.length} vehicle location(s) from Samsara`,
        "info"
      );

      if (result.vehicles.length === 0) {
        return;
      }

      // Process vehicles in parallel batches for better performance at scale
      const batches = this.chunk(result.vehicles, GPS_BATCH_SIZE);
      let totalSuccess = 0;
      let totalFailures = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartTime = Date.now();
        
        // Process batch in parallel - each vehicle has its own try/catch
        const results = await Promise.all(batch.map(v => this.processVehicle(v)));
        
        const batchSuccess = results.filter(r => r.success).length;
        const batchFailures = results.filter(r => !r.success).length;
        totalSuccess += batchSuccess;
        totalFailures += batchFailures;
        
        const batchDuration = Date.now() - batchStartTime;
        
        // Log batch timing if slow or has failures
        if (batchDuration > 1000 || batchFailures > 0) {
          log(
            `[gps-polling] Batch ${i + 1}/${batches.length}: ${batchSuccess}/${batch.length} success, ${batchDuration}ms`,
            batchFailures > 0 ? "warn" : "info"
          );
        }
      }

      const totalDuration = Date.now() - pollStartTime;
      
      if (totalFailures > 0) {
        log(
          `[gps-polling] Completed with ${totalFailures} failure(s): ${totalSuccess}/${result.vehicles.length} updated in ${totalDuration}ms`,
          "warn"
        );
      } else if (result.vehicles.length > 0) {
        log(
          `[gps-polling] Successfully updated ${totalSuccess} vehicle location(s) in ${totalDuration}ms`,
          "info"
        );
      }
    } catch (error) {
      log(`[gps-polling] Error polling GPS data: ${error}`, "error");
    } finally {
      this.isPolling = false;
    }
  }

  getStatus() {
    return {
      running: this.intervalId !== null,
      pollIntervalSeconds: this.pollIntervalMs / 1000,
      samsaraConfigured: !!samsaraClient,
    };
  }
}

export const gpsPollingService = new GPSPollingService();
