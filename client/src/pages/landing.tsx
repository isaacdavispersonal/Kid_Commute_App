// Landing page for unauthenticated users
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Users, MapPin, MessageSquare, Shield, Clock, UserPlus, Mail } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center gap-12">
          <div className="flex items-center gap-3">
            <Car className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">Kid Connect</h1>
          </div>

          <div className="text-center max-w-2xl">
            <h2 className="text-3xl font-semibold mb-4">
              Safe, Reliable Transportation
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Connecting administrators, drivers, and parents with real-time tracking,
              route scheduling, and seamless communication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            <Card className="hover-elevate">
              <CardHeader>
                <UserPlus className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Parents: Sign Up Now</CardTitle>
                <CardDescription>
                  Create your account instantly to start tracking your child's bus and
                  communicate with drivers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => (window.location.href = "/api/login")}
                  data-testid="button-parent-signup"
                >
                  Get Started Free
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Sign up with email, Google, GitHub, or Apple
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <Mail className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Staff Access</CardTitle>
                <CardDescription>
                  Drivers and administrators need to be approved before accessing the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => (window.location.href = "/api/login")}
                  data-testid="button-staff-login"
                >
                  Staff Sign In
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Contact your administrator to request driver/admin access
                </p>
              </CardContent>
            </Card>
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
