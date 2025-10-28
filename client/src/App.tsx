// Main App component with role-based routing - Reference: Replit Auth blueprint
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Profile from "@/pages/profile";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminVehicles from "@/pages/admin/vehicles";
import AdminRoutes from "@/pages/admin/routes";
import AdminStops from "@/pages/admin/stops";
import AdminSchedule from "@/pages/admin/schedule";
import AdminUsers from "@/pages/admin/users";
import AdminStudents from "@/pages/admin/students";
import AdminDriverAssignments from "@/pages/admin/driver-assignments";
import AdminAnnouncements from "@/pages/admin/announcements";
import AdminTimeExceptions from "@/pages/admin/time-exceptions";

import DriverDashboard from "@/pages/driver/dashboard";
import DriverRoutes from "@/pages/driver/routes";
import DriverSchedule from "@/pages/driver/schedule";
import DriverInspection from "@/pages/driver/inspection";
import DriverIncident from "@/pages/driver/incident";

import ParentDashboard from "@/pages/parent/dashboard";
import ParentTracking from "@/pages/parent/tracking";
import ParentChildren from "@/pages/parent/children";
import ParentMessages from "@/pages/parent/messages";

import DriverMessages from "@/pages/driver/messages";
import AdminMessages from "@/pages/admin/messages";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  const userRole = user.role || "parent";

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={userRole} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-card">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2" data-testid="button-user-menu">
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
                <DropdownMenuItem
                  onClick={() => (window.location.href = "/api/logout")}
                  className="text-destructive focus:text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <Switch>
              {/* Common routes for all roles */}
              <Route path="/profile" component={Profile} />
              
              {userRole === "admin" && (
                <>
                  <Route path="/" component={AdminDashboard} />
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/admin/dashboard" component={AdminDashboard} />
                  <Route path="/admin/vehicles" component={AdminVehicles} />
                  <Route path="/admin/routes" component={AdminRoutes} />
                  <Route path="/admin/stops" component={AdminStops} />
                  <Route path="/admin/schedule" component={AdminSchedule} />
                  <Route path="/admin/users" component={AdminUsers} />
                  <Route path="/admin/students" component={AdminStudents} />
                  <Route path="/admin/driver-assignments" component={AdminDriverAssignments} />
                  <Route path="/admin/messages" component={AdminMessages} />
                  <Route path="/admin/announcements" component={AdminAnnouncements} />
                  <Route path="/admin/time-exceptions" component={AdminTimeExceptions} />
                </>
              )}
              {userRole === "driver" && (
                <>
                  <Route path="/" component={DriverDashboard} />
                  <Route path="/driver" component={DriverDashboard} />
                  <Route path="/driver/dashboard" component={DriverDashboard} />
                  <Route path="/driver/routes" component={DriverRoutes} />
                  <Route path="/driver/schedule" component={DriverSchedule} />
                  <Route path="/driver/inspection" component={DriverInspection} />
                  <Route path="/driver/incident" component={DriverIncident} />
                  <Route path="/driver/messages" component={DriverMessages} />
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
