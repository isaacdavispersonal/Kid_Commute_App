import { Router, Request, Response } from "express";
import crypto from "crypto";
import { gpsIngestionPipeline, CanonicalGPSUpdate } from "./gps-pipeline";
import { log } from "./vite";

const router = Router();

interface SamsaraWebhookPayload {
  eventId: string;
  eventTime: string;
  eventType: string;
  orgId: number;
  webhookId: string;
  data: {
    vehicle?: {
      id: string;
      name: string;
      licensePlate?: string;
    };
    location?: {
      latitude: number;
      longitude: number;
      speedMilesPerHour?: number;
      heading?: number;
      time?: string;
    };
  };
}

function verifySamsaraSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  try {
    const secretBuffer = Buffer.from(secret, "base64");

    const message = `v1:${timestamp}:${rawBody}`;

    const hmac = crypto.createHmac("sha256", secretBuffer);
    hmac.update(message);
    const expectedSignature = "v1=" + hmac.digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    log(`[samsara-webhook] Signature verification error: ${error}`, "error");
    return false;
  }
}

router.post(
  "/samsara-webhook",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const timestamp = req.headers["x-samsara-timestamp"] as string;
      const signature = req.headers["x-samsara-signature"] as string;

      if (!timestamp || !signature) {
        log("[samsara-webhook] Missing required headers", "warn");
        res.status(400).send("Missing X-Samsara-Timestamp or X-Samsara-Signature headers");
        return;
      }

      const samsaraWebhookSecret = process.env.SAMSARA_WEBHOOK_SECRET;

      if (!samsaraWebhookSecret) {
        log("[samsara-webhook] SAMSARA_WEBHOOK_SECRET not configured", "error");
        res.status(500).send("Webhook secret not configured");
        return;
      }

      const rawBody = JSON.stringify(req.body);
      
      const isValid = verifySamsaraSignature(
        rawBody,
        timestamp,
        signature,
        samsaraWebhookSecret
      );

      if (!isValid) {
        log("[samsara-webhook] Invalid signature", "warn");
        res.status(401).send("Invalid signature");
        return;
      }

      const payload: SamsaraWebhookPayload = req.body;

      log(
        `[samsara-webhook] Received ${payload.eventType} event ${payload.eventId}`,
        "info"
      );

      if (payload.eventType === "VehicleUpdated" && payload.data.vehicle && payload.data.location) {
        const canonicalUpdate: CanonicalGPSUpdate = {
          latitude: payload.data.location.latitude,
          longitude: payload.data.location.longitude,
          speed: payload.data.location.speedMilesPerHour,
          heading: payload.data.location.heading,
          timestamp: payload.data.location.time
            ? new Date(payload.data.location.time)
            : new Date(payload.eventTime),
          source: "samsara",
          vehicleIdentifier: {
            samsaraId: payload.data.vehicle.id,
            plateNumber: payload.data.vehicle.licensePlate,
          },
          provenance: {
            eventId: payload.eventId,
            rawPayload: payload,
          },
        };

        await gpsIngestionPipeline.ingest(canonicalUpdate);
      }

      res.status(200).send("OK");
    } catch (error) {
      log(`[samsara-webhook] Error processing webhook: ${error}`, "error");
      res.status(500).send("Internal server error");
    }
  }
);

export default router;
