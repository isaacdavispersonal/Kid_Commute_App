export type DataUpdateResource = 
  | "routes"
  | "route-groups"
  | "stops"
  | "vehicles"
  | "driver-assignments"
  | "shifts"
  | "students"
  | "incidents"
  | "messages"
  | "announcements";

export type DataUpdateAction = "create" | "update" | "delete" | "bulk";

export interface DataUpdateMessage {
  type: "data_update";
  version: 1;
  resource: DataUpdateResource;
  action: DataUpdateAction;
  entityIds?: string[];
  scope?: {
    routeId?: string;
    organizationId?: string;
  };
  metadata?: Record<string, any>;
  actorId?: string;
  timestamp: string;
}

export interface GeofenceNotification {
  type: "notification";
  category: "geofence_exit" | "stop_completion" | "stop_approaching";
  shiftId: string;
  routeId?: string;
  routeStopId?: string;
  message: string;
  occurredAt: string;
  meta: Record<string, any>;
}

export type WebSocketMessage = DataUpdateMessage | GeofenceNotification;

export const RESOURCE_TO_QUERY_KEYS: Record<
  DataUpdateResource,
  string[]
> = {
  routes: ["/api/admin/routes", "/api/driver/routes"],
  "route-groups": ["/api/admin/route-groups"],
  stops: ["/api/admin/stops"],
  vehicles: ["/api/admin/vehicles"],
  "driver-assignments": ["/api/admin/driver-assignments"],
  shifts: ["/api/admin/shifts", "/api/driver/shifts"],
  students: ["/api/admin/students", "/api/parent/students"],
  incidents: ["/api/admin/incidents", "/api/driver/incidents"],
  messages: ["/api/messages", "/api/parent/messages", "/api/driver/messages"],
  announcements: ["/api/announcements", "/api/parent/announcements"],
};
