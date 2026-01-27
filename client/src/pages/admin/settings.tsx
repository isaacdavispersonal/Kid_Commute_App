import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Phone, Plus, Trash2, Save, ExternalLink, Activity, GripVertical, Navigation, Bell, Send, Smartphone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  priority: number;
}

interface AdminSetting {
  key: string;
  value: string;
  description?: string;
}

interface UserWithToken {
  userId: string;
  userName: string;
  userRole: string;
  tokenCount: number;
  platforms: string[];
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [testTitle, setTestTitle] = useState("Test Notification");
  const [testBody, setTestBody] = useState("This is a test push notification from Kid Commute");

  const { data: settings, isLoading } = useQuery<AdminSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const { data: usersWithTokens, isLoading: isLoadingTokens } = useQuery<UserWithToken[]>({
    queryKey: ["/api/admin/push-tokens/users"],
  });

  const sendTestNotificationMutation = useMutation({
    mutationFn: async ({ targetUserId, title, body }: { targetUserId: string; title: string; body: string }) => {
      return await apiRequest("POST", "/api/admin/push-notifications/test", { targetUserId, title, body });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test notification sent",
        description: data.message || `Notification sent to ${data.tokenCount} device(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send notification",
        description: error.message || "Check if the user has registered devices",
        variant: "destructive",
      });
    },
  });

  const saveSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      return await apiRequest("POST", "/api/admin/settings", { key, value, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (settings && !initialized) {
      const emergencyContactsSetting = settings.find(s => s.key === "emergency_contacts");
      if (emergencyContactsSetting) {
        try {
          setContacts(JSON.parse(emergencyContactsSetting.value));
        } catch {
          setContacts([]);
        }
      }
      setInitialized(true);
    }
  }, [settings, initialized]);

  const addContact = () => {
    const newContact: EmergencyContact = {
      id: crypto.randomUUID(),
      name: "",
      phone: "",
      priority: contacts.length + 1,
    };
    setContacts([...contacts, newContact]);
    setHasChanges(true);
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id).map((c, i) => ({ ...c, priority: i + 1 })));
    setHasChanges(true);
  };

  const updateContact = (id: string, field: keyof EmergencyContact, value: string) => {
    setContacts(contacts.map(c => c.id === id ? { ...c, [field]: value } : c));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const validContacts = contacts.filter(c => c.name.trim() && c.phone.trim());
    try {
      await saveSettingMutation.mutateAsync({
        key: "emergency_contacts",
        value: JSON.stringify(validContacts),
        description: "Emergency contact phone numbers for drivers",
      });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Emergency contacts have been updated.",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden px-4 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            Admin Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure system-wide settings
          </p>
        </div>
        {hasChanges && (
          <Button 
            onClick={handleSave}
            disabled={saveSettingMutation.isPending}
            data-testid="button-save-settings"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveSettingMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Emergency Contacts
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Phone numbers that drivers can quickly reach in emergencies
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={addContact}
                data-testid="button-add-contact"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Add Contact</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No emergency contacts configured</p>
                <p className="text-xs">Add contacts for drivers to reach in emergencies</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <div 
                    key={contact.id} 
                    className="flex items-start gap-2 sm:gap-3 p-3 border rounded-md"
                    data-testid={`contact-${contact.id}`}
                  >
                    <div className="flex items-center gap-1 text-muted-foreground pt-2">
                      <GripVertical className="h-4 w-4 hidden sm:block" />
                      <Badge variant="secondary" className="text-xs h-5 min-w-5 px-1">
                        {index + 1}
                      </Badge>
                    </div>
                    <div className="flex-1 grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={contact.name}
                          onChange={(e) => updateContact(contact.id, "name", e.target.value)}
                          placeholder="e.g., Operations Manager"
                          className="h-9"
                          data-testid={`input-contact-name-${contact.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone Number</Label>
                        <Input
                          value={contact.phone}
                          onChange={(e) => updateContact(contact.id, "phone", e.target.value)}
                          placeholder="e.g., (555) 123-4567"
                          type="tel"
                          className="h-9"
                          data-testid={`input-contact-phone-${contact.id}`}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 mt-5"
                      onClick={() => removeContact(contact.id)}
                      data-testid={`button-remove-contact-${contact.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Integrations
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage external service connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/admin/gps-settings">
                <Button 
                  variant="outline" 
                  className="w-full justify-between h-auto py-3"
                  data-testid="link-gps-settings"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Navigation className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">GPS Integration</p>
                      <p className="text-xs text-muted-foreground">Configure webhook for any GPS provider</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>

              <Link href="/admin/samsara-integration">
                <Button 
                  variant="outline" 
                  className="w-full justify-between h-auto py-3"
                  data-testid="link-samsara-integration"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Samsara Fleet Integration</p>
                      <p className="text-xs text-muted-foreground">Samsara-specific GPS and vehicle sync</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>

              <Link href="/admin/payroll-exports">
                <Button 
                  variant="outline" 
                  className="w-full justify-between h-auto py-3"
                  data-testid="link-payroll-integration"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">BambooHR Payroll</p>
                      <p className="text-xs text-muted-foreground">Export driver hours to payroll</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Push Notification Testing
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Test push notifications through Firebase to iOS/Android devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingTokens ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !usersWithTokens || usersWithTokens.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No devices registered for push notifications</p>
                <p className="text-xs mt-1">Users need to log in from the mobile app to register</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-push-user">
                      <SelectValue placeholder="Choose a user with registered device..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usersWithTokens.map((user) => (
                        <SelectItem 
                          key={user.userId} 
                          value={user.userId}
                          data-testid={`option-user-${user.userId}`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{user.userName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {user.userRole}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({user.tokenCount} device{user.tokenCount > 1 ? "s" : ""})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Notification Title</Label>
                  <Input
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="Enter notification title"
                    data-testid="input-push-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Notification Body</Label>
                  <Input
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    placeholder="Enter notification message"
                    data-testid="input-push-body"
                  />
                </div>

                <Button
                  onClick={() => sendTestNotificationMutation.mutate({
                    targetUserId: selectedUserId,
                    title: testTitle,
                    body: testBody
                  })}
                  disabled={!selectedUserId || sendTestNotificationMutation.isPending}
                  className="w-full"
                  data-testid="button-send-test-push"
                >
                  {sendTestNotificationMutation.isPending ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test Notification
                    </>
                  )}
                </Button>

                {usersWithTokens.length > 0 && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <p className="font-medium mb-1">Registered devices:</p>
                    <div className="flex flex-wrap gap-1">
                      {usersWithTokens.map((user) => (
                        <Badge key={user.userId} variant="outline" className="text-xs">
                          {user.userName}: {user.platforms.join(", ") || "unknown"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
