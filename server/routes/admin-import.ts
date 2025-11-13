/**
 * Admin Import Routes
 * Handles bulk import of stops and students from text data
 */

import type { Express, Request, Response } from "express";
import type { IStorage } from "../storage";
import { parseStops, parseStudents } from "../import-parser";
import {
  importPreviewRequestSchema,
  importCommitRequestSchema,
  type ImportStopsPreviewResponse,
  type ImportStudentsPreviewResponse,
  type ImportStopsCommitResponse,
  type ImportStudentsCommitResponse,
} from "@shared/schema";

export function registerAdminImportRoutes(
  app: Express,
  storage: IStorage,
  isAuthenticated: any,
  requireRole: any
) {
  /**
   * Preview stops import - Parse and validate without saving
   * POST /api/admin/import/stops/preview
   */
  app.post(
    "/api/admin/import/stops/preview",
    isAuthenticated,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const { text, region } = importPreviewRequestSchema.parse(req.body);
        
        const parseResult = parseStops(text, region);
        
        const response: ImportStopsPreviewResponse = {
          success: parseResult.success,
          stops: parseResult.stops,
          errors: parseResult.errors,
        };
        
        res.json(response);
      } catch (error) {
        console.error("Error previewing stops import:", error);
        res.status(400).json({
          success: false,
          message: error instanceof Error ? error.message : "Failed to preview stops",
        });
      }
    }
  );

  /**
   * Commit stops import - Parse and save to database
   * POST /api/admin/import/stops/commit
   */
  app.post(
    "/api/admin/import/stops/commit",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res: Response) => {
      try {
        const { text, region, source: userSource } = importCommitRequestSchema.parse(req.body);
        
        // Auto-generate source if not provided
        const source = userSource || `manual:${req.user.id}:${new Date().toISOString().split('T')[0]}`;
        
        // Parse the text
        const parseResult = parseStops(text, region);
        
        if (!parseResult.success || parseResult.errors.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Failed to parse stops",
            errors: parseResult.errors,
          });
        }
        
        // Commit to database
        const result = await storage.bulkUpsertStops(parseResult.stops, source);
        
        const response: ImportStopsCommitResponse = {
          success: true,
          created: result.created,
          skipped: result.skipped,
          warnings: result.skipped.map(s => s.message),
          source,
        };
        
        res.json(response);
      } catch (error) {
        console.error("Error committing stops import:", error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : "Failed to import stops",
        });
      }
    }
  );

  /**
   * Preview students import - Parse and validate without saving
   * POST /api/admin/import/students/preview
   */
  app.post(
    "/api/admin/import/students/preview",
    isAuthenticated,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const { text } = importPreviewRequestSchema.parse(req.body);
        
        const parseResult = parseStudents(text);
        
        const response: ImportStudentsPreviewResponse = {
          success: parseResult.success,
          students: parseResult.students,
          errors: parseResult.errors,
        };
        
        res.json(response);
      } catch (error) {
        console.error("Error previewing students import:", error);
        res.status(400).json({
          success: false,
          message: error instanceof Error ? error.message : "Failed to preview students",
        });
      }
    }
  );

  /**
   * Commit students import - Parse and save to database
   * POST /api/admin/import/students/commit
   */
  app.post(
    "/api/admin/import/students/commit",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res: Response) => {
      try {
        const { text, source: userSource } = importCommitRequestSchema.parse(req.body);
        
        // Auto-generate source if not provided
        const source = userSource || `manual:${req.user.id}:${new Date().toISOString().split('T')[0]}`;
        
        // Parse the text
        const parseResult = parseStudents(text);
        
        if (!parseResult.success || parseResult.errors.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Failed to parse students",
            errors: parseResult.errors,
          });
        }
        
        // Commit to database
        const result = await storage.bulkCreateStudents(parseResult.students, source);
        
        const response: ImportStudentsCommitResponse = {
          success: true,
          created: result.created,
          skipped: result.skipped,
          warnings: result.skipped.map(s => s.message),
          source,
        };
        
        res.json(response);
      } catch (error) {
        console.error("Error committing students import:", error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : "Failed to import students",
        });
      }
    }
  );
}
