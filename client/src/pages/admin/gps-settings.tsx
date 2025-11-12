import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Navigation, Settings, Shield, ExternalLink, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function AdminGPSSettings() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: webhookStatus, isLoading, isError, error } = useQuery<{ configured: boolean; webhookUrl: string }>({
    queryKey: ["/api/admin/gps-webhook-status"],
  });

  const webhookUrl = webhookStatus?.webhookUrl || `${window.location.origin}/api/vehicles/gps-update`;
  const hasSecret = webhookStatus?.configured ?? false;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">GPS Integration Settings</h1>
        <p className="text-muted-foreground">
          Configure your navigation software to send real-time vehicle locations to Kid Commute
        </p>
      </div>

      {isLoading ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading configuration...</AlertTitle>
        </Alert>
      ) : isError ? (
        <Alert className="border-destructive/50 bg-destructive/5">
          <Info className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">
            Configuration Error
          </AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-sm text-destructive">
                Failed to check webhook configuration status. Please try refreshing the page.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                data-testid="button-reload-page"
              >
                Reload Page
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className={hasSecret ? "border-primary/50 bg-primary/5" : "border-yellow-500/50 bg-yellow-500/5"}>
          <Info className={`h-4 w-4 ${hasSecret ? "text-primary" : "text-yellow-600"}`} />
          <AlertTitle className={hasSecret ? "text-primary" : "text-yellow-600"}>
            Setup Status
          </AlertTitle>
          <AlertDescription>
            {hasSecret ? (
              <div className="flex items-center gap-2 mt-1">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  Webhook is secured with authentication token
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <Shield className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-600">
                  Warning: GPS_WEBHOOK_SECRET not configured - webhook is unsecured!
                </span>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Use these credentials to configure your GPS tracking software
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
                data-testid="input-webhook-url"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                data-testid="button-copy-webhook-url"
              >
                {copiedField === "Webhook URL" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This is the endpoint where your navigation software will send GPS updates
            </p>
          </div>

          <div className="space-y-2">
            <Label>Authentication Method</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Bearer Token
              </Badge>
              <span className="text-sm text-muted-foreground">
                Include your secret token in the Authorization header
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Secret Token Location</Label>
            <p className="text-sm text-muted-foreground">
              Your GPS_WEBHOOK_SECRET is stored securely in Replit Secrets. Configure your navigation software to send this token in the Authorization header.
            </p>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Security Note:</strong> Never share your webhook secret publicly. If compromised, update it in Replit Secrets immediately.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Integration Instructions
          </CardTitle>
          <CardDescription>
            How to send GPS data from your navigation software
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="request-format">
              <AccordionTrigger>Request Format</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">HTTP Method</h4>
                  <Badge variant="outline" className="font-mono">POST</Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Required Headers</h4>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
                    <div>Content-Type: application/json</div>
                    <div>Authorization: Bearer YOUR_SECRET_TOKEN</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Request Body (JSON)</h4>
                  <div className="bg-muted p-3 rounded-md font-mono text-sm overflow-x-auto">
                    <pre>{JSON.stringify({
                      vehicle_id: "uuid-of-vehicle",
                      latitude: 40.7128,
                      longitude: -74.0060,
                      timestamp: "2025-11-07T20:05:00Z"
                    }, null, 2)}</pre>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You can use either <code className="bg-muted px-1 rounded">vehicle_id</code> (UUID from Kid Commute) or <code className="bg-muted px-1 rounded">plate_number</code> to identify the vehicle.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="curl-example">
              <AccordionTrigger>cURL Example</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Test your webhook with this example command:
                </p>
                <div className="bg-muted p-3 rounded-md font-mono text-sm overflow-x-auto">
                  <pre>{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \\
  -d '{
    "vehicle_id": "your-vehicle-uuid",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "2025-11-07T20:05:00Z"
  }'`}</pre>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(
                    `curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \\\n  -d '{\n    "vehicle_id": "your-vehicle-uuid",\n    "latitude": 40.7128,\n    "longitude": -74.0060,\n    "timestamp": "2025-11-07T20:05:00Z"\n  }'`,
                    "cURL command"
                  )}
                  className="mt-2"
                  data-testid="button-copy-curl"
                >
                  {copiedField === "cURL command" ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Command
                    </>
                  )}
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="supported-software">
              <AccordionTrigger>Supported Navigation Software</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Kid Commute's webhook works with any GPS tracking software that can send HTTP POST requests. Popular options include:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <div>
                      <strong>Google Maps Platform</strong> - Use the Roads API with custom webhooks
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <div>
                      <strong>Traccar</strong> - Open-source GPS tracking platform with webhook support
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <div>
                      <strong>OwnTracks</strong> - Personal location tracking with HTTP mode
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <div>
                      <strong>Custom GPS Devices</strong> - Any device that can send HTTP requests with location data
                    </div>
                  </li>
                </ul>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Need help integrating? Most GPS tracking platforms allow you to configure webhook endpoints in their settings or dashboard.
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="field-reference">
              <AccordionTrigger>Field Reference</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="border-l-2 border-primary/30 pl-3 space-y-1">
                    <div className="font-mono text-sm font-semibold">vehicle_id</div>
                    <p className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Optional</Badge>
                      The UUID of the vehicle from Kid Commute. Use this OR plate_number.
                    </p>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-3 space-y-1">
                    <div className="font-mono text-sm font-semibold">plate_number</div>
                    <p className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Optional</Badge>
                      The license plate number of the vehicle. Use this OR vehicle_id.
                    </p>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-3 space-y-1">
                    <div className="font-mono text-sm font-semibold">latitude</div>
                    <p className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Required</Badge>
                      Latitude coordinate in decimal degrees (e.g., 40.7128)
                    </p>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-3 space-y-1">
                    <div className="font-mono text-sm font-semibold">longitude</div>
                    <p className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Required</Badge>
                      Longitude coordinate in decimal degrees (e.g., -74.0060)
                    </p>
                  </div>
                  <div className="border-l-2 border-primary/30 pl-3 space-y-1">
                    <div className="font-mono text-sm font-semibold">timestamp</div>
                    <p className="text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Required</Badge>
                      ISO 8601 timestamp (e.g., 2025-11-07T20:05:00Z)
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>
            Understanding the real-time tracking workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 font-semibold">
              1
            </div>
            <div>
              <h4 className="font-semibold text-sm">Navigation Software Sends Location</h4>
              <p className="text-sm text-muted-foreground">
                Your GPS tracking system sends POST requests with vehicle coordinates to the webhook URL
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 font-semibold">
              2
            </div>
            <div>
              <h4 className="font-semibold text-sm">Kid Commute Updates Vehicle Position</h4>
              <p className="text-sm text-muted-foreground">
                The webhook receives the GPS data, verifies authentication, and updates the vehicle's current location in the database
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 font-semibold">
              3
            </div>
            <div>
              <h4 className="font-semibold text-sm">Parents See Real-Time ETAs</h4>
              <p className="text-sm text-muted-foreground">
                Parents automatically see estimated arrival times on their dashboard based on the vehicle's current location and their selected pickup stop
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
