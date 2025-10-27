// Driver messaging - respond to parent messages only
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, User, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";

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
  const { socket } = useWebSocket();

  // Get list of parents who have messaged the driver
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/driver/conversations"],
    refetchInterval: 5000,
  });

  // Get messages with selected parent
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/driver/messages", selectedParent],
    enabled: !!selectedParent,
    refetchInterval: 3000,
  });

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedParent) {
      setSelectedParent(conversations[0].id);
    }
  }, [conversations, selectedParent]);

  // Listen for real-time messages via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          queryClient.refetchQueries({ queryKey: ["/api/driver/conversations"] });
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

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedParent) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleQuickReply = (reply: string) => {
    if (!selectedParent) return;
    sendMessageMutation.mutate(reply);
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
            Respond to parent messages
          </p>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Messages Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Parents will be able to message you about their children's transportation.
                When they do, you'll be able to respond here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Respond to parent messages
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
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : messages && messages.length > 0 ? (
                  messages.map((message: any) => {
                    const isOwn = message.isOwn;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-md p-3 ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border"
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
                      No messages in this conversation yet
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
                    placeholder="Type your response..."
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
            <CardTitle className="text-lg">Parent Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversations.map((parent: any) => (
                <Button
                  key={parent.id}
                  variant={selectedParent === parent.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedParent(parent.id)}
                  data-testid={`button-conversation-${parent.id}`}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left overflow-hidden">
                      <p className="font-medium text-sm truncate">
                        {parent.firstName} {parent.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parent
                      </p>
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
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}
