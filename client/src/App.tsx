// Main App component with role-based routing - Unified JWT authentication
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { Button } from "@/components/ui/button";
import { LogOut, User, UserCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isConfigured, getConfigError } from "@/lib/config";
import { ConfigErrorScreen } from "@/components/config-error-screen";

import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Profile from "@/pages/profile";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminVehicles from "@/pages/admin/vehicles";
import AdminFleetMap from "@/pages/admin/fleet-map";
import AdminRoutes from "@/pages/admin/routes";
import AdminStops from "@/pages/admin/stops";
import AdminGeofences from "@/pages/admin/geofences";
import AdminSchedule from "@/pages/admin/schedule";
import AdminUsers from "@/pages/admin/users";
import AdminStudents from "@/pages/admin/students";
import AdminDriverAssignments from "@/pages/admin/driver-assignments";
import AdminAnnouncements from "@/pages/admin/announcements";
import AdminActivityOperations from "@/pages/admin/activity-operations";
import AdminIncidents from "@/pages/admin/incidents";
import AdminGPSSettings from "@/pages/admin/gps-settings";
import AdminSamsaraIntegration from "@/pages/admin/samsara-integration";
import AdminPayrollExports from "@/pages/admin/payroll-exports";
import AdminSettings from "@/pages/admin/settings";

import DriverDashboard from "@/pages/driver/dashboard";
import DriverRoutes from "@/pages/driver/routes";
import DriverRoute from "@/pages/driver/route";
import DriverSchedule from "@/pages/driver/schedule";
import DriverTimeHistory from "@/pages/driver/time-history";
import DriverInspection from "@/pages/driver/inspection";
import DriverIncident from "@/pages/driver/incident";
import DriverAttendance from "@/pages/driver/attendance";
import DriverAnnouncements from "@/pages/driver/announcements";
import DriverSupplies from "@/pages/driver/supplies";
import DriverChecklist from "@/pages/driver/checklist";
import DriverStudents from "@/pages/driver/students";

import ParentDashboard from "@/pages/parent/dashboard";
import ParentTracking from "@/pages/parent/tracking";
import ParentChildren from "@/pages/parent/children";
import ParentMessages from "@/pages/parent/messages";

import DriverMessages from "@/pages/driver/messages";
import AdminMessages from "@/pages/admin/messages";

import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";

