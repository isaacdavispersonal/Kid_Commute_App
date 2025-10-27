// Admin messaging - view and manage all conversations
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, User, AlertCircle, Send, Plus, Filter } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminMessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get all conversations between drivers and parents
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/all-conversations"],
    refetchInterval: 5000,
  });

  // Get messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/conversation-messages", selectedConversation],
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  // Send message state
  const [isSending, setIsSending] = useState(false);

  // Get all users for creating chats
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: showCreateDialog,
  });

  // Filter users by role
  const filteredUsers = allUsers.filter((user: any) => {
    if (roleFilter === "all") return true;
    return user.role === roleFilter;
  });

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].conversationKey);
    }
  }, [conversations, selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    
    // Send message to BOTH participants in the conversation
    const [userId1, userId2] = selectedConversation.split("_");
    const content = messageContent.trim();

    try {
      // Send to first user
      await fetch("/api/admin/send-message", {
        method: "POST",
        body: JSON.stringify({ content, recipientId: userId1 }),
        headers: { "Content-Type": "application/json" },
      });
      
      // Send to second user
      await fetch("/api/admin/send-message", {
        method: "POST",
        body: JSON.stringify({ content, recipientId: userId2 }),
        headers: { "Content-Type": "application/json" },
      });

      // Clear input and refresh
      setMessageContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversation-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-conversations"] });
      
      toast({
        title: "Message sent",
        description: "Your message has been sent to both participants",
      });
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleStartChat = async (userId: string) => {
    try {
      // Send initial message to create the conversation
      await fetch("/api/admin/send-message", {
        method: "POST",
        body: JSON.stringify({ 
          content: "Chat started by admin",
          recipientId: userId 
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Refresh conversations to show the new chat
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/all-conversations"] });
      
      toast({
        title: "Chat started",
        description: "You can now send messages to this user",
      });
      
      setShowCreateDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start chat",
        variant: "destructive",
      });
    }
  };

  if (conversationsLoading) {
    return <MessagesSkeleton />;
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Messages</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all conversations
          </p>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Conversations Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                When parents and drivers start messaging, you'll be able to view and
                participate in their conversations here for support purposes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Messages</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all conversations
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-chat">
              <Plus className="h-4 w-4 mr-2" />
              Create Chat
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
              <DialogDescription>
                Select a user to start messaging or create an announcement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Send Announcement</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Broadcast a message to all users of a specific role
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = "/admin/announcements?to=drivers"}
                    data-testid="button-announce-drivers"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    All Drivers
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = "/admin/announcements?to=parents"}
                    data-testid="button-announce-parents"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    All Parents
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or message individual users
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger data-testid="select-role-filter">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="driver">Drivers Only</SelectItem>
                    <SelectItem value="parent">Parents Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users found
                  </p>
                ) : (
                  filteredUsers.map((user: any) => (
                    <Button
                      key={user.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleStartChat(user.id)}
                      data-testid={`user-${user.id}`}
                    >
                      <User className="h-4 w-4 mr-2" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)} • {user.email}
                        </span>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              <div className="space-y-4">
                <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-accent/30 rounded-md">
                  {messagesLoading ? (
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

                <div className="p-3 bg-warning/10 rounded-md border border-warning/20">
                  <p className="text-xs text-muted-foreground text-center">
                    <AlertCircle className="h-3 w-3 inline mr-2" />
                    Admin intervention mode - Use this to support drivers and parents
                  </p>
                </div>

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message... (Admin support message)"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="resize-none"
                    rows={3}
                    data-testid="input-admin-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageContent.trim() || isSending}
                    size="icon"
                    className="h-auto"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="lg:col-span-2 h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    </div>
  );
}
