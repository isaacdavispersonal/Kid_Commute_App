// Parent dashboard with student overview
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, MapPin, Clock, Bus, Phone, MessageSquare, Bell, Navigation, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { NoChildrenBanner } from "@/components/no-children-banner";
import { ParentTutorialBanner } from "@/components/parent-tutorial-banner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";

interface PaymentPortal {
  id: string;
  provider: "quickbooks" | "classwallet";
  portalUrl: string;
  displayName: string;
  isEnabled: boolean;
}

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string;
  assignedRoute?: string;
  routeName?: string;
  pickupStop?: {
    name: string;
    scheduledTime: string;
  };
  dropoffStop?: {
    name: string;
    scheduledTime: string;
  };
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  activeShiftId?: string | null;
  stopsRemaining?: number | null;
  totalStops?: number | null;
  stopsCompleted?: number | null;
  routeProgressPct?: number | null;
  studentPickedUp?: boolean;
  routeStatus?: "active" | "inactive";
}

// Calculate ETA based on scheduled pickup time
function calculateETA(scheduledTime: string): { minutes: number; isApproaching: boolean; isPast: boolean } {
  if (!scheduledTime) return { minutes: 0, isApproaching: false, isPast: false };
  
  const now = new Date();
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);
  
  const diffMs = scheduled.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  // If the scheduled time has passed, assume it's for tomorrow
  if (diffMinutes < -30) {
    scheduled.setDate(scheduled.getDate() + 1);
    const newDiffMs = scheduled.getTime() - now.getTime();
    const newDiffMinutes = Math.floor(newDiffMs / 60000);
    return {
      minutes: newDiffMinutes,
      isApproaching: newDiffMinutes <= 15 && newDiffMinutes > 0,
      isPast: false
    };
  }
  
  return {
    minutes: diffMinutes,
    isApproaching: diffMinutes <= 15 && diffMinutes > 0,
    isPast: diffMinutes < 0
  };
}

