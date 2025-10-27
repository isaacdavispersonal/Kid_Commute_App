// Parent messaging - send messages to assigned driver
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, AlertCircle, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect } from "react";

export default function ParentMessagesPage() {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const { socket } = useWebSocket();

  // Get parent's children with route assignments
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["/api/parent/students"],
  });

  // Get driver info for selected student's route
  const { data: driverInfo, isLoading: driverLoading } = useQuery({
    queryKey: ["/api/parent/driver-info", selectedDriver],
    enabled: !!selectedDriver,
  });

  // Get messages between parent and selected driver
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/parent/messages", selectedDriver],
    enabled: !!selectedDriver,
    refetchInterval: 3000,
  });

  // Auto-select first student's driver on load
  useEffect(() => {
    if (students && students.length > 0 && !selectedDriver) {
      const firstStudentWithRoute = students.find((s: any) => s.routeId && s.driverId);
      if (firstStudentWithRoute) {
        setSelectedDriver(firstStudentWithRoute.driverId);
      }
    }
  }, [students, selectedDriver]);

  // Listen for real-time messages via WebSocket
  useEffect(() => {
    if (!socket || !selectedDriver) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
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
    if (!newMessage.trim() || !selectedDriver) return;
    sendMessageMutation.mutate(newMessage);
  };

  if (studentsLoading) {
    return <MessagesSkeleton />;
  }

  // Check if any children have assigned drivers
  const studentsWithDrivers = students?.filter((s: any) => s.routeId && s.driverId) || [];

  if (studentsWithDrivers.length === 0) {
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
                Your child has not been assigned to a route with a driver yet.
                Once assigned, you'll be able to message their driver here.
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
          Contact your child's driver
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation with Driver
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
                    const isDriver = message.senderRole === "driver";
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${(isOwn || isAdmin || isDriver) ? "justify-end" : "justify-start"}`}
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
            <CardTitle className="text-lg">Your Driver</CardTitle>
          </CardHeader>
          <CardContent>
            {driverLoading ? (
              <Skeleton className="h-20" />
            ) : driverInfo ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-md bg-accent/50">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {driverInfo.firstName} {driverInfo.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Route Driver
                    </p>
                  </div>
                </div>

                {studentsWithDrivers.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Switch Driver</p>
                    {studentsWithDrivers.map((student: any) => (
                      <Button
                        key={student.id}
                        variant={selectedDriver === student.driverId ? "default" : "outline"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setSelectedDriver(student.driverId)}
                        data-testid={`button-select-driver-${student.id}`}
                      >
                        <User className="h-4 w-4 mr-2" />
                        {student.firstName}'s Driver
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No driver information available
              </p>
            )}
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
