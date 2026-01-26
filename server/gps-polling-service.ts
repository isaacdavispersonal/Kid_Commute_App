import { samsaraClient } from "./samsara-client";
import { gpsIngestionPipeline } from "./gps-pipeline";
import { createLogger } from "./logger";
import { config } from "./config";

const logger = createLogger("gps-polling");

class GPSPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;

  async start() {
    if (this.intervalId) {
      logger.warn("Service already running");
      return;
    }

    if (!samsaraClient) {
      logger.warn("Samsara client not configured (missing SAMSARA_API_TOKEN)");
      return;
    }

    const intervalSec = config.gps.pollIntervalMs / 1000;
    logger.info(`Starting GPS polling service (every ${intervalSec} seconds)`);

    // Poll immediately on start
    await this.poll();

    // Then poll at configured interval
    this.intervalId = setInterval(() => {
      this.poll();
    }, config.gps.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("GPS polling service stopped");
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
      logger.error(`Failed to process vehicle ${vehicle.samsaraId}: ${error}`);
      return { success: false, samsaraId: vehicle.samsaraId };
    }
  }

  private async poll() {
    if (this.isPolling) {
      logger.debug("Previous poll still in progress, skipping");
      return;
    }

    this.isPolling = true;
    const pollStartTime = Date.now();

    try {
      const result = await samsaraClient!.getVehicleLocationsFeed();

      logger.debug(`Received ${result.vehicles.length} vehicle location(s) from Samsara`);

      if (result.vehicles.length === 0) {
        return;
      }

      // Process vehicles in parallel batches for better performance at scale
      const batches = this.chunk(result.vehicles, config.gps.batchSize);
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
          const logMethod = batchFailures > 0 ? logger.warn : logger.debug;
          logMethod(`Batch ${i + 1}/${batches.length}: ${batchSuccess}/${batch.length} success, ${batchDuration}ms`);
        }
      }

      const totalDuration = Date.now() - pollStartTime;
      
      if (totalFailures > 0) {
        logger.warn(`Completed with ${totalFailures} failure(s): ${totalSuccess}/${result.vehicles.length} updated in ${totalDuration}ms`);
      } else if (result.vehicles.length > 0) {
        logger.debug(`Successfully updated ${totalSuccess} vehicle location(s) in ${totalDuration}ms`);
      }
    } catch (error) {
      logger.error(`Error polling GPS data: ${error}`);
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
