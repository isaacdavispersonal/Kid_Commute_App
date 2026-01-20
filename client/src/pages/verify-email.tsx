import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Mail, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { getApiUrl } from "@/lib/config";

export default function VerifyEmail() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "already_used" | "expired" | "missing_token">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const error = urlParams.get("error");
  const success = urlParams.get("success");

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(getApiUrl("/api/auth/user"), {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          setUserEmail(data.email || null);
          if (data.email) {
            setEmail(data.email);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (success === "true") {
      setStatus("success");
      return;
    }

    if (error) {
      switch (error) {
        case "missing_token":
          setStatus("missing_token");
          setErrorMessage("No verification token provided");
          break;
        case "invalid_token":
          setStatus("error");
          setErrorMessage("This verification link is invalid");
          break;
        case "already_used":
          setStatus("already_used");
          setErrorMessage("This verification link has already been used");
          break;
        case "expired":
          setStatus("expired");
          setErrorMessage("This verification link has expired");
          break;
        case "server_error":
          setStatus("error");
          setErrorMessage("Something went wrong. Please try again.");
          break;
        default:
          setStatus("error");
          setErrorMessage("An unknown error occurred");
      }
      return;
    }

    if (!token) {
      setStatus("missing_token");
      return;
    }

    const verifyEmail = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(getApiUrl("/api/auth/verify-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.message?.includes("already been used")) {
            setStatus("already_used");
          } else if (data.message?.includes("expired")) {
            setStatus("expired");
          } else {
            setStatus("error");
            setErrorMessage(data.message || "Verification failed");
          }
          return;
        }

        setStatus("success");
        toast({
          title: "Email Verified",
          description: "Your email has been successfully verified!",
        });
      } catch (err) {
        setStatus("error");
        setErrorMessage("Failed to verify email. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token, error, success, toast]);

  const handleResendVerification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setIsResending(true);
    setResendSuccess(false);
    
    try {
      const body: { email?: string } = {};
      const emailToUse = email.trim() || userEmail;
      if (emailToUse) {
        body.email = emailToUse;
      }

      const response = await fetch(getApiUrl("/api/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok && response.status >= 400) {
        throw new Error(data.message || "Failed to resend verification");
      }

      setResendSuccess(true);
      toast({
        title: "Check Your Email",
        description: data.message || "If an account exists, you'll receive a verification link.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to resend verification email",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Email Verified!</CardTitle>
            <CardDescription>Your email address has been successfully verified</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              You now have full access to all features.
            </p>
            <Link href="/">
              <Button className="w-full" data-testid="button-go-to-app">
                Continue to App
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "already_used") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Already Verified</CardTitle>
            <CardDescription>This verification link has already been used</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Your email address is verified. You can continue using the app.
            </p>
            <Link href="/">
              <Button className="w-full" data-testid="button-go-to-app">
                Continue to App
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ResendForm = () => {
    const showEmailInput = !isAuthenticated || !userEmail;
    
    return (
      <form onSubmit={handleResendVerification} className="space-y-4">
        {resendSuccess ? (
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Check your inbox for the verification link.
            </p>
          </div>
        ) : (
          <>
            {showEmailInput ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isResending}
                  data-testid="input-resend-email"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                We'll send a new verification link to <span className="font-medium">{userEmail}</span>
              </p>
            )}
            <Button 
              type="submit"
              className="w-full" 
              disabled={isResending || (showEmailInput && !email.trim())}
              data-testid="button-resend-verification"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Send Verification Email
                </>
              )}
            </Button>
          </>
        )}
      </form>
    );
  };

  if (status === "expired") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <XCircle className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Link Expired</CardTitle>
            <CardDescription>This verification link has expired</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Verification links expire after 24 hours. Request a new one below.
            </p>
            <ResendForm />
            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-back-home">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "missing_token") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>Email verification is required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              {isAuthenticated 
                ? "Your email address needs to be verified. Request a verification link below."
                : "Please check your inbox for a verification link, or request a new one below."}
            </p>
            <ResendForm />
            <Link href="/">
              <Button variant="ghost" className="w-full" data-testid="button-back-home">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Verification Failed</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            We couldn't verify your email address. Request a new verification link below.
          </p>
          <ResendForm />
          <Link href="/">
            <Button variant="outline" className="w-full" data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
