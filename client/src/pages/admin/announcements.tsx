// Admin announcements - send broadcast messages to all drivers, parents, or specific routes
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Send, Users } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function AdminAnnouncements() {
  const [broadcastType, setBroadcastType] = useState<"all_drivers" | "all_parents" | "specific_route">("all_drivers");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Fetch all routes for route-specific broadcasts
  const { data: routes } = useQuery<any[]>({
    queryKey: ["/api/admin/routes"],
  });

  const handleSendAnnouncement = async () => {
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

    setIsSending(true);

    try {
      if (broadcastType === "specific_route") {
        // Create route announcement
        const response = await fetch("/api/admin/route-announcements", {
          method: "POST",
          body: JSON.stringify({ 
            routeId: selectedRoute,
            title: title.trim(),
            content: message.trim(),
          }),
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error("Failed to create route announcement");
        }

        toast({
          title: "Route announcement sent",
          description: "Your announcement has been broadcast to all parents on the route",
        });
      } else {
        // Create global announcement for all drivers or all parents
        const targetRole = broadcastType === "all_drivers" ? "driver" : "parent";
        const response = await fetch("/api/admin/create-announcement", {
          method: "POST",
          body: JSON.stringify({ 
            title: title.trim(),
            content: message.trim(),
            targetRole
          }),
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error("Failed to create announcement");
        }

        const targetLabel = broadcastType === "all_drivers" ? "drivers" : "parents";
        toast({
          title: "Announcement sent",
          description: `Your announcement has been broadcast to all ${targetLabel}`,
        });
      }

      setTitle("");
      setMessage("");
      setSelectedRoute("");
      
      // Navigate back to messages
      setTimeout(() => {
        window.location.href = "/admin/messages";
      }, 1000);
    } catch (error) {
      toast({
        title: "Failed to send announcement",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Broadcast Announcement</h1>
        <p className="text-sm text-muted-foreground">
          Send announcements to all drivers, all parents, or a specific route
        </p>
      </div>

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

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendAnnouncement}
              disabled={!message.trim() || !title.trim() || isSending || (broadcastType === "specific_route" && !selectedRoute)}
              data-testid="button-send-announcement"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Sending..." : "Send Announcement"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
