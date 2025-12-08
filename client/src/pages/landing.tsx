import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, Users, MapPin, MessageSquare, Shield, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isNative, getApiUrl } from "@/lib/config";
import { setAuthToken } from "@/lib/mobile-auth";
import type { User } from "@shared/schema";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center gap-12">
          <div className="flex items-center gap-3">
            <Car className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">Kid Connect</h1>
          </div>

          <div className="w-full max-w-md">
            <AuthCard />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
            <FeatureCard
              icon={Users}
              title="Multi-Role Access"
              description="Tailored interfaces for admins, drivers, and parents with role-based permissions"
            />
            <FeatureCard
              icon={MapPin}
              title="Live Fleet Tracking"
              description="Real-time vehicle location monitoring with interactive map visualization"
            />
            <FeatureCard
              icon={MessageSquare}
              title="Instant Messaging"
              description="Direct communication between drivers and parents with quick reply templates"
            />
            <FeatureCard
              icon={Clock}
              title="Route Scheduling"
              description="Automated route assignments with weekly calendar management"
            />
            <FeatureCard
              icon={Shield}
              title="Incident Reporting"
              description="Comprehensive incident tracking and vehicle inspection checklists"
            />
            <FeatureCard
              icon={Car}
              title="Vehicle Management"
              description="Complete fleet oversight with maintenance tracking and status monitoring"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthCard() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle>Welcome</CardTitle>
        <CardDescription>
          Sign in to access your transportation dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm onSuccess={() => setActiveTab("login")} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identifier || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter your email or phone and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const url = getApiUrl("/api/auth/login");
      const requestBody = { identifier, password };
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Login failed";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as { token: string; user: User };
      
      if (isNative && data.token) {
        await setAuthToken(data.token);
      }
      
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully",
      });

      window.location.reload();
    } catch (error: any) {
      console.error("[Auth] Login failed:", error?.message);
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or Phone</Label>
        <Input
          id="identifier"
          type="text"
          placeholder="email@example.com or phone number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={isLoading}
          data-testid="input-identifier"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          data-testid="input-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign In"
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground mt-4">
        Staff members should contact their administrator for access credentials
      </p>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.firstName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const url = getApiUrl("/api/auth/register");
      const requestBody = {
        email: formData.email,
        phone: formData.phoneNumber || undefined,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      };
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Registration failed";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as { token: string; user: User };

      if (isNative && data.token) {
        await setAuthToken(data.token);
        window.location.reload();
      } else {
        toast({
          title: "Account Created",
          description: "Your account has been created. Please sign in.",
        });
        onSuccess();
      }
    } catch (error: any) {
      console.error("[Auth] Registration failed:", error?.message);
      toast({
        title: "Registration Failed",
        description: error.message || "Could not create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            type="text"
            placeholder="First name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            disabled={isLoading}
            data-testid="input-first-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            disabled={isLoading}
            data-testid="input-last-name"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="email@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isLoading}
          data-testid="input-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="(optional)"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          disabled={isLoading}
          data-testid="input-phone"
        />
        <p className="text-xs text-muted-foreground">
          If provided, your account will be linked to your household for student updates
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="registerPassword">Password *</Label>
        <Input
          id="registerPassword"
          type="password"
          placeholder="At least 6 characters"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading}
          data-testid="input-register-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password *</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          disabled={isLoading}
          data-testid="input-confirm-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-register">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create Account"
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        By registering, you agree to our Terms of Service and Privacy Policy
      </p>
    </form>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-md p-6 hover-elevate">
      <Icon className="h-10 w-10 text-primary mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
