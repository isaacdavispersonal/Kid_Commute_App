// Admin messaging - view conversations and send direct messages
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, AlertCircle, Megaphone, User, Send, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

export default function AdminMessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
  const [driverMessage, setDriverMessage] = useState("");
  const [parentMessage, setParentMessage] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [parentSearch, setParentSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get all conversations between drivers and parents
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/all-conversations"],
    refetchInterval: 5000,
  });

  // Get all drivers
  const { data: drivers = [], isLoading: driversLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/all-drivers"],
  });

  // Get all parents
  const { data: parents = [], isLoading: parentsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/all-parents"],
  });

  // Get all admins (excluding current user)
  const { data: admins = [], isLoading: adminsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/all-admins"],
  });

  // Get messages for selected conversation
  const { data: conversationMessages = [], isLoading: conversationMessagesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/conversation-messages", selectedConversation],
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  // Get direct messages with selected driver
  const { data: driverMessages = [], isLoading: driverMessagesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/direct-messages", selectedDriver],
    enabled: !!selectedDriver,
    refetchInterval: 3000,
  });

  // Get direct messages with selected parent
  const { data: parentMessages = [], isLoading: parentMessagesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/direct-messages", selectedParent],
    enabled: !!selectedParent,
    refetchInterval: 3000,
  });

  // Get direct messages with selected admin
  const { data: adminMessages = [], isLoading: adminMessagesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/direct-messages", selectedAdmin],
    enabled: !!selectedAdmin,
    refetchInterval: 3000,
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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ recipientId, content }: { recipientId: string; content: string }) => {
      return apiRequest("POST", "/api/admin/send-message", { recipientId, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-messages"] });
      toast({
        title: "Message sent",
        description: "Your message has been delivered.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (senderId: string) => {
      return await apiRequest("POST", "/api/messages/mark-read", { senderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/unread-counts"] });
    },
  });

  // Mark driver messages as read when viewing
  useEffect(() => {
    if (selectedDriver && driverMessages && driverMessages.length > 0) {
      const hasUnread = driverMessages.some((msg: any) => !msg.isRead && msg.senderId === selectedDriver);
      if (hasUnread) {
        markAsReadMutation.mutate(selectedDriver);
      }
    }
  }, [selectedDriver, driverMessages]);

  // Mark parent messages as read when viewing
  useEffect(() => {
    if (selectedParent && parentMessages && parentMessages.length > 0) {
      const hasUnread = parentMessages.some((msg: any) => !msg.isRead && msg.senderId === selectedParent);
      if (hasUnread) {
        markAsReadMutation.mutate(selectedParent);
      }
    }
  }, [selectedParent, parentMessages]);

  // Mark admin messages as read when viewing
  useEffect(() => {
    if (selectedAdmin && adminMessages && adminMessages.length > 0) {
      const hasUnread = adminMessages.some((msg: any) => !msg.isRead && msg.senderId === selectedAdmin);
      if (hasUnread) {
        markAsReadMutation.mutate(selectedAdmin);
      }
    }
  }, [selectedAdmin, adminMessages]);

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].conversationKey);
    }
  }, [conversations, selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages, driverMessages, parentMessages, adminMessages]);

  // Handle sending message to driver
  const handleSendDriverMessage = async () => {
    if (!selectedDriver || !driverMessage.trim()) return;
    
    await sendMessageMutation.mutateAsync({
      recipientId: selectedDriver,
      content: driverMessage.trim(),
    });
    setDriverMessage("");
  };

  // Handle sending message to parent
  const handleSendParentMessage = async () => {
    if (!selectedParent || !parentMessage.trim()) return;
    
    await sendMessageMutation.mutateAsync({
      recipientId: selectedParent,
      content: parentMessage.trim(),
    });
    setParentMessage("");
  };

  // Handle sending message to admin
  const handleSendAdminMessage = async () => {
    if (!selectedAdmin || !adminMessage.trim()) return;
    
    await sendMessageMutation.mutateAsync({
      recipientId: selectedAdmin,
      content: adminMessage.trim(),
    });
    setAdminMessage("");
  };

  // Filter drivers, parents, and admins by search
  const filteredDrivers = drivers.filter((driver: any) =>
    `${driver.firstName} ${driver.lastName}`.toLowerCase().includes(driverSearch.toLowerCase())
  );

  const filteredParents = parents.filter((parent: any) =>
    `${parent.firstName} ${parent.lastName}`.toLowerCase().includes(parentSearch.toLowerCase())
  );

  const filteredAdmins = admins.filter((admin: any) =>
    `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(adminSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Messages</h1>
          <p className="text-sm text-muted-foreground">
            View conversations and message drivers or parents
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = "/admin/announcements?to=drivers"}
            data-testid="button-announce-drivers"
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Announce to Drivers
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = "/admin/announcements?to=parents"}
            data-testid="button-announce-parents"
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Announce to Parents
          </Button>
        </div>
      </div>

      <Tabs defaultValue="conversations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conversations" data-testid="tab-conversations">
            <Users className="h-4 w-4 mr-2" />
            View Conversations
          </TabsTrigger>
          <TabsTrigger value="message-drivers" data-testid="tab-message-drivers">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Drivers
          </TabsTrigger>
          <TabsTrigger value="message-parents" data-testid="tab-message-parents">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Parents
          </TabsTrigger>
          <TabsTrigger value="message-admins" data-testid="tab-message-admins">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Admins
          </TabsTrigger>
        </TabsList>

        {/* View Conversations Tab */}
        <TabsContent value="conversations">
          {conversationsLoading ? (
            <MessagesSkeleton />
          ) : !conversations || conversations.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Conversations Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    When parents and drivers start messaging, you'll be able to view and
                    monitor their conversations here.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Conversation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedConversation ? (
                    <ConversationView
                      messages={conversationMessages}
                      isLoading={conversationMessagesLoading}
                      messagesEndRef={messagesEndRef}
                      readOnly
                    />
                  ) : (
                    <div className="h-[500px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Select a conversation to view messages
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {conversations.map((conv: any) => (
                      <Button
                        key={conv.conversationKey}
                        variant={selectedConversation === conv.conversationKey ? "default" : "outline"}
                        className="w-full justify-start h-auto py-3"
                        onClick={() => setSelectedConversation(conv.conversationKey)}
                        data-testid={`button-conversation-${conv.conversationKey}`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left overflow-hidden">
                            <p className="font-medium text-sm truncate">
                              {conv.driverName} ↔ {conv.parentName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.lastMessagePreview || "No messages yet"}
                            </p>
                            {conv.messageCount > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Message Drivers Tab */}
        <TabsContent value="message-drivers">
          {driversLoading ? (
            <MessagesSkeleton />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Direct Message
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDriver ? (
                    <DirectMessageView
                      messages={driverMessages}
                      isLoading={driverMessagesLoading}
                      messageText={driverMessage}
                      setMessageText={setDriverMessage}
                      onSend={handleSendDriverMessage}
                      isPending={sendMessageMutation.isPending}
                      messagesEndRef={messagesEndRef}
                      recipientRole="driver"
                    />
                  ) : (
                    <div className="h-[500px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Select a driver to message
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Drivers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search drivers..."
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-drivers"
                      />
                    </div>
                    <div className="space-y-2 max-h-[550px] overflow-y-auto">
                      {filteredDrivers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No drivers found
                        </p>
                      ) : (
                        filteredDrivers.map((driver: any) => {
                          const unreadCount = unreadCounts?.messageBySender?.[driver.id] || 0;
                          return (
                            <Button
                              key={driver.id}
                              variant={selectedDriver === driver.id ? "default" : "outline"}
                              className="w-full justify-start h-auto py-3"
                              onClick={() => setSelectedDriver(driver.id)}
                              data-testid={`button-driver-${driver.id}`}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {driver.firstName?.[0]}{driver.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-sm">
                                      {driver.firstName} {driver.lastName}
                                    </p>
                                    {unreadCount > 0 && (
                                      <Badge 
                                        variant="destructive" 
                                        className="h-5 min-w-5 px-1 text-xs"
                                        data-testid={`badge-unread-driver-${driver.id}`}
                                      >
                                        {unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                  {driver.phoneNumber && (
                                    <p className="text-xs text-muted-foreground">
                                      {driver.phoneNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Message Parents Tab */}
        <TabsContent value="message-parents">
          {parentsLoading ? (
            <MessagesSkeleton />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Direct Message
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedParent ? (
                    <DirectMessageView
                      messages={parentMessages}
                      isLoading={parentMessagesLoading}
                      messageText={parentMessage}
                      setMessageText={setParentMessage}
                      onSend={handleSendParentMessage}
                      isPending={sendMessageMutation.isPending}
                      messagesEndRef={messagesEndRef}
                      recipientRole="parent"
                    />
                  ) : (
                    <div className="h-[500px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Select a parent to message
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Parents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search parents..."
                        value={parentSearch}
                        onChange={(e) => setParentSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-parents"
                      />
                    </div>
                    <div className="space-y-2 max-h-[550px] overflow-y-auto">
                      {filteredParents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No parents found
                        </p>
                      ) : (
                        filteredParents.map((parent: any) => {
                          const unreadCount = unreadCounts?.messageBySender?.[parent.id] || 0;
                          return (
                            <Button
                              key={parent.id}
                              variant={selectedParent === parent.id ? "default" : "outline"}
                              className="w-full justify-start h-auto py-3"
                              onClick={() => setSelectedParent(parent.id)}
                              data-testid={`button-parent-${parent.id}`}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {parent.firstName?.[0]}{parent.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-sm">
                                      {parent.firstName} {parent.lastName}
                                    </p>
                                    {unreadCount > 0 && (
                                      <Badge 
                                        variant="destructive" 
                                        className="h-5 min-w-5 px-1 text-xs"
                                        data-testid={`badge-unread-parent-${parent.id}`}
                                      >
                                        {unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                  {parent.phoneNumber && (
                                    <p className="text-xs text-muted-foreground">
                                      {parent.phoneNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Message Admins Tab */}
        <TabsContent value="message-admins">
          {adminsLoading ? (
            <MessagesSkeleton />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Messages</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAdmin ? (
                    <DirectMessageView
                      messages={adminMessages}
                      isLoading={adminMessagesLoading}
                      messageText={adminMessage}
                      setMessageText={setAdminMessage}
                      onSend={handleSendAdminMessage}
                      isPending={sendMessageMutation.isPending}
                      messagesEndRef={messagesEndRef}
                      recipientRole="admin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[400px]">
                      <p className="text-sm text-muted-foreground">
                        Select an admin to message
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Admins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search admins..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-admins"
                      />
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredAdmins.length === 0 ? (
                        <div className="text-center py-8">
                          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No admins found</p>
                        </div>
                      ) : (
                        filteredAdmins.map((admin: any) => {
                          const unreadCount = unreadCounts?.messageBySender?.[admin.id] || 0;
                          return (
                            <Button
                              key={admin.id}
                              variant={selectedAdmin === admin.id ? "default" : "outline"}
                              className="w-full justify-start h-auto py-3"
                              onClick={() => setSelectedAdmin(admin.id)}
                              data-testid={`button-admin-${admin.id}`}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-warning/10 text-warning text-xs">
                                    {admin.firstName?.[0]}{admin.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-sm">
                                      {admin.firstName} {admin.lastName}
                                    </p>
                                    {unreadCount > 0 && (
                                      <Badge 
                                        variant="destructive" 
                                        className="h-5 min-w-5 px-1 text-xs"
                                        data-testid={`badge-unread-admin-${admin.id}`}
                                      >
                                        {unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                  {admin.phoneNumber && (
                                    <p className="text-xs text-muted-foreground">
                                      {admin.phoneNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component for viewing conversations (read-only)
function ConversationView({
  messages,
  isLoading,
  messagesEndRef,
  readOnly,
}: {
  messages: any[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-accent/30 rounded-md">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((message: any) => {
              const isDriver = message.senderRole === "driver";
              const isAdmin = message.senderRole === "admin";
              const isParent = message.senderRole === "parent";
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isDriver || isAdmin ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.id}`}
                >
                  <div
                    className={`max-w-[70%] rounded-md p-3 ${
                      isAdmin
                        ? "bg-warning/20 border border-warning/50"
                        : isDriver
                        ? "bg-primary/20 border border-primary/30"
                        : "bg-card border"
                    }`}
                  >
                    <p className={`text-xs font-medium mb-1 ${
                      isAdmin ? "text-warning-foreground" : "text-muted-foreground"
                    }`}>
                      {message.senderName} {isAdmin && "(Admin)"}
                      {isDriver && "(Driver)"}
                      {isParent && "(Parent)"}
                    </p>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              No messages in this conversation
            </p>
          </div>
        )}
      </div>

      {readOnly && (
        <div className="p-3 bg-info/10 rounded-md border border-info/20">
          <p className="text-xs text-muted-foreground text-center">
            <AlertCircle className="h-3 w-3 inline mr-2" />
            View-only mode. Use the tabs above to send direct messages.
          </p>
        </div>
      )}
    </div>
  );
}

// Component for direct messaging
function DirectMessageView({
  messages,
  isLoading,
  messageText,
  setMessageText,
  onSend,
  isPending,
  messagesEndRef,
  recipientRole,
}: {
  messages: any[];
  isLoading: boolean;
  messageText: string;
  setMessageText: (text: string) => void;
  onSend: () => void;
  isPending: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  recipientRole: string;
}) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="space-y-4">
      <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-accent/30 rounded-md">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((message: any) => (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
                data-testid={`message-${message.id}`}
              >
                <div
                  className={`max-w-[70%] rounded-md p-3 ${
                    message.isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium">
                      {message.senderName}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {message.senderRole}
                    </Badge>
                  </div>
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${message.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              No messages yet. Start a conversation!
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          placeholder={`Type your message to this ${recipientRole}...`}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyPress}
          className="resize-none"
          rows={3}
          data-testid="textarea-message"
        />
        <Button
          onClick={onSend}
          disabled={!messageText.trim() || isPending}
          data-testid="button-send-message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="lg:col-span-2 h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    </div>
  );
}
