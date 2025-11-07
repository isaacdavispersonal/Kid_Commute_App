import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Loader2, Link2, AlertCircle, CheckCircle2, Activity, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SamsaraStatus {
  webhookConfigured: boolean;
  apiTokenConfigured: boolean;
  webhookUrl: string;
  lastSync?: string;
}

interface VehicleMapping {
  id: string;
  name: string;
  plateNumber: string;
  samsaraVehicleId: string | null;
  samsaraLastSync: string | null;
}

interface SyncResults {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: { vehicle: string; error: string }[];
}

export default function AdminSamsaraIntegration() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<SamsaraStatus>({
    queryKey: ["/api/admin/samsara/status"],
  });

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery<VehicleMapping[]>({
    queryKey: ["/api/admin/samsara/vehicle-mappings"],
  });

  const syncVehiclesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/admin/samsara/sync-vehicles", {
        method: "POST",
      });
      const data: SyncResults = await response.json();
      return data;
    },
    onSuccess: (data: SyncResults) => {
      setSyncResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/samsara/vehicle-mappings"] });
      
      const totalChanges = data.created.length + data.updated.length;
      if (totalChanges > 0) {
        toast({
          title: "Sync Complete!",
          description: `${totalChanges} vehicle(s) synced successfully`,
        });
      } else if (data.errors.length > 0) {
        toast({
          title: "Sync completed with errors",
          description: `${data.errors.length} error(s) occurred`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Already up to date",
          description: "All vehicles are already synced",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync vehicles from Samsara",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const webhookUrl = status?.webhookUrl || `${window.location.origin}/api/webhooks/samsara-webhook`;
  const isFullyConfigured = status?.webhookConfigured && status?.apiTokenConfigured;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Samsara Integration</h1>
        <p className="text-muted-foreground mt-2">
          Connect your Samsara fleet tracking to receive real-time vehicle locations
        </p>
      </div>

      {statusLoading ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading configuration...</AlertTitle>
        </Alert>
      ) : (
        <Alert className={isFullyConfigured ? "border-primary/50 bg-primary/5" : "border-yellow-500/50 bg-yellow-500/5"}>
          <Activity className={`h-4 w-4 ${isFullyConfigured ? "text-primary" : "text-yellow-600"}`} />
          <AlertTitle className={isFullyConfigured ? "text-primary" : "text-yellow-600"}>
            Integration Status
          </AlertTitle>
          <AlertDescription>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex items-center gap-2">
                {status?.webhookConfigured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  Webhook Secret: {status?.webhookConfigured ? "Configured" : "Not Set"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {status?.apiTokenConfigured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  API Token: {status?.apiTokenConfigured ? "Configured" : "Not Set"}
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure Samsara to send vehicle location updates to FleetTrack
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Webhook URL</label>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all font-mono">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                data-testid="button-copy-webhook-url"
              >
                {copiedField === "Webhook URL" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Setup Instructions</h3>
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                <strong>Add Webhook Secret to Replit:</strong>
                <p className="ml-6 mt-1 text-muted-foreground">
                  In Samsara Dashboard, create a webhook and copy the Base64-encoded secret. 
                  Add it to Replit Secrets as <code className="bg-muted px-1 py-0.5 rounded">SAMSARA_WEBHOOK_SECRET</code>
                </p>
              </li>
              <li>
                <strong>Configure Webhook in Samsara:</strong>
                <p className="ml-6 mt-1 text-muted-foreground">
                  Go to Samsara Dashboard → Settings → Webhooks → Add Webhook
                </p>
              </li>
              <li>
                <strong>Set Webhook URL:</strong>
                <p className="ml-6 mt-1 text-muted-foreground">
                  Paste the webhook URL above into Samsara's webhook configuration
                </p>
              </li>
              <li>
                <strong>Subscribe to Events:</strong>
                <p className="ml-6 mt-1 text-muted-foreground">
                  Select <code className="bg-muted px-1 py-0.5 rounded">VehicleUpdated</code> event type
                </p>
              </li>
              <li>
                <strong>Map Vehicles:</strong>
                <p className="ml-6 mt-1 text-muted-foreground">
                  FleetTrack will automatically match vehicles by license plate, or you can manually set Samsara Vehicle IDs below
                </p>
              </li>
            </ol>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Webhooks are more efficient than API polling (66-100× faster) and provide instant real-time updates.
              Once configured, parent ETAs will update automatically when vehicles are on routes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vehicle Mappings</CardTitle>
              <CardDescription>
                FleetTrack vehicles linked to Samsara fleet
              </CardDescription>
            </div>
            <Button
              onClick={() => syncVehiclesMutation.mutate()}
              disabled={!status?.apiTokenConfigured || syncVehiclesMutation.isPending}
              data-testid="button-sync-vehicles"
            >
              {syncVehiclesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync from Samsara
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {syncResults && (
            <div className="space-y-3" data-testid="sync-results">
              {syncResults.created.length > 0 && (
                <Alert className="border-green-500/50 bg-green-500/5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Created {syncResults.created.length} vehicle(s)</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {syncResults.created.map((vehicle, i) => (
                        <li key={i}>{vehicle}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {syncResults.updated.length > 0 && (
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary">Updated {syncResults.updated.length} vehicle(s)</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {syncResults.updated.map((vehicle, i) => (
                        <li key={i}>{vehicle}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {syncResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Errors ({syncResults.errors.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {syncResults.errors.map((error, i) => (
                        <li key={i}>{error.vehicle}: {error.error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {syncResults.created.length === 0 && syncResults.updated.length === 0 && syncResults.errors.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>All vehicles up to date</AlertTitle>
                  <AlertDescription>
                    No changes needed. All vehicles are already synced with Samsara.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          {vehiclesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : vehicles && vehicles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Name</TableHead>
                  <TableHead>License Plate</TableHead>
                  <TableHead>Samsara Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id} data-testid={`row-vehicle-${vehicle.id}`}>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>{vehicle.plateNumber}</TableCell>
                    <TableCell>
                      {vehicle.samsaraVehicleId ? (
                        <Badge variant="default" data-testid={`badge-linked-${vehicle.id}`}>
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-not-linked-${vehicle.id}`}>
                          Not Linked
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {vehicle.samsaraLastSync
                        ? new Date(vehicle.samsaraLastSync).toLocaleString()
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No vehicles found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
