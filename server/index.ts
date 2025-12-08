import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Trust proxy for proper HTTPS detection on Replit (behind reverse proxy)
app.set('trust proxy', 1);

// CORS configuration for mobile app support (Capacitor iOS/Android)
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5000',
      'capacitor://localhost',
      'ionic://localhost',
      'https://kid-commute.replit.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Handle preflight requests for all routes
app.options('*', cors());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { httpServer: server, wss } = await registerRoutes(app);

  // Initialize notification service with WebSocket server
  const { notificationService } = await import("./notification-service");
  const { pushNotificationService } = await import("./push-notification-service");
  const { geofenceDetectionService } = await import("./geofence-service");
  const { dwellDetectionService } = await import("./dwell-detection-service");

  notificationService.initialize(wss);
  pushNotificationService.initialize();

  // Register event listeners for geofence and dwell events
  geofenceDetectionService.onGeofenceEvent((event) => {
    // Handle both ENTRY (approaching stop) and EXIT (departing) events
    if (event.type === "ENTRY") {
      notificationService.handleGeofenceEntry(event);
    } else if (event.type === "EXIT") {
      notificationService.handleGeofenceExit(event);
    }
  });

  dwellDetectionService.onStopCompletion((event) => {
    notificationService.handleStopCompletion(event);
  });

  log("WebSocket notification listeners registered");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Setup auto-clockout scheduled job
  // Run every hour to automatically clock out drivers who exceeded grace period
  const AUTO_CLOCKOUT_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  
  async function runAutoClockout() {
    try {
      const { storage } = await import("./storage");
      
      // Get grace period from admin settings, default to 1 hour if not set
      const graceSetting = await storage.getAdminSetting("auto_clockout_grace_hours");
      const graceHours = graceSetting ? parseFloat(graceSetting.settingValue) : 1;
      
      const result = await storage.autoClockoutOrphanedShifts(graceHours);
      
      if (result.processed > 0) {
        log(`Auto-clockout: Processed ${result.processed} orphaned shifts`);
      }
    } catch (error) {
      console.error("Error running auto-clockout:", error);
    }
  }
  
  // Run immediately on startup
  runAutoClockout();
  
  // Then run every hour
  setInterval(runAutoClockout, AUTO_CLOCKOUT_INTERVAL);
  log(`Auto-clockout job scheduled to run every ${AUTO_CLOCKOUT_INTERVAL / 1000 / 60} minutes`);

  // Seed payment portals from environment variables on startup
  async function seedPaymentPortals() {
    try {
      const { storage } = await import("./storage");
      
      const portalsToSeed = [
        {
          provider: "quickbooks" as const,
          envVar: "QUICKBOOKS_PORTAL_URL",
          displayName: "QuickBooks Online",
        },
        {
          provider: "classwallet" as const,
          envVar: "CLASSWALLET_PORTAL_URL",
          displayName: "ClassWallet",
        },
      ];

      for (const { provider, envVar, displayName } of portalsToSeed) {
        const portalUrl = process.env[envVar];
        if (portalUrl) {
          await storage.upsertPaymentPortal({
            provider,
            portalUrl,
            displayName,
            isEnabled: true,
          });
          log(`Payment portal configured: ${displayName} (${provider})`);
        }
      }
    } catch (error) {
      console.error("Error seeding payment portals:", error);
    }
  }

  // Run payment portal seeding on startup
  await seedPaymentPortals();

  // Setup data retention scheduled job
  // Run daily to automatically cleanup old data per privacy policy
  const { initializeDataRetention } = await import("./data-retention-service");
  initializeDataRetention(24); // Run every 24 hours

  // Start GPS polling service for real-time vehicle tracking
  const { gpsPollingService } = await import("./gps-polling-service");
  await gpsPollingService.start();
})();
