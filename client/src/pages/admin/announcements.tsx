import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  AlertCircle, 
  Send, 
  Users, 
  History, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye
} from "lucide-react";
import { format } from "date-fns";

interface AnnouncementHistoryItem {
  id: string;
  adminId: string;
  targetRole: string;
  audienceType: string | null;
  routeId: string | null;
  title: string;
  content: string;
  expiresAt: string | null;
  targetCount: number | null;
  pushAttemptedAt: string | null;
  pushSuccessCount: number | null;
  pushFailureCount: number | null;
  lastPushError: string | null;
  createdAt: string;
  adminName: string | null;
  routeName: string | null;
}

interface HistoryResponse {
  announcements: AnnouncementHistoryItem[];
  total: number;
}

export default function AdminAnnouncements() {
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage broadcast announcements
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "history")}>
        <TabsList>
          <TabsTrigger value="create" data-testid="tab-create">
            <Send className="h-4 w-4 mr-2" />
            Create Announcement
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <CreateAnnouncementSection onSuccess={() => setActiveTab("history")} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <AnnouncementHistorySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateAnnouncementSection({ onSuccess }: { onSuccess?: () => void }) {
  const [broadcastType, setBroadcastType] = useState<"all_drivers" | "all_parents" | "specific_route">("all_drivers");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: routes } = useQuery<any[]>({
    queryKey: ["/api/admin/routes"],
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; targetRole?: string; routeId?: string }) => {
      if (data.routeId) {
        return apiRequest("POST", "/api/admin/route-announcements", {
          routeId: data.routeId,
          title: data.title,
          content: data.content,
        });
      } else {
        return apiRequest("POST", "/api/admin/create-announcement", {
          title: data.title,
          content: data.content,
          targetRole: data.targetRole,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === "string" && 
          query.queryKey[0].includes("/api/admin/announcement-history")
      });
      
      const targetLabel = broadcastType === "all_drivers" 
        ? "drivers" 
        : broadcastType === "all_parents" 
          ? "parents" 
          : "parents on the route";
      
      toast({
        title: "Announcement sent",
        description: `Your announcement has been broadcast to all ${targetLabel}`,
      });

      setTitle("");
      setMessage("");
      setSelectedRoute("");
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: () => {
      toast({
        title: "Failed to send announcement",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendAnnouncement = () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Please enter both title and message",
        variant: "destructive",
      });
      return;
    }

    if (broadcastType === "specific_route" && !selectedRoute) {
      toast({
        title: "Error",
        description: "Please select a route",
        variant: "destructive",
      });
      return;
    }

    if (broadcastType === "specific_route") {
      createAnnouncementMutation.mutate({
        title: title.trim(),
        content: message.trim(),
        routeId: selectedRoute,
      });
    } else {
      const targetRole = broadcastType === "all_drivers" ? "driver" : "parent";
      createAnnouncementMutation.mutate({
        title: title.trim(),
        content: message.trim(),
        targetRole,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Broadcast Announcement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Broadcast Type</label>
          <Select value={broadcastType} onValueChange={(v: any) => setBroadcastType(v)}>
            <SelectTrigger data-testid="select-broadcast-type">
              <SelectValue placeholder="Select broadcast type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_drivers">All Drivers</SelectItem>
              <SelectItem value="all_parents">All Parents</SelectItem>
              <SelectItem value="specific_route">Specific Route</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {broadcastType === "specific_route" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Route</label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
              <SelectTrigger data-testid="select-route">
                <SelectValue placeholder="Select a route" />
              </SelectTrigger>
              <SelectContent>
                {routes?.map((route: any) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="bg-warning/10 border border-warning/30 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-warning-foreground mb-1">
                Announcement Mode
              </h4>
              <p className="text-sm text-muted-foreground">
                {broadcastType === "all_drivers" && "This message will be broadcast to all drivers."}
                {broadcastType === "all_parents" && "This message will be broadcast to all parents."}
                {broadcastType === "specific_route" && selectedRoute && "This message will be broadcast to all parents on the selected route."}
                {broadcastType === "specific_route" && !selectedRoute && "Please select a route to continue."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter announcement title"
            data-testid="input-announcement-title"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your announcement message..."
            className="min-h-[200px]"
            data-testid="input-announcement-message"
          />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/messages")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendAnnouncement}
            disabled={!message.trim() || !title.trim() || createAnnouncementMutation.isPending || (broadcastType === "specific_route" && !selectedRoute)}
            data-testid="button-send-announcement"
          >
            <Send className="h-4 w-4 mr-2" />
            {createAnnouncementMutation.isPending ? "Sending..." : "Send Announcement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnnouncementHistorySection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementHistoryItem | null>(null);
  const pageSize = 20;

  const buildQueryUrl = () => {
    const params: string[] = [];
    if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
    if (audienceFilter !== "all") params.push(`audienceType=${audienceFilter}`);
    params.push(`limit=${pageSize}`);
    params.push(`offset=${page * pageSize}`);
    return `/api/admin/announcement-history?${params.join("&")}`;
  };

  const historyUrl = buildQueryUrl();
  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: [historyUrl],
  });

  const { data: routes } = useQuery<any[]>({
    queryKey: ["/api/admin/routes"],
  });

  const announcements = data?.announcements || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getDeliveryBadge = (item: AnnouncementHistoryItem) => {
    const successCount = item.pushSuccessCount || 0;
    const failureCount = item.pushFailureCount || 0;
    const targetCount = item.targetCount || 0;

    if (!item.pushAttemptedAt) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          No push attempted
        </Badge>
      );
    }

    if (failureCount > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          {successCount} sent, {failureCount} failed
        </Badge>
      );
    }

    if (successCount > 0) {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Delivered to {successCount}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="text-xs">
        Target: {targetCount}
      </Badge>
    );
  };

  const getAudienceLabel = (item: AnnouncementHistoryItem) => {
    if (item.audienceType) {
      const labels: Record<string, string> = {
        "ORG_ALL": "Everyone",
        "ROLE_DRIVERS": "All Drivers",
        "ROLE_PARENTS": "All Parents",
        "ROUTE_DRIVERS": `Route Drivers${item.routeName ? `: ${item.routeName}` : ""}`,
        "ROUTE_PARENTS": `Route Parents${item.routeName ? `: ${item.routeName}` : ""}`,
      };
      return labels[item.audienceType] || item.audienceType;
    }
    return item.targetRole === "driver" ? "All Drivers" : "All Parents";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or content..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                  data-testid="input-search-announcements"
                />
              </div>
            </div>
            <div className="min-w-[180px]">
              <Select 
                value={audienceFilter} 
                onValueChange={(v) => {
                  setAudienceFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger data-testid="select-audience-filter">
                  <SelectValue placeholder="Filter by audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Audiences</SelectItem>
                  <SelectItem value="ORG_ALL">Everyone</SelectItem>
                  <SelectItem value="ROLE_DRIVERS">All Drivers</SelectItem>
                  <SelectItem value="ROLE_PARENTS">All Parents</SelectItem>
                  <SelectItem value="ROUTE_DRIVERS">Route Drivers</SelectItem>
                  <SelectItem value="ROUTE_PARENTS">Route Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Announcement History
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total} total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading announcement history...
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No announcements found
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-md p-4 hover-elevate cursor-pointer"
                  onClick={() => setSelectedAnnouncement(item)}
                  data-testid={`announcement-item-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>By {item.adminName || "Admin"}</span>
                        <span>{format(new Date(item.createdAt), "MMM d, yyyy h:mm a")}</span>
                        <Badge variant="outline" className="text-xs">
                          {getAudienceLabel(item)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getDeliveryBadge(item)}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnouncement(item);
                        }}
                        data-testid={`button-view-${item.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AnnouncementDetailDialog
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </div>
  );
}

function AnnouncementDetailDialog({ 
  announcement, 
  onClose 
}: { 
  announcement: AnnouncementHistoryItem | null;
  onClose: () => void;
}) {
  if (!announcement) return null;

  const getAudienceLabel = (item: AnnouncementHistoryItem) => {
    if (item.audienceType) {
      const labels: Record<string, string> = {
        "ORG_ALL": "Everyone",
        "ROLE_DRIVERS": "All Drivers",
        "ROLE_PARENTS": "All Parents",
        "ROUTE_DRIVERS": `Route Drivers${item.routeName ? `: ${item.routeName}` : ""}`,
        "ROUTE_PARENTS": `Route Parents${item.routeName ? `: ${item.routeName}` : ""}`,
      };
      return labels[item.audienceType] || item.audienceType;
    }
    return item.targetRole === "driver" ? "All Drivers" : "All Parents";
  };

  return (
    <Dialog open={!!announcement} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Content</h4>
            <p className="text-sm whitespace-pre-wrap">{announcement.content}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Sent By</h4>
              <p className="text-sm">{announcement.adminName || "Admin"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Date Sent</h4>
              <p className="text-sm">
                {format(new Date(announcement.createdAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Audience</h4>
              <p className="text-sm">{getAudienceLabel(announcement)}</p>
            </div>
            {announcement.expiresAt && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Expires</h4>
                <p className="text-sm">
                  {format(new Date(announcement.expiresAt), "MMMM d, yyyy")}
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Delivery Diagnostics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-md p-3 text-center">
                <div className="text-2xl font-bold">
                  {announcement.targetCount || 0}
                </div>
                <div className="text-xs text-muted-foreground">Target Recipients</div>
              </div>
              <div className="bg-green-500/10 rounded-md p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {announcement.pushSuccessCount || 0}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="bg-red-500/10 rounded-md p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {announcement.pushFailureCount || 0}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-center">
                <div className="text-sm font-medium">
                  {announcement.pushAttemptedAt 
                    ? format(new Date(announcement.pushAttemptedAt), "h:mm a")
                    : "—"
                  }
                </div>
                <div className="text-xs text-muted-foreground">Push Time</div>
              </div>
            </div>

            {announcement.lastPushError && (
              <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-md p-3">
                <h5 className="text-sm font-medium text-destructive mb-1">Last Error</h5>
                <p className="text-xs font-mono text-destructive/80 whitespace-pre-wrap">
                  {announcement.lastPushError}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
