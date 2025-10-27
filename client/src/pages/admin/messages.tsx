// Admin messaging - view all driver-parent conversations (read-only)
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, User, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function AdminMessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Get all conversations between drivers and parents
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/admin/all-conversations"],
    refetchInterval: 5000,
  });

  // Get messages for selected conversation
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/admin/conversation-messages", selectedConversation],
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].conversationKey);
    }
  }, [conversations, selectedConversation]);

  if (conversationsLoading) {
    return <MessagesSkeleton />;
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Messages</h1>
          <p className="text-sm text-muted-foreground">
            View all driver-parent conversations
          </p>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Conversations Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                When parents and drivers start messaging, you'll be able to view their
                conversations here for monitoring and support purposes.
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
          View all driver-parent conversations
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
            {selectedConversation ? (
              <div className="space-y-4">
                <div className="h-[500px] overflow-y-auto space-y-3 p-4 bg-accent/30 rounded-md">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : messages && messages.length > 0 ? (
                    messages.map((message: any) => {
                      const isDriver = message.senderRole === "driver";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isDriver ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${message.id}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-md p-3 ${
                              isDriver
                                ? "bg-primary/20 border border-primary/30"
                                : "bg-card border"
                            }`}
                          >
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {message.senderName} ({message.senderRole})
                            </p>
                            <p className="text-sm">{message.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground">
                        No messages in this conversation
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-accent/30 rounded-md border border-warning/20">
                  <p className="text-sm text-muted-foreground text-center">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Read-only view: Only parents and drivers can send messages
                  </p>
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
