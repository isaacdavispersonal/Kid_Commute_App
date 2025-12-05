// Shared messaging component for driver and parent
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect } from "react";
import { getLoginUrl } from "@/lib/config";

interface MessagesPageProps {
  userRole: "driver" | "parent";
}

const quickReplies = [
  "Running 5 minutes late",
  "On the way",
  "Arrived at pickup location",
  "Thank you!",
  "Will be there shortly",
  "Traffic delay",
];

export default function MessagesPage({ userRole }: MessagesPageProps) {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const { socket, isConnected } = useWebSocket();

  const { data: conversations, isLoading } = useQuery({
    queryKey: [`/api/${userRole}/conversations`],
    refetchInterval: 5000,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/${userRole}/messages`],
    refetchInterval: 3000,
  });

  // Listen for real-time messages via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          // Invalidate messages query to fetch new messages
          queryClient.invalidateQueries({ queryKey: [`/api/${userRole}/messages`] });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, userRole]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/${userRole}/send-message`, {
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${userRole}/messages`] });
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

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleQuickReply = (reply: string) => {
    sendMessageMutation.mutate(reply);
  };

  if (isLoading || messagesLoading) {
    return <MessagesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {userRole === "driver"
            ? "Communicate with parents"
            : "Contact your driver"}
        </p>
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
            <div className="space-y-4">
              <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-accent/30 rounded-md">
                {messages && messages.length > 0 ? (
                  messages.map((message: any) => {
                    const isOwn = message.senderId === message.currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isOwn ? "justify-end" : "justify-start"
                        }`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-md p-3 ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-card-border"
                          }`}
                        >
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
                      No messages yet. Start a conversation!
                    </p>
                  </div>
                )}
              </div>

              {userRole === "driver" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Quick Replies</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickReplies.map((reply) => (
                      <Button
                        key={reply}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReply(reply)}
                        disabled={sendMessageMutation.isPending}
                        className="text-xs"
                        data-testid={`button-quick-reply-${reply.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

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
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
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
              {conversations && conversations.length > 0 ? (
                conversations.map((contact: any) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-accent/50 hover-elevate"
                    data-testid={`contact-${contact.id}`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {contact.firstName?.[0]}
                        {contact.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      {contact.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.lastMessage}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No contacts available
                </p>
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
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}
