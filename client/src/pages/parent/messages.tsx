// Parent messaging - message drivers assigned to your children
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, AlertCircle, User, Megaphone, X } from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/lib/config";
import { PullToRefresh } from "@/components/pull-to-refresh";

export default function ParentMessagesPage() {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const { socket } = useWebSocket();

  // Get announcements from admin
  const { data: announcements = [] } = useQuery<any[]>({
    queryKey: ["/api/parent/announcements"],
    refetchInterval: 10000,
  });

  // Get dismissed announcements
  const { data: dismissedAnnouncements = [] } = useQuery<any[]>({
    queryKey: ["/api/parent/announcements/dismissed"],
    refetchInterval: 10000,
  });

  // Get unread announcement IDs
  const { data: unreadAnnouncementData } = useQuery<{ unreadIds: string[] }>({
    queryKey: ["/api/user/unread-announcements"],
    refetchInterval: 5000,
  });

  const unreadAnnouncementIds = unreadAnnouncementData?.unreadIds || [];
  const [showDismissedAnnouncements, setShowDismissedAnnouncements] = useState(false);

  // Get drivers currently assigned to parent's children's routes
  const { data: assignedDrivers = [], isLoading: driversLoading } = useQuery<any[]>({
    queryKey: ["/api/parent/assigned-drivers"],
    refetchInterval: 10000,
  });

  // Get admin contacts (admins who have messaged this parent)
  const { data: adminContacts = [], isLoading: adminsLoading } = useQuery<any[]>({
    queryKey: ["/api/parent/admin-contacts"],
    refetchInterval: 10000,
  });

  // Get unread counts by sender
  const { data: unreadCounts } = useQuery<{
    messages: number;
    announcements: number;
    messageBySender: { [senderId: string]: number };
  }>({
    queryKey: ["/api/user/unread-counts"],
    refetchInterval: 5000,
  });

  // Get messages between parent and selected driver
  const { data: messages, isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/parent/messages", selectedDriver],
    enabled: !!selectedDriver,
    refetchInterval: 3000,
  });

  // Merge admin contacts with drivers for unified contact list
  const allContacts = useMemo(() => {
    // Add a special flag to distinguish admins from drivers
    const adminsAsContacts = adminContacts.map((admin: any) => ({
      ...admin,
      isAdmin: true,
      children: [], // Admins don't have children associations
    }));
    return [...adminsAsContacts, ...assignedDrivers];
  }, [adminContacts, assignedDrivers]);

  // Auto-select first contact on load
  useEffect(() => {
    if (allContacts.length > 0 && !selectedDriver) {
      setSelectedDriver(allContacts[0].id);
    }
  }, [allContacts, selectedDriver]);

  // Listen for real-time messages via WebSocket
  useEffect(() => {
    if (!socket || !selectedDriver) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          queryClient.refetchQueries({ queryKey: ["/api/parent/assigned-drivers"] });
          queryClient.refetchQueries({ queryKey: ["/api/parent/messages", selectedDriver] });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, selectedDriver]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/parent/send-message`, {
        content,
        recipientId: selectedDriver,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/parent/messages", selectedDriver] });
      setNewMessage("");
      toast({
        title: "Message Sent",
        description: "Your message has been delivered to the driver",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = getLoginUrl();
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (senderId: string) => {
      return await apiRequest("POST", "/api/messages/mark-read", { senderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
    },
  });

  const markAnnouncementAsReadMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      return await apiRequest("POST", "/api/announcements/mark-read", { announcementId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
    },
  });

  const dismissAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      return await apiRequest("POST", `/api/announcements/${announcementId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/announcements/dismissed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
      toast({
        title: "Announcement Moved to Archive",
        description: "You can view this announcement in the 'Previous Announcements' section",
      });
    },
  });

  // Get route announcements for this parent
  const { data: routeAnnouncements = [] } = useQuery<any[]>({
    queryKey: ["/api/route-announcements/parent"],
    refetchInterval: 10000,
  });

  const dismissRouteAnnouncementMutation = useMutation({
    mutationFn: async (routeAnnouncementId: string) => {
      return await apiRequest("POST", `/api/route-announcements/${routeAnnouncementId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-announcements/parent"] });
      toast({
        title: "Route Announcement Dismissed",
        description: "This route announcement has been removed from your view",
      });
    },
  });

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (selectedDriver && messages && messages.length > 0) {
      const hasUnread = messages.some((msg: any) => !msg.isRead && msg.senderId === selectedDriver);
      if (hasUnread) {
        markAsReadMutation.mutate(selectedDriver);
      }
    }
  }, [selectedDriver, messages]);

  const handleAnnouncementClick = (announcementId: string) => {
    if (unreadAnnouncementIds.includes(announcementId)) {
      markAnnouncementAsReadMutation.mutate(announcementId);
    }
  };

  const handleDismissAnnouncement = (e: React.MouseEvent, announcementId: string) => {
    e.stopPropagation();
    dismissAnnouncementMutation.mutate(announcementId);
  };

  const handleDismissRouteAnnouncement = (e: React.MouseEvent, routeAnnouncementId: string) => {
    e.stopPropagation();
    dismissRouteAnnouncementMutation.mutate(routeAnnouncementId);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedDriver) return;
    sendMessageMutation.mutate(newMessage);
  };

  if (driversLoading || adminsLoading) {
    return <MessagesSkeleton />;
  }

  if (allContacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Contact your child's driver
          </p>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Driver Assigned</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your children have not been assigned to routes with active drivers yet.
                Once assigned, you'll be able to message their drivers here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedContactData = allContacts.find((c: any) => c.id === selectedDriver);

  return (
    <PullToRefresh queryKeys={[["/api/parent/assigned-drivers"], ["/api/parent/admin-contacts"], ["/api/user/unread-counts"], ["/api/parent/announcements"], ["/api/parent/announcements/dismissed"], ["/api/user/unread-announcements"], ["/api/parent/messages"]]}>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Contact your child's driver
        </p>
      </div>

      {/* Admin Announcements Section */}
      {announcements.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Admin Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((announcement: any) => {
              const isUnread = unreadAnnouncementIds.includes(announcement.id);
              return (
                <div
                  key={announcement.id}
                  onClick={() => handleAnnouncementClick(announcement.id)}
                  className="bg-background/60 rounded-md p-4 space-y-2 hover-elevate cursor-pointer relative"
                  data-testid={`announcement-${announcement.id}`}
                >
                  <Button
                    size="icon-touch"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={(e) => handleDismissAnnouncement(e, announcement.id)}
                    data-testid={`button-dismiss-announcement-${announcement.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="flex items-start justify-between gap-2 pr-8">
                    <div className="flex items-center gap-2 flex-1">
                      <h3 className="font-semibold text-sm" data-testid="announcement-title">
                        {announcement.title}
                      </h3>
                      {isUnread && (
                        <Badge 
                          variant="destructive" 
                          className="h-5 px-1.5 text-xs"
                          data-testid={`badge-unread-announcement-${announcement.id}`}
                        >
                          New
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="announcement-content">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>From: {announcement.adminName}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Previous (Dismissed) Announcements Section */}
      {dismissedAnnouncements.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-muted-foreground" />
                Previous Announcements
                <Badge variant="secondary" className="ml-2">
                  {dismissedAnnouncements.length}
                </Badge>
              </CardTitle>
              <Button
                size="touch"
                variant="ghost"
                onClick={() => setShowDismissedAnnouncements(!showDismissedAnnouncements)}
                data-testid="button-toggle-dismissed-announcements"
              >
                {showDismissedAnnouncements ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showDismissedAnnouncements && (
            <CardContent className="space-y-3">
              {dismissedAnnouncements.map((announcement: any) => (
                <div
                  key={announcement.id}
                  className="bg-background/60 rounded-md p-4 space-y-2 opacity-70"
                  data-testid={`dismissed-announcement-${announcement.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm" data-testid="announcement-title">
                      {announcement.title}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="announcement-content">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>From: {announcement.adminName}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Route Announcements Section */}
      {routeAnnouncements.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Route Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routeAnnouncements.map((announcement: any) => (
              <div
                key={announcement.id}
                className="bg-background/60 rounded-md p-4 space-y-2 relative"
                data-testid={`route-announcement-${announcement.id}`}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={(e) => handleDismissRouteAnnouncement(e, announcement.id)}
                  data-testid={`button-dismiss-route-announcement-${announcement.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex items-start justify-between gap-2 pr-8">
                  <div className="flex items-center gap-2 flex-1">
                    <Badge variant="secondary" className="text-xs">
                      {announcement.routeName}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {announcement.message}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>From: {announcement.driverName}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation
              {selectedContactData && (
                <span className="text-sm font-normal text-muted-foreground">
                  with {selectedContactData.firstName} {selectedContactData.lastName}
                  {selectedContactData.isAdmin && " (Admin Support)"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-accent/30 rounded-md">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : messages && messages.length > 0 ? (
                  messages.map((message: any) => {
                    const isOwn = message.isOwn;
                    const isAdmin = message.senderRole === "admin";
                    const isForwarded = !!message.forwardedByAdminName;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${(isOwn || isAdmin) ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-md p-3 ${
                            isAdmin
                              ? "bg-warning/20 border border-warning/50"
                              : isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border"
                          }`}
                        >
                          {isAdmin && (
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-medium text-warning-foreground">
                                Admin Support
                              </p>
                              {isForwarded && (
                                <Badge variant="outline" className="text-xs h-5 px-1.5 bg-warning/30 border-warning">
                                  Forwarded
                                </Badge>
                              )}
                            </div>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">
                      No messages yet. Start a conversation with your driver!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="resize-none"
                  rows={2}
                  disabled={!selectedDriver}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !selectedDriver || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allContacts.map((contact: any) => {
                const unreadCount = unreadCounts?.messageBySender?.[contact.id] || 0;
                return (
                  <Button
                    key={contact.id}
                    variant={selectedDriver === contact.id ? "default" : "outline"}
                    className="w-full justify-start h-auto py-3"
                    onClick={() => setSelectedDriver(contact.id)}
                    data-testid={`button-contact-${contact.id}`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className={contact.isAdmin ? "bg-warning/10 text-warning text-xs" : "bg-primary/10 text-primary text-xs"}>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">
                            {contact.firstName} {contact.lastName}
                            {contact.isAdmin && (
                              <Badge variant="outline" className="ml-2 text-xs border-warning/50 text-warning-foreground">
                                Admin
                              </Badge>
                            )}
                          </p>
                          {unreadCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="h-5 min-w-5 px-1 text-xs"
                              data-testid={`badge-unread-${contact.id}`}
                            >
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                        {!contact.isAdmin && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Route Driver
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {contact.children?.map((child: any) => (
                            <Badge 
                              key={child.id} 
                              variant="secondary" 
                              className="text-xs"
                              data-testid={`badge-child-${child.id}`}
                            >
                              {child.firstName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </PullToRefresh>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="lg:col-span-2 h-[600px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}
