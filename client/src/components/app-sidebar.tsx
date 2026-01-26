// Admin sidebar navigation component
import { useEffect, useRef, useCallback } from "react";
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
  Package,
  Activity,
  Map,
  DollarSign,
  Megaphone,
  Star,
  Settings2
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
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings2,
      },
    ],
  },
];

// Lead driver menu items (subset of admin features)
const leadDriverMenuItems = [
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
      {
        title: "My Students",
        url: "/driver/students",
        icon: Users,
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
  isLeadDriver?: boolean;
}

const SIDEBAR_SCROLL_KEY = "sidebar-scroll-position";

export function AppSidebar({ userRole = "admin", isLeadDriver = false }: AppSidebarProps) {
  const [location] = useLocation();
  const { isMobile, setOpenMobile, open, openMobile } = useSidebar();
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  // Fetch unread counts
  const { data: unreadCounts } = useQuery<{
    messages: number;
    announcements: number;
    notifications: number;
    flaggedChecklists?: number;
  }>({
    queryKey: ["/api/user/unread-counts"],
    refetchInterval: 15000,
  });

  // Fetch activity operations badges for admins
  const { data: activityBadges } = useQuery<{
    total: number;
    bySection: {
      routeHealth: number;
      driverUtilities: number;
      auditLog: number;
      timeManagement: number;
    };
  }>({
    queryKey: ["/api/admin/badges/activity-operations"],
    refetchInterval: 15000,
    enabled: userRole === "admin",
  });

  const totalUnread = (unreadCounts?.messages || 0) + (unreadCounts?.announcements || 0) + (unreadCounts?.notifications || 0);
  const activityBadgeTotal = activityBadges?.total || 0;

  // Determine if sidebar is currently open
  const isOpen = isMobile ? openMobile : open;

  // Stable scroll handler
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      if (scrollTop > 0) {
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, scrollTop.toString());
      } else {
        sessionStorage.removeItem(SIDEBAR_SCROLL_KEY);
      }
    }
  }, []);

  // Set up scroll container reference and handlers
  useEffect(() => {
    // Find the scrollable SidebarContent element
    const findScrollContainer = () => {
      const container = document.querySelector('[data-sidebar="content"]') as HTMLElement | null;
      if (container && container !== scrollContainerRef.current) {
        // Remove old listener if exists
        if (scrollContainerRef.current && scrollHandlerRef.current) {
          scrollContainerRef.current.removeEventListener('scroll', scrollHandlerRef.current);
        }
        
        scrollContainerRef.current = container;
        scrollHandlerRef.current = handleScroll;
        container.addEventListener('scroll', handleScroll, { passive: true });
      }
      return container;
    };

    const container = findScrollContainer();
    
    // Restore scroll position when sidebar opens
    if (isOpen && container) {
      const savedPosition = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      if (savedPosition) {
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = parseInt(savedPosition, 10);
          }
        });
      } else {
        // Scroll active item into view if no saved position
        const activeItem = container.querySelector('[data-active="true"]') as HTMLElement | null;
        if (activeItem) {
          requestAnimationFrame(() => {
            activeItem.scrollIntoView({ block: "center", behavior: "instant" });
          });
        }
      }
    }

    return () => {
      if (scrollContainerRef.current && scrollHandlerRef.current) {
        scrollContainerRef.current.removeEventListener('scroll', scrollHandlerRef.current);
      }
    };
  }, [isOpen, handleScroll]);

  const handleNavigation = () => {
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderMenuItem = (item: { title: string; url: string; icon: any }) => {
    const isActive = location === item.url;
    const isMessages = item.title === "Messages";
    const isActivityOperations = item.title === "Activity & Operations";
    const showMessagesBadge = isMessages && totalUnread > 0;
    const showActivityBadge = isActivityOperations && activityBadgeTotal > 0 && userRole === "admin";
    const showBadge = showMessagesBadge || showActivityBadge;
    const badgeCount = showMessagesBadge ? totalUnread : activityBadgeTotal;

    return (
      <SidebarMenuItem key={item.title} data-active={isActive ? "true" : undefined}>
        <SidebarMenuButton
          asChild
          size="lg"
          className={isActive ? "bg-sidebar-accent" : ""}
          data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Link 
            href={item.url} 
            onClick={handleNavigation}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-base">{item.title}</span>
            {showBadge && (
              <Badge 
                variant="destructive" 
                className="ml-auto h-5 min-w-5 px-1 text-xs"
                data-testid={showActivityBadge ? "badge-activity-operations" : "badge-unread-count"}
              >
                {badgeCount}
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
                {/* Dashboard section */}
                <SidebarMenu className="gap-1.5">
                  {driverMenuSections[0].items.map(renderMenuItem)}
                </SidebarMenu>
                
                {/* Lead Driver Section - prominently placed after Dashboard */}
                {isLeadDriver && (
                  <SidebarGroup className="mt-3">
                    <SidebarSeparator className="mb-3" />
                    <SidebarGroupLabel className="mb-2 text-sm font-medium px-3 flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      Lead Driver
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-1.5">
                        {leadDriverMenuItems.map(renderMenuItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                )}
                
                {/* Remaining driver sections */}
                {driverMenuSections.slice(1).map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    <SidebarSeparator className="my-3" />
                    {section.label && (
                      <SidebarGroupLabel className="mb-2 text-sm font-medium text-muted-foreground px-3">
                        {section.label}
                      </SidebarGroupLabel>
                    )}
                    <SidebarMenu className="gap-1.5">
                      {section.items.map(renderMenuItem)}
                    </SidebarMenu>
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
