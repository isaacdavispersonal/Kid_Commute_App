import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, Package, FileText, Clock } from "lucide-react";

// Import the individual page components (we'll keep their logic as components)
import RouteHealthSection from "./sections/route-health-section";
import DriverUtilitiesSection from "./sections/driver-utilities-section";
import AuditLogSection from "./sections/audit-log-section";
import TimeManagementSection from "./sections/time-management-section";

interface BadgeData {
  total: number;
  bySection: {
    routeHealth: number;
    driverUtilities: number;
    auditLog: number;
    timeManagement: number;
  };
}

export default function ActivityOperationsPage() {
  const [activeTab, setActiveTab] = useState("route-health");

  // Fetch badge counts
  const { data: badges } = useQuery<BadgeData>({
    queryKey: ["/api/admin/badges/activity-operations"],
    refetchInterval: 15000,
  });

  const routeHealthBadge = badges?.bySection.routeHealth || 0;
  const driverUtilitiesBadge = badges?.bySection.driverUtilities || 0;
  const auditLogBadge = badges?.bySection.auditLog || 0;
  const timeManagementBadge = badges?.bySection.timeManagement || 0;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1" data-testid="heading-activity-operations">
          Activity & Operations
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Monitor fleet health, driver utilities, and time management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="route-health" className="flex items-center gap-1 text-xs sm:text-sm py-2" data-testid="tab-route-health">
            <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Route Health</span>
            <span className="sm:hidden">Health</span>
            {routeHealthBadge > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]" data-testid="badge-route-health">
                {routeHealthBadge}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="driver-utilities" className="flex items-center gap-1 text-xs sm:text-sm py-2" data-testid="tab-driver-utilities">
            <Package className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Driver Utilities</span>
            <span className="sm:hidden">Utilities</span>
            {driverUtilitiesBadge > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]" data-testid="badge-driver-utilities">
                {driverUtilitiesBadge}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit-log" className="flex items-center gap-1 text-xs sm:text-sm py-2" data-testid="tab-audit-log">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Audit Log</span>
            <span className="sm:hidden">Audit</span>
            {auditLogBadge > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]" data-testid="badge-audit-log">
                {auditLogBadge}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="time-management" className="flex items-center gap-1 text-xs sm:text-sm py-2" data-testid="tab-time-management">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Time Management</span>
            <span className="sm:hidden">Time</span>
            {timeManagementBadge > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]" data-testid="badge-time-management">
                {timeManagementBadge}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="route-health" className="mt-4 sm:mt-6">
          <RouteHealthSection />
        </TabsContent>

        <TabsContent value="driver-utilities" className="mt-4 sm:mt-6">
          <DriverUtilitiesSection />
        </TabsContent>

        <TabsContent value="audit-log" className="mt-4 sm:mt-6">
          <AuditLogSection />
        </TabsContent>

        <TabsContent value="time-management" className="mt-4 sm:mt-6">
          <TimeManagementSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
