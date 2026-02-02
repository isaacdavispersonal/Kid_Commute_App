import { storage } from "../storage";
import { createBambooHRService } from "../bamboohr-service";
import { NotFoundError, ValidationError } from "../errors";
import type {
  PayrollExportJob,
  PayrollExportJobEntry,
  TimesheetEntry,
  User,
} from "@shared/schema";

interface ExportJobResult {
  jobId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  totalEntries: number;
  successfulEntries: number;
  failedEntries: number;
  skippedEntries: number;
  errors: string[];
}

interface ExportEntryResult {
  id: string;
  idempotencyKey: string;
  success: boolean;
  skipped: boolean;
  error?: string;
  bambooEntryId?: string;
}

interface DriverDateAggregation {
  driverId: string;
  driverName: string;
  bambooEmployeeId: string | null;
  date: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  timesheetEntryIds: string[];
}

interface ExportPreview {
  payPeriodId: string;
  payPeriodStatus: string;
  startDate: string;
  endDate: string;
  entries: DriverDateAggregation[];
  summary: {
    totalDrivers: number;
    totalDays: number;
    totalHours: number;
    driversWithMapping: number;
    driversWithoutMapping: number;
  };
  warnings: string[];
  canExport: boolean;
}

export class BambooHRExportService {
  async createExportJob(
    payPeriodId: string,
    requestedByUserId: string,
    mode: "MANUAL" | "SCHEDULED"
  ): Promise<string> {
    console.log(`[BambooHR Export] Creating export job for pay period ${payPeriodId}`);

    const payPeriod = await storage.getPayPeriod(payPeriodId);
    if (!payPeriod) {
      throw new NotFoundError("Pay period not found");
    }

    if (payPeriod.status !== "APPROVED") {
      throw new ValidationError(
        `Pay period must be APPROVED to export. Current status: ${payPeriod.status}`
      );
    }

    const job = await storage.createPayrollExportJob({
      payPeriodId,
      requestedByUserId,
      mode,
      status: "QUEUED",
      totalEntries: 0,
      successfulEntries: 0,
      failedEntries: 0,
    });

    console.log(`[BambooHR Export] Created job ${job.id} for pay period ${payPeriodId}`);
    return job.id;
  }