function Router() {
  // Unified auth hook works for both web and mobile platforms
  const { user, isAuthenticated, isLoading, logout } = useUnifiedAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Show unified landing page for both web and mobile
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  const userRole = user.role || "parent";
  const isLeadDriver = userRole === "driver" && user.isLeadDriver === true;
  
  // Unified logout handler for both web and mobile
  const handleLogout = async () => {
    try {
      await logout();
      // Navigate to landing page after logout
      setLocation("/");
    } catch (error) {
      console.error("Logout error:", error);
      // Even on error, navigate to landing page
      setLocation("/");
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={userRole} isLeadDriver={isLeadDriver} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-card pt-[max(1rem,env(safe-area-inset-top))] ios-fixed-header shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="touch" className="gap-2" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {user.firstName || user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-sm">
                  <User className="h-4 w-4 mr-2" />
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-sm">
                  Role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="button-profile">
                  <Link href="/profile">
                    <UserCog className="h-4 w-4 mr-2" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          {/* Spacer for fixed header - matches header height including safe area */}
          <div className="shrink-0 h-[calc(4.5rem+env(safe-area-inset-top,0px))]" />
          <main className="flex-1 overflow-y-auto p-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <Switch>
              {/* Common routes for all roles */}
              <Route path="/profile" component={Profile} />
              <Route path="/verify-email" component={VerifyEmail} />
              <Route path="/privacy-policy" component={PrivacyPolicy} />
              <Route path="/terms-of-service" component={TermsOfService} />
              
              {userRole === "admin" && (
                <>
                  <Route path="/" component={AdminDashboard} />
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/admin/dashboard" component={AdminDashboard} />
                  <Route path="/admin/vehicles" component={AdminVehicles} />
                  <Route path="/admin/fleet-map" component={AdminFleetMap} />
                  <Route path="/admin/routes" component={AdminRoutes} />
                  <Route path="/admin/stops" component={AdminStops} />
                  <Route path="/admin/geofences" component={AdminGeofences} />
                  <Route path="/admin/schedule" component={AdminSchedule} />
                  <Route path="/admin/users" component={AdminUsers} />
                  <Route path="/admin/students" component={AdminStudents} />
                  <Route path="/admin/driver-assignments" component={AdminDriverAssignments} />
                  <Route path="/admin/messages" component={AdminMessages} />
                  <Route path="/admin/announcements" component={AdminAnnouncements} />
                  <Route path="/admin/activity-operations" component={AdminActivityOperations} />
                  <Route path="/admin/incidents" component={AdminIncidents} />
                  <Route path="/admin/gps-settings" component={AdminGPSSettings} />
                  <Route path="/admin/samsara-integration" component={AdminSamsaraIntegration} />
                  <Route path="/admin/payroll-exports" component={AdminPayrollExports} />
                  <Route path="/admin/settings" component={AdminSettings} />
                  {/* Redirects for old routes */}
                  <Route path="/admin/time-exceptions">
                    {() => {
                      window.location.href = "/admin/activity-operations";
                      return null;
                    }}
                  </Route>
                  <Route path="/admin/time-management">
                    {() => {
                      window.location.href = "/admin/activity-operations";
                      return null;
                    }}
                  </Route>
                  <Route path="/admin/audit-log">
                    {() => {
                      window.location.href = "/admin/activity-operations";
                      return null;
                    }}
                  </Route>
                  <Route path="/admin/driver-utilities">
                    {() => {
                      window.location.href = "/admin/activity-operations";
                      return null;
                    }}
                  </Route>
                  <Route path="/admin/route-health">
                    {() => {
                      window.location.href = "/admin/activity-operations";
                      return null;
                    }}
                  </Route>
                </>
              )}
              {userRole === "driver" && (
                <>
                  <Route path="/" component={DriverDashboard} />
                  <Route path="/driver" component={DriverDashboard} />
                  <Route path="/driver/dashboard" component={DriverDashboard} />
                  <Route path="/driver/routes" component={DriverRoutes} />
                  <Route path="/driver/route/:shiftId" component={DriverRoute} />
                  <Route path="/driver/schedule" component={DriverSchedule} />
                  <Route path="/driver/attendance" component={DriverAttendance} />
                  <Route path="/driver/time-history" component={DriverTimeHistory} />
                  <Route path="/driver/inspection" component={DriverInspection} />
                  <Route path="/driver/incident" component={DriverIncident} />
                  <Route path="/driver/messages" component={DriverMessages} />
                  <Route path="/driver/announcements" component={DriverAnnouncements} />
                  <Route path="/driver/supplies" component={DriverSupplies} />
                  <Route path="/driver/checklist" component={DriverChecklist} />
                  <Route path="/driver/students" component={DriverStudents} />
                  {/* Lead Driver routes - access to specific admin pages */}
                  {isLeadDriver && (
                    <>
                      <Route path="/admin/driver-assignments" component={AdminDriverAssignments} />
                      <Route path="/admin/routes" component={AdminRoutes} />
                      <Route path="/admin/schedule" component={AdminSchedule} />
                      <Route path="/admin/stops" component={AdminStops} />
                    </>
                  )}
                </>
              )}
              {userRole === "parent" && (
                <>
                  <Route path="/" component={ParentDashboard} />
                  <Route path="/parent" component={ParentDashboard} />
                  <Route path="/parent/dashboard" component={ParentDashboard} />
                  <Route path="/parent/children" component={ParentChildren} />
                  <Route path="/parent/tracking" component={ParentTracking} />
                  <Route path="/parent/messages" component={ParentMessages} />
                </>
              )}
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  // Check for configuration errors (e.g., missing backend URL in mobile app)
  const configError = getConfigError();
  
  if (!isConfigured()) {
    return <ConfigErrorScreen errorMessage={configError || "Unknown configuration error"} />;
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
