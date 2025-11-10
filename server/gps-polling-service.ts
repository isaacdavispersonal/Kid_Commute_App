import { samsaraClient } from "./samsara-client";
import { gpsIngestionPipeline } from "./gps-pipeline";
import { log } from "./vite";

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

  private async poll() {
    if (this.isPolling) {
      log("[gps-polling] Previous poll still in progress, skipping", "info");
      return;
    }

    this.isPolling = true;

    try {
      const result = await samsaraClient!.getVehicleLocationsFeed();

      log(
        `[gps-polling] Received ${result.vehicles.length} vehicle location(s) from Samsara`,
        "info"
      );

      // Process each vehicle location through the GPS ingestion pipeline
      for (const vehicle of result.vehicles) {
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
      }

      if (result.vehicles.length > 0) {
        log(
          `[gps-polling] Successfully updated ${result.vehicles.length} vehicle location(s)`,
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
