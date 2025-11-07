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
  FileText,
  Megaphone,
  Package,
  Activity,
  Navigation
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const adminMenuSections = [
  {
    items: [
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
        title: "Students",
        url: "/admin/students",
        icon: UserCircle,
      },
      {
        title: "Vehicles",
        url: "/admin/vehicles",
        icon: Car,
      },
    ],
  },
  {
    items: [
      {
        title: "Driver Assignments",
        url: "/admin/driver-assignments",
        icon: Users,
      },
      {
        title: "Routes",
        url: "/admin/routes",
        icon: RouteIcon,
      },
      {
        title: "Schedule",
        url: "/admin/schedule",
        icon: Calendar,
      },
    ],
  },
  {
    items: [
      {
        title: "Messages",
        url: "/admin/messages",
        icon: MessageSquare,
      },
      {
        title: "Time Management",
        url: "/admin/time-management",
        icon: Clock,
      },
      {
        title: "Incidents",
        url: "/admin/incidents",
        icon: AlertTriangle,
      },
      {
        title: "Driver Utilities",
        url: "/admin/driver-utilities",
        icon: Package,
      },
      {
        title: "Audit Log",
        url: "/admin/audit-log",
        icon: FileText,
      },
      {
        title: "Route Health",
        url: "/admin/route-health",
        icon: Activity,
      },
      {
        title: "GPS Settings",
        url: "/admin/gps-settings",
        icon: Navigation,
      },
    ],
  },
];

const driverMenuSections = [
  {
    label: "Dashboard",
    items: [
      {
        title: "Dashboard",
        url: "/driver",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Routes & Schedule",
    items: [
      {
        title: "My Routes",
        url: "/driver/routes",
        icon: RouteIcon,
      },
      {
        title: "My Schedule",
        url: "/driver/schedule",
        icon: Calendar,
      },
      {
        title: "Attendance",
        url: "/driver/attendance",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Time & Communication",
    items: [
      {
        title: "Time History",
        url: "/driver/time-history",
        icon: Clock,
      },
      {
        title: "Messages",
        url: "/driver/messages",
        icon: MessageSquare,
      },
      {
        title: "Announcements",
        url: "/driver/announcements",
        icon: Megaphone,
      },
    ],
  },
  {
    label: "Utilities",
    items: [
      {
        title: "Vehicle Checklist",
        url: "/driver/checklist",
        icon: ClipboardCheck,
      },
      {
        title: "Supplies Request",
        url: "/driver/supplies",
        icon: Package,
      },
      {
        title: "Send Feedback",
        url: "/driver/feedback",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Reports",
    items: [
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
    ],
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
];

interface AppSidebarProps {
  userRole?: "admin" | "driver" | "parent";
}

export function AppSidebar({ userRole = "admin" }: AppSidebarProps) {
  const [location] = useLocation();

  // Fetch unread counts
  const { data: unreadCounts } = useQuery<{
    messages: number;
    announcements: number;
    notifications: number;
  }>({
    queryKey: ["/api/user/unread-counts"],
    refetchInterval: 15000, // Refresh every 15 seconds (reduced from 10s for better performance)
  });

  const totalUnread = (unreadCounts?.messages || 0) + (unreadCounts?.announcements || 0) + (unreadCounts?.notifications || 0);

  const renderMenuItem = (item: { title: string; url: string; icon: any }) => {
    const isActive = location === item.url;
    const isMessages = item.title === "Messages";
    const showBadge = isMessages && totalUnread > 0;

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
            {showBadge && (
              <Badge 
                variant="destructive" 
                className="ml-auto h-5 min-w-5 px-1 text-xs"
                data-testid="badge-unread-count"
              >
                {totalUnread}
              </Badge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold px-2 py-4">
            Kid Connect
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {userRole === "admin" && (
              <>
                {adminMenuSections.map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    <SidebarMenu>
                      {section.items.map(renderMenuItem)}
                    </SidebarMenu>
                    {sectionIndex < adminMenuSections.length - 1 && (
                      <SidebarSeparator className="my-2" />
                    )}
                  </div>
                ))}
              </>
            )}
            {userRole === "driver" && (
              <>
                {driverMenuSections.map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    {section.label && sectionIndex > 0 && (
                      <SidebarGroupLabel className="mt-4 mb-2 text-xs font-medium text-muted-foreground px-2">
                        {section.label}
                      </SidebarGroupLabel>
                    )}
                    <SidebarMenu>
                      {section.items.map(renderMenuItem)}
                    </SidebarMenu>
                    {sectionIndex < driverMenuSections.length - 1 && sectionIndex === 0 && (
                      <SidebarSeparator className="my-2" />
                    )}
                  </div>
                ))}
              </>
            )}
            {userRole === "parent" && (
              <SidebarMenu>
                {parentMenuItems.map(renderMenuItem)}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