export default function ParentDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { socket, isConnected } = useWebSocket();
  
  const { data: students, isLoading } = useQuery<StudentData[]>({
    queryKey: ["/api/parent/students"],
    refetchInterval: 120000, // Fallback refetch every 2 minutes (WebSocket is primary)
    refetchIntervalInBackground: true,
  });

  // Fetch configured payment portals
  const { data: paymentPortals } = useQuery<PaymentPortal[]>({
    queryKey: ["/api/billing/portals"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Listen for WebSocket route progress updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Invalidate student data on stop completion or route progress updates
        if (data.category === "stop_completion" || data.type === "route_progress_update") {
          console.log("[parent-dashboard] Route progress update received, refreshing student data");
          queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
        }
      } catch (error) {
        // Ignore parse errors
      }
    };

    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, isConnected]);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <ParentDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Parent Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track your children's transportation
        </p>
      </div>

      <IncompleteProfileBanner />
      
      <ParentTutorialBanner />
      
      {students && students.length === 0 && <NoChildrenBanner />}

      {students && students.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {students.map((student: any) => (
            <Card key={student.id} className="hover-elevate" data-testid={`card-student-${student.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {student.firstName[0]}
                      {student.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {student.firstName} {student.lastName}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {student.assignedRoute ? (
                  <>
                    {/* Live ETA Countdown */}
                    {student.pickupStop && (() => {
                      const eta = calculateETA(student.pickupStop.scheduledTime);
                      if (eta.isApproaching) {
                        return (
                          <div className="p-4 rounded-md bg-warning/10 border-2 border-warning" data-testid="eta-countdown">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Bell className="h-6 w-6 text-warning animate-pulse" />
                                <div>
                                  <p className="text-sm font-semibold text-warning">Bus Arriving Soon!</p>
                                  <p className="text-lg font-bold">
                                    {eta.minutes} minute{eta.minutes !== 1 ? 's' : ''} away
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-warning/20 text-warning border-warning">
                                Live ETA
                              </Badge>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                        <Bus className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Route Assignment</p>
                          <p className="text-sm text-muted-foreground">
                            {student.routeName}
                          </p>
                        </div>
                        <StatusBadge status="active" />
                      </div>

                      {/* Route Progress Tracking */}
                      {student.routeStatus === "active" && student.totalStops != null && (
                        <div className={`p-3 rounded-md border ${
                          student.studentPickedUp 
                            ? 'bg-success/5 border-success/20' 
                            : 'bg-primary/5 border-primary/20'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Navigation className={`h-4 w-4 ${student.studentPickedUp ? 'text-success' : 'text-primary'}`} />
                              <p className="text-sm font-medium">Route Progress</p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={
                                student.studentPickedUp
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-primary/10 text-primary border-primary/30"
                              }
                              data-testid={`badge-route-status-${student.id}`}
                            >
                              {student.studentPickedUp ? "Picked Up" : "En Route"}
                            </Badge>
                          </div>
                          
                          {student.studentPickedUp ? (
                            <div className="flex items-center gap-2 text-success">
                              <Bell className="h-4 w-4" />
                              <p className="text-sm font-semibold" data-testid={`text-picked-up-${student.id}`}>
                                Picked up at {student.pickupStop?.scheduledTime || ""}
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium" data-testid={`text-progress-pct-${student.id}`}>
                                    {student.routeProgressPct || 0}%
                                  </span>
                                </div>
                                <Progress 
                                  value={student.routeProgressPct || 0} 
                                  className="h-2"
                                  data-testid={`progress-bar-route-${student.id}`}
                                />
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {student.stopsCompleted || 0} of {student.totalStops} stops completed
                                  </span>
                                  <span 
                                    className="font-semibold text-primary"
                                    data-testid={`text-stops-remaining-${student.id}`}
                                  >
                                    {student.stopsRemaining || 0} stop{student.stopsRemaining !== 1 ? 's' : ''} away
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {student.routeStatus === "inactive" && (
                        <div className="p-3 rounded-md bg-muted/50 border border-muted">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <p className="text-sm" data-testid={`text-route-inactive-${student.id}`}>
                              Route not currently active
                            </p>
                          </div>
                        </div>
                      )}

                      {student.pickupStop && (
                        <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                          <MapPin className="h-5 w-5 text-success mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Pickup Location</p>
                            <p className="text-sm text-muted-foreground">
                              {student.pickupStop.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                {student.pickupStop.scheduledTime}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {student.dropoffStop && (
                        <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                          <MapPin className="h-5 w-5 text-destructive mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Dropoff Location</p>
                            <p className="text-sm text-muted-foreground">
                              {student.dropoffStop.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                {student.dropoffStop.scheduledTime}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Contact & Tracking Actions */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button asChild variant="default" className="flex-1" data-testid="button-track-vehicle">
                          <Link href="/parent/tracking">
                            <MapPin className="h-4 w-4 mr-2" />
                            Track Live
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="flex-1" data-testid="button-message-driver">
                          <Link href="/parent/messages">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </Link>
                        </Button>
                      </div>
                      {student.driverPhone && (
                        <Button 
                          variant="outline" 
                          className="w-full"
                          data-testid="button-call-driver"
                          onClick={() => window.location.href = `tel:${student.driverPhone}`}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call Driver: {student.driverName || 'Driver'}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No route assigned yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-16">
            <UserCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No Students Found</p>
            <p className="text-sm text-muted-foreground">
              Contact your administrator to add students to your account
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Billing & Payment Portal - Only show if portals are configured */}
      {paymentPortals && paymentPortals.length > 0 && (
        <Card data-testid="card-billing-portal">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Billing & Payment</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Pay for transportation services using your preferred payment method
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Available Payment Options:</p>
              <p className="text-sm text-muted-foreground">
                Please use one of the payment portals below. You'll need to log in with your account credentials for each service.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentPortals.map((portal) => (
                <Button
                  key={portal.id}
                  variant="default"
                  className="w-full justify-between"
                  onClick={() => window.open(portal.portalUrl, "_blank")}
                  data-testid={`button-${portal.provider}`}
                >
                  <span>{portal.displayName}</span>
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Note: After clicking, you'll be directed to the payment portal where you'll need to sign in with your account credentials. Contact the administrator if you need help with payment setup.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ParentDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
    </div>
  );
}
