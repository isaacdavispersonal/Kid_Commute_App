import { AlertTriangle, RefreshCw, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isNative } from "@/lib/config";

interface ConfigErrorScreenProps {
  errorMessage: string;
}

export function ConfigErrorScreen({ errorMessage }: ConfigErrorScreenProps) {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl" data-testid="text-config-error-title">Configuration Error</CardTitle>
          <CardDescription data-testid="text-config-error-subtitle">
            {isNative ? "Mobile App Setup Required" : "Application Setup Required"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground" data-testid="text-config-error-message">
              {errorMessage}
            </p>
          </div>

          {isNative && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <Smartphone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">For Developers:</p>
                  <ol className="mt-1 text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Set VITE_API_URL in your environment</li>
                    <li>Run <code className="bg-muted px-1 rounded">npm run build</code></li>
                    <li>Run <code className="bg-muted px-1 rounded">npx cap sync</code></li>
                    <li>Rebuild the app in Xcode/Android Studio</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry} className="w-full gap-2" data-testid="button-retry-connection">
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            If this problem persists, please contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
