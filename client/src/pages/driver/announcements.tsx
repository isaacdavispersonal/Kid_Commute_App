import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRole: "admin" | "driver" | "parent";
  createdAt: string;
  adminId: string;
}

interface RouteAnnouncement {
  id: string;
  routeId: string;
  driverId: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function DriverAnnouncements() {
  const { data: globalAnnouncements, isLoading: loadingGlobal } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const { data: routeAnnouncements, isLoading: loadingRoute } = useQuery<RouteAnnouncement[]>({
    queryKey: ["/api/driver/route-announcements"],
  });

  const handleDismiss = async (announcementId: string) => {
    await apiRequest("POST", "/api/announcements/dismiss", { announcementId });
    await queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
  };

  const handleDismissRoute = async (announcementId: string) => {
    await apiRequest("POST", "/api/driver/route-announcements/dismiss", { announcementId });
    await queryClient.invalidateQueries({ queryKey: ["/api/driver/route-announcements"] });
  };

  const unreadGlobalCount = globalAnnouncements?.length || 0;
  const unreadRouteCount = routeAnnouncements?.length || 0;
  const totalUnread = unreadGlobalCount + unreadRouteCount;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-primary" data-testid="icon-announcements" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-announcements">Announcements</h1>
            <p className="text-muted-foreground">View all system and route announcements</p>
          </div>
        </div>
        {totalUnread > 0 && (
          <Badge variant="default" data-testid="badge-total-unread">
            {totalUnread} New
          </Badge>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All
            {totalUnread > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                {totalUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            System
            {unreadGlobalCount > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                {unreadGlobalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="route" data-testid="tab-route">
            Route
            {unreadRouteCount > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                {unreadRouteCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loadingGlobal || loadingRoute ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : (
            <>
              {globalAnnouncements && globalAnnouncements.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">System Announcements</h3>
                  {globalAnnouncements.map((announcement) => (
                    <Card key={announcement.id} data-testid={`announcement-${announcement.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base">{announcement.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(announcement.id)}
                          data-testid={`button-dismiss-${announcement.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          {announcement.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistance(new Date(announcement.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {routeAnnouncements && routeAnnouncements.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Route Announcements</h3>
                  {routeAnnouncements.map((announcement) => (
                    <Card key={announcement.id} data-testid={`route-announcement-${announcement.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base">{announcement.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismissRoute(announcement.id)}
                          data-testid={`button-dismiss-route-${announcement.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          {announcement.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistance(new Date(announcement.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {(!globalAnnouncements || globalAnnouncements.length === 0) &&
                (!routeAnnouncements || routeAnnouncements.length === 0) && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No Announcements</h3>
                      <p className="text-muted-foreground text-sm">
                        All caught up! No new announcements to display.
                      </p>
                    </CardContent>
                  </Card>
                )}
            </>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {loadingGlobal ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : globalAnnouncements && globalAnnouncements.length > 0 ? (
            globalAnnouncements.map((announcement) => (
              <Card key={announcement.id} data-testid={`system-announcement-${announcement.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{announcement.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(announcement.id)}
                    data-testid={`button-dismiss-system-${announcement.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {announcement.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance(new Date(announcement.createdAt), new Date(), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No System Announcements</h3>
                <p className="text-muted-foreground text-sm">
                  All caught up! No new system announcements.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="route" className="space-y-4">
          {loadingRoute ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : routeAnnouncements && routeAnnouncements.length > 0 ? (
            routeAnnouncements.map((announcement) => (
              <Card key={announcement.id} data-testid={`route-only-announcement-${announcement.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{announcement.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismissRoute(announcement.id)}
                    data-testid={`button-dismiss-route-only-${announcement.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {announcement.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance(new Date(announcement.createdAt), new Date(), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Route Announcements</h3>
                <p className="text-muted-foreground text-sm">
                  All caught up! No new route announcements.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
