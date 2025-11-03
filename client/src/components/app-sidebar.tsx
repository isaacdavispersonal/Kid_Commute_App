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
  User
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
    ],
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
    title: "My Schedule",
    url: "/driver/schedule",
    icon: Calendar,
  },
  {
    title: "Attendance",
    url: "/driver/attendance",
    icon: ClipboardCheck,
  },
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
    title: "Vehicle Check",
    url: "/driver/inspection",
    icon: ClipboardCheck,
  },
  {
    title: "Report Incident",
    url: "/driver/incident",
    icon: AlertTriangle,
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
    refetchInterval: 10000, // Refresh every 10 seconds
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
            {userRole === "admin" ? (
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
            ) : (
              <SidebarMenu>
                {(userRole === "driver" ? driverMenuItems : parentMenuItems).map(renderMenuItem)}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
