import type { RouteRun, Announcement, StudentAttendance } from "./schema";
import type { SQL } from "drizzle-orm";

export type AttendanceStatus = "PENDING" | "riding" | "absent" | "completed";

export interface AnnouncementWithDetails extends Announcement {
  adminName?: string | null;
  routeName?: string | null;
}

export interface AnnouncementQueryResult {
  announcements: AnnouncementWithDetails[];
  total: number;
}

export type SqlCondition = SQL<unknown>;

export interface AttendanceUpdatePayload {
  studentId: string;
  status: AttendanceStatus;
  stopId?: string;
  pickupTime?: string;
  dropoffTime?: string;
  updatedBy: string;
}

export interface StopArrivedPayload {
  stopId: string;
  arrivedAt: string;
  driverId: string;
}

export interface StopCompletedPayload {
  stopId: string;
  completedAt: string;
  driverId: string;
}

export interface RouteRunEventPayload {
  routeRun: RouteRun;
  primaryDriverId?: string;
}

export interface ParticipantEventPayload {
  participantId: string;
  userId: string;
  role: "PRIMARY" | "AID" | "VIEWER";
  routeRunId: string;
}

export interface AnnouncementCreatedPayload {
  announcement: Announcement;
  targetRouteId?: string;
  audienceType?: string;
}

export type SocketEventName = 
  | "route_run.started"
  | "route_run.ended_pending_review"
  | "route_run.finalized"
  | "route_run.reopened"
  | "stop.arrived"
  | "stop.completed"
  | "attendance.updated"
  | "announcement.created"
  | "participant.joined"
  | "participant.left"
  | "new_message";

export interface SocketEventMap {
  "route_run.started": RouteRunEventPayload;
  "route_run.ended_pending_review": { routeRun: RouteRun };
  "route_run.finalized": { routeRun: RouteRun };
  "route_run.reopened": { routeRun: RouteRun };
  "stop.arrived": StopArrivedPayload;
  "stop.completed": StopCompletedPayload;
  "attendance.updated": AttendanceUpdatePayload;
  "announcement.created": AnnouncementCreatedPayload;
  "participant.joined": ParticipantEventPayload;
  "participant.left": ParticipantEventPayload;
}