  async executeExportJob(jobId: string): Promise<ExportJobResult> {
    console.log(`[BambooHR Export] Executing job ${jobId}`);

    const job = await storage.getPayrollExportJob(jobId);
    if (!job) {
      throw new NotFoundError("Export job not found");
    }

    if (job.status !== "QUEUED") {
      throw new ValidationError(
        `Job must be in QUEUED status to execute. Current status: ${job.status}`
      );
    }

    await storage.updatePayrollExportJob(jobId, {
      status: "RUNNING",
      startedAt: new Date(),
    });

    const bambooHRService = createBambooHRService();
    if (!bambooHRService) {
      await storage.updatePayrollExportJob(jobId, {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: "BambooHR service not configured. Missing API credentials.",
      });
      throw new ValidationError("BambooHR service not configured");
    }

    const payPeriod = await storage.getPayPeriod(job.payPeriodId);
    if (!payPeriod) {
      await storage.updatePayrollExportJob(jobId, {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: "Pay period not found",
      });
      throw new NotFoundError("Pay period not found");
    }

    const timesheetEntries = await storage.getTimesheetEntries({
      payPeriodId: job.payPeriodId,
      status: "APPROVED",
    });

    const aggregatedEntries = await this.aggregateTimesheetEntriesByDriverDate(
      timesheetEntries,
      job.payPeriodId
    );

    const idempotencyKeys = aggregatedEntries.map((e) => e.idempotencyKey);
    const existingSuccessfulExports = await storage.findSuccessfulExportsByIdempotencyKeys(
      idempotencyKeys
    );
    const existingKeys = new Set(existingSuccessfulExports.map((e) => e.idempotencyKey));

    const results: ExportEntryResult[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    for (const entry of aggregatedEntries) {
      if (existingKeys.has(entry.idempotencyKey)) {
        console.log(`[BambooHR Export] Skipping already exported: ${entry.idempotencyKey}`);
        results.push({
          id: "",
          idempotencyKey: entry.idempotencyKey,
          success: true,
          skipped: true,
        });
        skippedCount++;
        continue;
      }

      if (!entry.bambooEmployeeId) {
        const errorMsg = `Driver ${entry.driverName} (${entry.driverId}) missing BambooHR employee ID`;
        console.error(`[BambooHR Export] ${errorMsg}`);
        errors.push(errorMsg);
        const jobEntry = await storage.createPayrollExportJobEntry({
          jobId,
          driverId: entry.driverId,
          bambooEmployeeId: "MISSING",
          date: entry.date,
          regularHours: entry.regularHours.toFixed(2),
          overtimeHours: entry.overtimeHours.toFixed(2),
          doubleTimeHours: entry.doubleTimeHours.toFixed(2),
          totalHours: entry.totalHours.toFixed(2),
          idempotencyKey: entry.idempotencyKey,
          status: "FAILED",
          errorMessage: errorMsg,
        });
        results.push({
          id: jobEntry.id,
          idempotencyKey: entry.idempotencyKey,
          success: false,
          skipped: false,
          error: errorMsg,
        });
        continue;
      }

      const payload = {
        employeeId: entry.bambooEmployeeId,
        date: entry.date,
        hours: entry.regularHours,
        overtimeHours: entry.overtimeHours,
        doubleTimeHours: entry.doubleTimeHours,
        note: `Auto-exported from Kid Commute - ${entry.totalHours.toFixed(2)} total hours`,
      };

      const jobEntry = await storage.createPayrollExportJobEntry({
        jobId,
        driverId: entry.driverId,
        bambooEmployeeId: entry.bambooEmployeeId,
        date: entry.date,
        regularHours: entry.regularHours.toFixed(2),
        overtimeHours: entry.overtimeHours.toFixed(2),
        doubleTimeHours: entry.doubleTimeHours.toFixed(2),
        totalHours: entry.totalHours.toFixed(2),
        idempotencyKey: entry.idempotencyKey,
        payloadJson: payload,
        status: "RUNNING",
      });

      console.log(
        `[BambooHR Export] Sending to BambooHR: ${entry.driverName}, ${entry.date}, ${entry.totalHours}h`
      );

      try {
        const response = await bambooHRService.submitTimeEntry(payload);

        if (response.success) {
          await storage.updatePayrollExportJobEntry(jobEntry.id, {
            status: "SUCCESS",
            bambooEntryId: response.entryId,
            bambooResponseJson: response,
          });
          results.push({
            id: jobEntry.id,
            idempotencyKey: entry.idempotencyKey,
            success: true,
            skipped: false,
            bambooEntryId: response.entryId,
          });
        } else {
          const errorMsg = response.error || "Unknown BambooHR error";
          await storage.updatePayrollExportJobEntry(jobEntry.id, {
            status: "FAILED",
            errorMessage: errorMsg,
            bambooResponseJson: response,
          });
          errors.push(`${entry.driverName} (${entry.date}): ${errorMsg}`);
          results.push({
            id: jobEntry.id,
            idempotencyKey: entry.idempotencyKey,
            success: false,
            skipped: false,
            error: errorMsg,
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await storage.updatePayrollExportJobEntry(jobEntry.id, {
          status: "FAILED",
          errorMessage: errorMsg,
        });
        errors.push(`${entry.driverName} (${entry.date}): ${errorMsg}`);
        results.push({
          id: jobEntry.id,
          idempotencyKey: entry.idempotencyKey,
          success: false,
          skipped: false,
          error: errorMsg,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const successfulEntries = results.filter((r) => r.success && !r.skipped).length;
    const failedEntries = results.filter((r) => !r.success).length;
    const totalEntries = results.filter((r) => !r.skipped).length;

    let finalStatus: "SUCCESS" | "PARTIAL" | "FAILED";
    if (failedEntries === 0) {
      finalStatus = "SUCCESS";
    } else if (successfulEntries > 0) {
      finalStatus = "PARTIAL";
    } else {
      finalStatus = "FAILED";
    }

    await storage.updatePayrollExportJob(jobId, {
      status: finalStatus,
      finishedAt: new Date(),
      totalEntries,
      successfulEntries,
      failedEntries,
      errorSummary: errors.length > 0 ? errors.join("; ") : null,
      bambooResponse: { results },
    });

    // Update pay period status to EXPORTED on successful export
    if (finalStatus === "SUCCESS") {
      console.log(`[BambooHR Export] Updating pay period ${job.payPeriodId} to EXPORTED status`);
      await storage.updatePayPeriod(job.payPeriodId, { status: "EXPORTED" });
    }

    console.log(
      `[BambooHR Export] Job ${jobId} completed: ${finalStatus} (${successfulEntries}/${totalEntries} success, ${skippedCount} skipped)`
    );

    return {
      jobId,
      status: finalStatus,
      totalEntries,
      successfulEntries,
      failedEntries,
      skippedEntries: skippedCount,
      errors,
    };
  }

  async retryFailedEntries(jobId: string): Promise<ExportJobResult> {
    console.log(`[BambooHR Export] Retrying failed entries for job ${jobId}`);

    const job = await storage.getPayrollExportJob(jobId);
    if (!job) {
      throw new NotFoundError("Export job not found");
    }

    const bambooHRService = createBambooHRService();
    if (!bambooHRService) {
      throw new ValidationError("BambooHR service not configured");
    }

    const failedEntries = await storage.getPayrollExportJobEntriesByStatus(jobId, "FAILED");
    if (failedEntries.length === 0) {
      console.log(`[BambooHR Export] No failed entries to retry for job ${jobId}`);
      return {
        jobId,
        status: "SUCCESS",
        totalEntries: 0,
        successfulEntries: 0,
        failedEntries: 0,
        skippedEntries: 0,
        errors: [],
      };
    }

    const results: ExportEntryResult[] = [];
    const errors: string[] = [];
    let retriedSuccess = 0;
    let retriedFailed = 0;

    for (const entry of failedEntries) {
      if (entry.bambooEmployeeId === "MISSING") {
        const user = await storage.getUser(entry.driverId);
        const bambooId = user?.bambooEmployeeId;

        if (!bambooId) {
          const errorMsg = `Driver ${entry.driverId} still missing BambooHR employee ID`;
          console.error(`[BambooHR Export] ${errorMsg}`);
          errors.push(errorMsg);
          results.push({
            id: entry.id,
            idempotencyKey: entry.idempotencyKey,
            success: false,
            skipped: false,
            error: errorMsg,
          });
          retriedFailed++;
          continue;
        }

        await storage.updatePayrollExportJobEntry(entry.id, {
          bambooEmployeeId: bambooId,
        });
        entry.bambooEmployeeId = bambooId;
      }

      const payload = {
        employeeId: entry.bambooEmployeeId,
        date: entry.date,
        hours: parseFloat(entry.regularHours as string),
        overtimeHours: parseFloat((entry.overtimeHours || "0") as string),
        doubleTimeHours: parseFloat((entry.doubleTimeHours || "0") as string),
        note: `Auto-exported from Kid Commute - ${entry.totalHours} total hours (retry)`,
      };

      await storage.updatePayrollExportJobEntry(entry.id, {
        status: "RUNNING",
        payloadJson: payload,
        errorMessage: null,
      });

      try {
        const response = await bambooHRService.submitTimeEntry(payload);

        if (response.success) {
          await storage.updatePayrollExportJobEntry(entry.id, {
            status: "SUCCESS",
            bambooEntryId: response.entryId,
            bambooResponseJson: response,
          });
          results.push({
            id: entry.id,
            idempotencyKey: entry.idempotencyKey,
            success: true,
            skipped: false,
            bambooEntryId: response.entryId,
          });
          retriedSuccess++;
        } else {
          const errorMsg = response.error || "Unknown BambooHR error";
          await storage.updatePayrollExportJobEntry(entry.id, {
            status: "FAILED",
            errorMessage: errorMsg,
            bambooResponseJson: response,
          });
          errors.push(`Entry ${entry.id} (${entry.date}): ${errorMsg}`);
          results.push({
            id: entry.id,
            idempotencyKey: entry.idempotencyKey,
            success: false,
            skipped: false,
            error: errorMsg,
          });
          retriedFailed++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await storage.updatePayrollExportJobEntry(entry.id, {
          status: "FAILED",
          errorMessage: errorMsg,
        });
        errors.push(`Entry ${entry.id} (${entry.date}): ${errorMsg}`);
        results.push({
          id: entry.id,
          idempotencyKey: entry.idempotencyKey,
          success: false,
          skipped: false,
          error: errorMsg,
        });
        retriedFailed++;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const allEntries = await storage.getPayrollExportJobEntries(jobId);
    const totalSuccess = allEntries.filter((e) => e.status === "SUCCESS").length;
    const totalFailed = allEntries.filter((e) => e.status === "FAILED").length;

    let finalStatus: "SUCCESS" | "PARTIAL" | "FAILED";
    if (totalFailed === 0) {
      finalStatus = "SUCCESS";
    } else if (totalSuccess > 0) {
      finalStatus = "PARTIAL";
    } else {
      finalStatus = "FAILED";
    }

    await storage.updatePayrollExportJob(jobId, {
      status: finalStatus,
      successfulEntries: totalSuccess,
      failedEntries: totalFailed,
      errorSummary: errors.length > 0 ? errors.join("; ") : null,
    });

    console.log(
      `[BambooHR Export] Retry for job ${jobId} completed: ${retriedSuccess} success, ${retriedFailed} failed`
    );

    return {
      jobId,
      status: finalStatus,
      totalEntries: failedEntries.length,
      successfulEntries: retriedSuccess,
      failedEntries: retriedFailed,
      skippedEntries: 0,
      errors,
    };
  }

  async getExportPreview(payPeriodId: string): Promise<ExportPreview> {
    console.log(`[BambooHR Export] Getting export preview for pay period ${payPeriodId}`);

    const payPeriod = await storage.getPayPeriod(payPeriodId);
    if (!payPeriod) {
      throw new NotFoundError("Pay period not found");
    }

    const timesheetEntries = await storage.getTimesheetEntriesForPayPeriod(payPeriodId);
    const approvedEntries = timesheetEntries.filter((e) => e.status === "APPROVED");
    const draftEntries = timesheetEntries.filter((e) => e.status === "DRAFT");

    const aggregatedEntries = await this.aggregateTimesheetEntriesByDriverDate(
      approvedEntries,
      payPeriodId
    );

    const drivers = await storage.getUsersByRole("driver");
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const driverIds = Array.from(new Set(aggregatedEntries.map((e) => e.driverId)));
    const driversWithMapping = driverIds.filter((id) => {
      const driver = driverMap.get(id);
      return driver?.bambooEmployeeId;
    });
    const driversWithoutMapping = driverIds.filter((id) => {
      const driver = driverMap.get(id);
      return !driver?.bambooEmployeeId;
    });

    const warnings: string[] = [];

    if (payPeriod.status !== "APPROVED") {
      warnings.push(`Pay period status is ${payPeriod.status}, not APPROVED`);
    }

    if (draftEntries.length > 0) {
      warnings.push(`${draftEntries.length} timesheet entries are still in DRAFT status`);
    }

    if (driversWithoutMapping.length > 0) {
      const names = driversWithoutMapping
        .map((id) => {
          const driver = driverMap.get(id);
          return driver ? `${driver.firstName} ${driver.lastName}` : id;
        })
        .join(", ");
      warnings.push(`Drivers missing BambooHR mapping: ${names}`);
    }

    const idempotencyKeys = aggregatedEntries.map((e) => e.idempotencyKey);
    const existingExports = await storage.findSuccessfulExportsByIdempotencyKeys(idempotencyKeys);
    if (existingExports.length > 0) {
      warnings.push(`${existingExports.length} entries have already been exported`);
    }

    const entryDetails: DriverDateAggregation[] = aggregatedEntries.map((e) => ({
      driverId: e.driverId,
      driverName: e.driverName,
      bambooEmployeeId: e.bambooEmployeeId,
      date: e.date,
      totalHours: e.totalHours,
      regularHours: e.regularHours,
      overtimeHours: e.overtimeHours,
      doubleTimeHours: e.doubleTimeHours,
      timesheetEntryIds: e.timesheetEntryIds,
    }));

    const canExport =
      payPeriod.status === "APPROVED" &&
      driversWithoutMapping.length === 0 &&
      approvedEntries.length > 0;

    return {
      payPeriodId,
      payPeriodStatus: payPeriod.status,
      startDate: payPeriod.startDate,
      endDate: payPeriod.endDate,
      entries: entryDetails,
      summary: {
        totalDrivers: driverIds.length,
        totalDays: Array.from(new Set(aggregatedEntries.map((e) => e.date))).length,
        totalHours: aggregatedEntries.reduce((sum, e) => sum + e.totalHours, 0),
        driversWithMapping: driversWithMapping.length,
        driversWithoutMapping: driversWithoutMapping.length,
      },
      warnings,
      canExport,
    };
  }

  private async aggregateTimesheetEntriesByDriverDate(
    entries: TimesheetEntry[],
    payPeriodId: string
  ): Promise<
    (DriverDateAggregation & { idempotencyKey: string })[]
  > {
    const drivers = await storage.getUsersByRole("driver");
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const aggregationMap = new Map<
      string,
      {
        driverId: string;
        driverName: string;
        bambooEmployeeId: string | null;
        date: string;
        totalHours: number;
        regularHours: number;
        overtimeHours: number;
        doubleTimeHours: number;
        timesheetEntryIds: string[];
      }
    >();

    for (const entry of entries) {
      if (!entry.startAtUtc) continue;

      const date = new Date(entry.startAtUtc).toISOString().split("T")[0];
      const key = `${entry.driverId}_${date}`;

      const driver = driverMap.get(entry.driverId);
      const driverName = driver
        ? `${driver.firstName || ""} ${driver.lastName || ""}`.trim()
        : entry.driverId;

      const netHours = parseFloat((entry.totalHours || "0") as string);
      const regularHours = parseFloat((entry.regularHours || "0") as string);
      const overtimeHours = parseFloat((entry.overtimeHours || "0") as string);
      const doubleTimeHours = parseFloat((entry.doubleTimeHours || "0") as string);

      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, {
          driverId: entry.driverId,
          driverName,
          bambooEmployeeId: driver?.bambooEmployeeId || null,
          date,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          doubleTimeHours: 0,
          timesheetEntryIds: [],
        });
      }

      const agg = aggregationMap.get(key)!;
      agg.totalHours += netHours;
      agg.regularHours += regularHours;
      agg.overtimeHours += overtimeHours;
      agg.doubleTimeHours += doubleTimeHours;
      agg.timesheetEntryIds.push(entry.id);
    }

    return Array.from(aggregationMap.entries()).map(([_, agg]) => ({
      ...agg,
      idempotencyKey: `${payPeriodId}_${agg.driverId}_${agg.date}`,
    }));
  }

  async getJob(jobId: string): Promise<PayrollExportJob | undefined> {
    return storage.getPayrollExportJob(jobId);
  }

  async getJobWithEntries(
    jobId: string
  ): Promise<{ job: PayrollExportJob; entries: PayrollExportJobEntry[] } | undefined> {
    const job = await storage.getPayrollExportJob(jobId);
    if (!job) return undefined;

    const entries = await storage.getPayrollExportJobEntries(jobId);
    return { job, entries };
  }

  async listJobs(payPeriodId?: string): Promise<PayrollExportJob[]> {
    return storage.getPayrollExportJobs(payPeriodId);
  }
}

export const bambooHRExportService = new BambooHRExportService();
