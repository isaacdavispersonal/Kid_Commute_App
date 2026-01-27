import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, Package, FileText, Clock, AlertTriangle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Import the individual page components (we'll keep their logic as components)
import RouteHealthSection from "./sections/route-health-section";
import DriverUtilitiesSection from "./sections/driver-utilities-section";
import AuditLogSection from "./sections/audit-log-section";
import TimeManagementSection from "./sections/time-management-section";
import RouteRequestsSection from "./sections/route-requests-section";

interface BadgeData {
  total: number;
  bySection: {
    routeHealth: number;
    driverUtilities: number;
    auditLog: number;
    timeManagement: number;
    routeRequests: number;
  };
}

// Map tab values to section names
const tabToSection: Record<string, string> = {
  "route-health": "routeHealth",
  "driver-utilities": "driverUtilities",
  "audit-log": "auditLog",
  "time-management": "timeManagement",
  "route-requests": "routeRequests",
};

export default function ActivityOperationsPage() {
  const [activeTab, setActiveTab] = useState("route-health");
  const acknowledgedTabsRef = useRef<Set<string>>(new Set());

  // Fetch badge counts
  const { data: badges } = useQuery<BadgeData>({
    queryKey: ["/api/admin/badges/activity-operations"],
    refetchInterval: 15000,
  });

  // Mutation to acknowledge a section
  const acknowledgeMutation = useMutation({
    mutationFn: async (section: string) => {
      return apiRequest("POST", "/api/admin/acknowledge-section", { section });
    },
    onSuccess: () => {
      // Refresh badge counts
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges/activity-operations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
    },
  });

  // Auto-acknowledge section when viewed (only once per session)
  useEffect(() => {
    const section = tabToSection[activeTab];
    if (section && !acknowledgedTabsRef.current.has(activeTab)) {
      // Mark as acknowledged after a short delay to ensure user actually viewed the content
      const timer = setTimeout(() => {
        acknowledgedTabsRef.current.add(activeTab);
        acknowledgeMutation.mutate(section);
      }, 2000); // 2 second delay before acknowledging
      
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const routeHealthBadge = badges?.bySection.routeHealth || 0;
  const driverUtilitiesBadge = badges?.bySection.driverUtilities || 0;
  const auditLogBadge = badges?.bySection.auditLog || 0;
  const timeManagementBadge = badges?.bySection.timeManagement || 0;
  const routeRequestsBadge = badges?.bySection.routeRequests || 0;

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1" data-testid="heading-activity-operations">
          Activity & Operations
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Monitor fleet health, driver utilities, and time management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
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
          <TabsTrigger value="route-requests" className="flex items-center gap-1 text-xs sm:text-sm py-2" data-testid="tab-route-requests">
            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Requests</span>
            <span className="sm:hidden">Req</span>
            {routeRequestsBadge > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]" data-testid="badge-route-requests">
                {routeRequestsBadge}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="driver-utilities" className="flex items-center gap-1 text-xs sm:text-sm py-2" data-testid="tab-driver-utilities">
            <Package className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Utilities</span>
            <span className="sm:hidden">Utils</span>
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
            <span className="hidden sm:inline">Time</span>
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

        <TabsContent value="route-requests" className="mt-4 sm:mt-6">
          <RouteRequestsSection />
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
