// Driver messaging - message parents whose children are on assigned routes
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, User, AlertCircle, Megaphone, Search, X, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

const quickReplies = [
  "Running 5 minutes late",
  "On the way",
  "Arrived at pickup location",
  "Thank you!",
  "Will be there shortly",
  "Traffic delay",
];

export default function DriverMessagesPage() {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRouteAnnouncementForm, setShowRouteAnnouncementForm] = useState(false);
  const [routeAnnouncementMessage, setRouteAnnouncementMessage] = useState("");
  const [selectedRouteForAnnouncement, setSelectedRouteForAnnouncement] = useState<string>("");
  const { socket } = useWebSocket();

  // Get announcements from admin
  const { data: announcements = [] } = useQuery<any[]>({
    queryKey: ["/api/driver/announcements"],
    refetchInterval: 10000,
  });

  // Get dismissed announcements
  const { data: dismissedAnnouncements = [] } = useQuery<any[]>({
    queryKey: ["/api/driver/announcements/dismissed"],
    refetchInterval: 10000,
  });

  // Get unread announcement IDs
  const { data: unreadAnnouncementData } = useQuery<{ unreadIds: string[] }>({
    queryKey: ["/api/user/unread-announcements"],
    refetchInterval: 5000,
  });

  const unreadAnnouncementIds = unreadAnnouncementData?.unreadIds || [];
  const [showDismissedAnnouncements, setShowDismissedAnnouncements] = useState(false);

  // Get all parents whose children are on driver's routes
  const { data: messageableParents = [], isLoading: parentsLoading } = useQuery<any[]>({
    queryKey: ["/api/driver/messageable-parents"],
    refetchInterval: 10000,
  });

  // Get admin contacts (admins who have messaged this driver)
  const { data: adminContacts = [], isLoading: adminsLoading } = useQuery<any[]>({
    queryKey: ["/api/driver/admin-contacts"],
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

  // Get messages with selected parent
  const { data: messages, isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/driver/messages", selectedParent],
    enabled: !!selectedParent,
    refetchInterval: 3000,
  });

  // Merge admin contacts with parents for unified contact list
  const allContacts = useMemo(() => {
    // Add a special flag to distinguish admins from parents
    const adminsAsContacts = adminContacts.map((admin: any) => ({
      ...admin,
      isAdmin: true,
      children: [], // Admins don't have children associations
    }));
    return [...adminsAsContacts, ...messageableParents];
  }, [adminContacts, messageableParents]);

  // Filter contacts by search query (search in contact name or children names for parents)
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return allContacts;
    
    const query = searchQuery.toLowerCase();
    return allContacts.filter((contact: any) => {
      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const childrenNames = contact.children?.map((child: any) => 
        `${child.firstName} ${child.lastName}`.toLowerCase()
      ).join(' ') || '';
      
      return contactName.includes(query) || childrenNames.includes(query);
    });
  }, [allContacts, searchQuery]);

  // Auto-select first contact when list loads
  useEffect(() => {
    if (filteredContacts.length > 0 && !selectedParent) {
      setSelectedParent(filteredContacts[0].id);
    }
  }, [filteredContacts, selectedParent]);

  // Listen for real-time messages via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          queryClient.refetchQueries({ queryKey: ["/api/driver/messageable-parents"] });
          if (selectedParent) {
            queryClient.refetchQueries({ queryKey: ["/api/driver/messages", selectedParent] });
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, selectedParent]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/driver/send-message`, {
        content,
        recipientId: selectedParent,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/driver/messages", selectedParent] });
      setNewMessage("");
      toast({
        title: "Message Sent",
        description: "Your message has been delivered",
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
          window.location.href = "/api/login";
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
      queryClient.invalidateQueries({ queryKey: ["/api/driver/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/announcements/dismissed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
      toast({
        title: "Announcement Moved to Archive",
        description: "You can view this announcement in the 'Previous Announcements' section",
      });
    },
  });

  // Get driver's routes for route announcements
  const { data: driverRoutes = [] } = useQuery<any[]>({
    queryKey: ["/api/driver/shifts"],
    select: (shifts: any[]) => {
      // Extract unique routes from shifts
      const routesMap = new Map();
      shifts.forEach((shift: any) => {
        if (shift.route && !routesMap.has(shift.route.id)) {
          routesMap.set(shift.route.id, shift.route);
        }
      });
      return Array.from(routesMap.values());
    },
  });

  // Get route announcements created by this driver
  const { data: routeAnnouncements = [] } = useQuery<any[]>({
    queryKey: ["/api/route-announcements/driver"],
    refetchInterval: 10000,
  });

  const createRouteAnnouncementMutation = useMutation({
    mutationFn: async ({ routeId, message }: { routeId: string; message: string }) => {
      return await apiRequest("POST", "/api/route-announcements", { routeId, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-announcements/driver"] });
      setRouteAnnouncementMessage("");
      setSelectedRouteForAnnouncement("");
      setShowRouteAnnouncementForm(false);
      toast({
        title: "Route Announcement Sent",
        description: "All parents on this route have been notified",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send route announcement",
        variant: "destructive",
      });
    },
  });

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (selectedParent && messages && messages.length > 0) {
      // Check if there are any unread messages from this sender
      const hasUnread = messages.some((msg: any) => !msg.isRead && msg.senderId === selectedParent);
      if (hasUnread) {
        markAsReadMutation.mutate(selectedParent);
      }
    }
  }, [selectedParent, messages]);

  const handleAnnouncementClick = (announcementId: string) => {
    if (unreadAnnouncementIds.includes(announcementId)) {
      markAnnouncementAsReadMutation.mutate(announcementId);
    }
  };

  const handleDismissAnnouncement = (e: React.MouseEvent, announcementId: string) => {
    e.stopPropagation();
    dismissAnnouncementMutation.mutate(announcementId);
  };

  const handleCreateRouteAnnouncement = () => {
    if (!routeAnnouncementMessage.trim() || !selectedRouteForAnnouncement) return;
    createRouteAnnouncementMutation.mutate({
      routeId: selectedRouteForAnnouncement,
      message: routeAnnouncementMessage,
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedParent) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleQuickReply = (reply: string) => {
    if (!selectedParent) return;
    sendMessageMutation.mutate(reply);
  };

  if (parentsLoading || adminsLoading) {
    return <MessagesSkeleton />;
  }

  if (allContacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Message parents of children on your routes
          </p>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Parents Available</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                You don't have any active route assignments yet. Once you're assigned to routes with students, you'll be able to message their parents here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedContactData = filteredContacts.find((c: any) => c.id === selectedParent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Message parents of children on your routes
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
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-6 w-6"
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
                size="sm"
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
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Route Announcements
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowRouteAnnouncementForm(!showRouteAnnouncementForm)}
              data-testid="button-toggle-route-announcement-form"
            >
              <Plus className="h-4 w-4 mr-1" />
              {showRouteAnnouncementForm ? "Cancel" : "New Announcement"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showRouteAnnouncementForm && (
            <Card className="border-accent">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Route</label>
                  <select
                    className="w-full border rounded-md p-2 bg-background"
                    value={selectedRouteForAnnouncement}
                    onChange={(e) => setSelectedRouteForAnnouncement(e.target.value)}
                    data-testid="select-route-for-announcement"
                  >
                    <option value="">Choose a route...</option>
                    {driverRoutes.map((route: any) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Message</label>
                  <Textarea
                    placeholder="Type your announcement message to all parents on this route..."
                    value={routeAnnouncementMessage}
                    onChange={(e) => setRouteAnnouncementMessage(e.target.value)}
                    rows={3}
                    data-testid="input-route-announcement-message"
                  />
                </div>
                <Button
                  onClick={handleCreateRouteAnnouncement}
                  disabled={!routeAnnouncementMessage.trim() || !selectedRouteForAnnouncement || createRouteAnnouncementMutation.isPending}
                  className="w-full"
                  data-testid="button-send-route-announcement"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to All Parents on Route
                </Button>
              </CardContent>
            </Card>
          )}

          {routeAnnouncements.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Your sent announcements:</p>
              {routeAnnouncements.map((announcement: any) => (
                <div
                  key={announcement.id}
                  className="bg-background/60 rounded-md p-4 space-y-2"
                  data-testid={`route-announcement-${announcement.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
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
                </div>
              ))}
            </div>
          ) : (
            !showRouteAnnouncementForm && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No route announcements yet. Click "New Announcement" to send a message to all parents on a route.
              </p>
            )
          )}
        </CardContent>
      </Card>

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
                            <p className="text-xs font-medium text-warning-foreground mb-1">
                              Admin Support
                            </p>
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
                      Start the conversation by sending a message
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Quick Replies</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickReplies.map((reply) => (
                      <Button
                        key={reply}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReply(reply)}
                        disabled={!selectedParent || sendMessageMutation.isPending}
                        className="text-xs"
                        data-testid={`button-quick-reply-${reply.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
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
                    disabled={!selectedParent}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || !selectedParent || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacts</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or child name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-contacts"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact: any) => {
                  const unreadCount = unreadCounts?.messageBySender?.[contact.id] || 0;
                  return (
                    <Button
                      key={contact.id}
                      variant={selectedParent === contact.id ? "default" : "outline"}
                      className="w-full justify-start h-auto py-3"
                      onClick={() => setSelectedParent(contact.id)}
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
                          <div className="flex flex-wrap gap-1 mt-1">
                            {contact.children?.map((child: any) => (
                              <Badge 
                                key={child.id} 
                                variant="secondary" 
                                className="text-xs"
                                data-testid={`badge-child-${child.id}`}
                              >
                                {child.firstName} {child.lastName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Button>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No contacts match your search
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
