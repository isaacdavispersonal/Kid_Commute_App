// Admin sidebar navigation component
import { 
  LayoutDashboard, 
  Route as RouteIcon, 
  Users, 
  Car, 
  UserCircle, 
  Calendar, 
  AlertTriangle, 
  MessageSquare,
  Clock,
  ClipboardCheck,
  Shield,
  User,
  MapPin
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Shield,
  },
  {
    title: "Routes",
    url: "/admin/routes",
    icon: RouteIcon,
  },
  {
    title: "Stops",
    url: "/admin/stops",
    icon: MapPin,
  },
  {
    title: "Drivers",
    url: "/admin/drivers",
    icon: Users,
  },
  {
    title: "Students",
    url: "/admin/students",
    icon: UserCircle,
  },
  {
    title: "Vehicles",
    url: "/admin/vehicles",
    icon: Car,
  },
  {
    title: "Schedule",
    url: "/admin/schedule",
    icon: Calendar,
  },
  {
    title: "Incidents",
    url: "/admin/incidents",
    icon: AlertTriangle,
  },
  {
    title: "Messages",
    url: "/admin/messages",
    icon: MessageSquare,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
  },
];

const driverMenuItems = [
  {
    title: "Dashboard",
    url: "/driver",
    icon: LayoutDashboard,
  },
  {
    title: "My Routes",
    url: "/driver/routes",
    icon: RouteIcon,
  },
  {
    title: "Time Tracking",
    url: "/driver/time",
    icon: Clock,
  },
  {
    title: "Messages",
    url: "/driver/messages",
    icon: MessageSquare,
  },
  {
    title: "Vehicle Check",
    url: "/driver/inspection",
    icon: ClipboardCheck,
  },
  {
    title: "Report Incident",
    url: "/driver/incident",
    icon: AlertTriangle,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
  },
];

const parentMenuItems = [
  {
    title: "Dashboard",
    url: "/parent",
    icon: LayoutDashboard,
  },
  {
    title: "My Children",
    url: "/parent/children",
    icon: UserCircle,
  },
  {
    title: "Track Vehicle",
    url: "/parent/tracking",
    icon: Car,
  },
  {
    title: "Messages",
    url: "/parent/messages",
    icon: MessageSquare,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
  },
];

interface AppSidebarProps {
  userRole?: "admin" | "driver" | "parent";
}

export function AppSidebar({ userRole = "admin" }: AppSidebarProps) {
  const [location] = useLocation();

  const menuItems =
    userRole === "admin"
      ? adminMenuItems
      : userRole === "driver"
      ? driverMenuItems
      : parentMenuItems;

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold px-2 py-4">
            Kid Connect
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={isActive ? "bg-sidebar-accent" : ""}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
