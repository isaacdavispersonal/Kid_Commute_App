import { useState } from "react";
import { AlertTriangle, RefreshCw, Smartphone, CheckCircle, XCircle, Loader2, Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isNative, getApiBaseUrl } from "@/lib/config";

interface ConfigErrorScreenProps {
  errorMessage: string;
}

interface TestResult {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
  details?: {
    url?: string;
    timestamp?: string;
    version?: string;
    environment?: string;
  };
}

export function ConfigErrorScreen({ errorMessage }: ConfigErrorScreenProps) {
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });
  
  const handleRetry = () => {
    window.location.reload();
  };

  const handleTestConnection = async () => {
    setTestResult({ status: "testing" });
    
    const baseUrl = getApiBaseUrl();
    const testUrl = baseUrl ? `${baseUrl}/api/health` : "/api/health";
    
    try {
      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestResult({
          status: "success",
          message: "Connection successful!",
          details: {
            url: testUrl,
            timestamp: data.timestamp,
            version: data.version,
            environment: data.environment,
          },
        });
      } else {
        setTestResult({
          status: "error",
          message: `Server responded with status ${response.status}`,
          details: { url: testUrl },
        });
      }
    } catch (error) {
      setTestResult({
        status: "error",
        message: error instanceof Error ? error.message : "Connection failed",
        details: { url: testUrl },
      });
    }
  };

  const configuredUrl = getApiBaseUrl();

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-background">
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

          {/* Debug Info */}
          <div className="rounded-lg border p-3 text-xs space-y-1">
            <p className="font-medium text-muted-foreground">Debug Info:</p>
            <p><span className="text-muted-foreground">Platform:</span> {isNative ? "Native (iOS/Android)" : "Web"}</p>
            <p><span className="text-muted-foreground">API URL:</span> {configuredUrl || "(not configured)"}</p>
          </div>

          {/* Connection Test Section */}
          <div className="space-y-2">
            <Button 
              onClick={handleTestConnection} 
              variant="outline"
              className="w-full gap-2" 
              disabled={testResult.status === "testing"}
              data-testid="button-test-connection"
            >
              {testResult.status === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              Test Backend Connection
            </Button>

            {testResult.status === "success" && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 text-sm" data-testid="connection-test-success">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  {testResult.message}
                </div>
                {testResult.details && (
                  <div className="mt-2 text-xs text-green-600 dark:text-green-400 space-y-0.5">
                    <p>URL: {testResult.details.url}</p>
                    <p>Version: {testResult.details.version}</p>
                    <p>Environment: {testResult.details.environment}</p>
                  </div>
                )}
              </div>
            )}

            {testResult.status === "error" && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm" data-testid="connection-test-error">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium">
                  <XCircle className="h-4 w-4" />
                  Connection Failed
                </div>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {testResult.message}
                </p>
                {testResult.details?.url && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Tried: {testResult.details.url}
                  </p>
                )}
              </div>
            )}
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
