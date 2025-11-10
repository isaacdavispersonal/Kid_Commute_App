/**
 * Migration: Backfill geofences for existing stops
 * 
 * Creates STOP-type geofences (120m radius) for all stops that have coordinates
 * but no linked geofence.
 * 
 * Usage: tsx server/migrations/backfill-stop-geofences.ts
 */

import { db } from "../db";
import { stops, geofences } from "@shared/schema";
import { eq, and, isNotNull, isNull } from "drizzle-orm";

async function backfillStopGeofences() {
  console.log("🔄 Starting stop geofence backfill migration...\n");

  try {
    // Find all stops with coordinates but no geofence
    const stopsNeedingGeofences = await db
      .select()
      .from(stops)
      .where(
        and(
          isNotNull(stops.latitude),
          isNotNull(stops.longitude),
          isNull(stops.geofenceId)
        )
      );

    if (stopsNeedingGeofences.length === 0) {
      console.log("✅ No stops require geofence provisioning. Migration complete.");
      return;
    }

    console.log(`📍 Found ${stopsNeedingGeofences.length} stop(s) needing geofences:\n`);
    
    let successCount = 0;
    let errorCount = 0;

    // Process each stop in a transaction
    for (const stop of stopsNeedingGeofences) {
      try {
        await db.transaction(async (tx) => {
          // Create geofence
          const [geofence] = await tx
            .insert(geofences)
            .values({
              name: `Stop · ${stop.name}`,
              type: "STOP",
              centerLat: stop.latitude!,
              centerLng: stop.longitude!,
              radiusMeters: 120,
              scheduleStartTime: null, // Always active
              scheduleEndTime: null,   // Always active
              isActive: true,
            })
            .returning();

          // Link geofence to stop
          await tx
            .update(stops)
            .set({ geofenceId: geofence.id })
            .where(eq(stops.id, stop.id));

          console.log(`  ✓ ${stop.name} → Geofence created (${geofence.id})`);
          successCount++;
        });
      } catch (error) {
        console.error(`  ✗ ${stop.name} → Error: ${error}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration complete:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors:  ${errorCount}`);
    
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  backfillStopGeofences()
    .then(() => {
      console.log("\n✅ Migration finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    });
}

export { backfillStopGeofences };
