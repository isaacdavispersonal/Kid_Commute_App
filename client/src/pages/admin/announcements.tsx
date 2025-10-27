// Admin announcements - send broadcast messages to all drivers or parents
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Send, Users } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function AdminAnnouncements() {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Get target role from URL params
  const params = new URLSearchParams(window.location.search);
  const targetRole = params.get("to") || "drivers"; // default to drivers

  const targetLabel = targetRole.charAt(0).toUpperCase() + targetRole.slice(1);

  const handleSendAnnouncement = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Create announcement using new announcements system
      const response = await fetch("/api/admin/create-announcement", {
        method: "POST",
        body: JSON.stringify({ 
          title: `Announcement to ${targetLabel}`,
          content: message.trim(),
          targetRole: targetRole.slice(0, -1) // Remove 's' from role (drivers -> driver)
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to create announcement");
      }

      toast({
        title: "Announcement sent",
        description: `Your announcement has been broadcast to all ${targetLabel.toLowerCase()}`,
      });

      setMessage("");
      
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
        <h1 className="text-2xl font-semibold mb-1">Send Announcement</h1>
        <p className="text-sm text-muted-foreground">
          Broadcast a message to all {targetLabel.toLowerCase()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send to {targetLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-warning/10 border border-warning/30 rounded-md p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-warning-foreground mb-1">
                  Announcement Mode
                </h4>
                <p className="text-sm text-muted-foreground">
                  This message will be broadcast to all {targetLabel.toLowerCase()}.
                  Recipients can view this in their announcements section.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Enter your announcement for all ${targetLabel.toLowerCase()}...`}
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
              disabled={!message.trim() || isSending}
              data-testid="button-send-announcement"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Sending..." : `Send to All ${targetLabel}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
