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
  Navigation,
  Link2,
  Map,
  DollarSign,
  Upload
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
  useSidebar,
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
        title: "Activity & Operations",
        url: "/admin/activity-operations",
        icon: Activity,
      },
      {
        title: "Payroll Exports",
        url: "/admin/payroll-exports",
        icon: DollarSign,
      },
      {
        title: "Incidents",
        url: "/admin/incidents",
        icon: AlertTriangle,
      },
    ],
  },
  {
    label: "GPS & Tracking",
    items: [
      {
        title: "Live Fleet Map",
        url: "/admin/fleet-map",
        icon: Map,
      },
      {
        title: "GPS Settings",
        url: "/admin/gps-settings",
        icon: Navigation,
      },
      {
        title: "Samsara Integration",
        url: "/admin/samsara-integration",
        icon: Link2,
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
  const { isMobile, setOpenMobile } = useSidebar();

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

  const handleNavigation = () => {
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderMenuItem = (item: { title: string; url: string; icon: any }) => {
    const isActive = location === item.url;
    const isMessages = item.title === "Messages";
    const showBadge = isMessages && totalUnread > 0;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          size="lg"
          className={isActive ? "bg-sidebar-accent" : ""}
          data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Link href={item.url} onClick={handleNavigation}>
            <item.icon className="h-5 w-5" />
            <span className="text-base">{item.title}</span>
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
      <SidebarContent className="pt-6 pb-8">
        <SidebarGroup>
          {/* App Title - visually distinct from menu items */}
          <div className="px-3 mb-6">
            <h1 className="text-xl font-bold text-primary tracking-tight">
              Kid Commute
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transportation Management
            </p>
          </div>
          <SidebarSeparator className="mb-4" />
          <SidebarGroupContent>
            {userRole === "admin" && (
              <>
                {adminMenuSections.map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    {section.label && (
                      <SidebarGroupLabel className="mt-6 mb-2 text-sm font-medium text-muted-foreground px-3">
                        {section.label}
                      </SidebarGroupLabel>
                    )}
                    <SidebarMenu className="gap-1.5">
                      {section.items.map(renderMenuItem)}
                    </SidebarMenu>
                    {sectionIndex < adminMenuSections.length - 1 && (
                      <SidebarSeparator className="my-3" />
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
                      <SidebarGroupLabel className="mt-6 mb-2 text-sm font-medium text-muted-foreground px-3">
                        {section.label}
                      </SidebarGroupLabel>
                    )}
                    <SidebarMenu className="gap-1.5">
                      {section.items.map(renderMenuItem)}
                    </SidebarMenu>
                    {sectionIndex < driverMenuSections.length - 1 && sectionIndex === 0 && (
                      <SidebarSeparator className="my-3" />
                    )}
                  </div>
                ))}
              </>
            )}
            {userRole === "parent" && (
              <SidebarMenu className="gap-1.5">
                {parentMenuItems.map(renderMenuItem)}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
