import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, AlertCircle, CheckCircle, Phone, UserCircle, MapPin, Route as RouteIcon } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";

interface EnrichedStudent {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  assignedRouteId: string | null;
  routeName?: string | null;
  pickupStop?: {
    id: string;
    name: string;
    scheduledTime: string;
  } | null;
  dropoffStop?: {
    id: string;
    name: string;
    scheduledTime: string;
  } | null;
}

export default function ConnectChildrenPage() {
  const { toast } = useToast();
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: students, isLoading: studentsLoading } = useQuery<EnrichedStudent[]>({
    queryKey: ["/api/parent/students"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/parent/connect-children", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setHasAttemptedConnection(true);
      toast({
        title: "Success",
        description: data.message || "Children connected successfully",
      });
    },
    onError: (error: any) => {
      if (error.requiresPhoneNumber) {
        toast({
          title: "Phone Number Required",
          description: "Please set up your phone number in your profile first",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to connect children",
          variant: "destructive",
        });
      }
    },
  });

  const handleConnect = () => {
    if (!user?.phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please set up your phone number in your profile first",
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate();
  };

  if (studentsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Connect Children</h1>
        <p className="text-sm text-muted-foreground">
          Link your account to your children using your phone number
        </p>
      </div>

      {/* Phone Number Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Number Status
          </CardTitle>
          <CardDescription>
            Your phone number must match the guardian phone number registered for your children
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.phoneNumber ? (
            <Alert className="border-success/50 bg-success/5">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertTitle className="text-success font-semibold">
                Phone Number Set
              </AlertTitle>
              <AlertDescription>
                <p className="text-sm mt-1">
                  Your phone number: <span className="font-medium">{user.phoneNumber}</span>
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive font-semibold">
                Phone Number Required
              </AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-3">
                <p className="text-sm">
                  You need to add your phone number to your profile before connecting children.
                  This phone number must match the guardian phone registered for your children by the administrator.
                </p>
                <div>
                  <Button asChild size="sm" variant="destructive" data-testid="button-go-to-profile">
                    <Link href="/profile">
                      <Phone className="h-4 w-4 mr-2" />
                      Set Up Phone Number
                    </Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleConnect}
              disabled={!user?.phoneNumber || connectMutation.isPending}
              className="flex-1"
              data-testid="button-connect-children"
            >
              <Link2 className="h-4 w-4 mr-2" />
              {connectMutation.isPending ? "Connecting..." : "Connect Children"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Children */}
      {students && students.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Connected Children ({students.length})</h2>
            <p className="text-sm text-muted-foreground">
              Children linked to your account via phone number
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {students.map((student) => (
              <Card key={student.id} className="hover-elevate" data-testid={`card-student-${student.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {student.firstName[0]}
                        {student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {student.firstName} {student.lastName}
                      </CardTitle>
                      {student.grade && (
                        <p className="text-sm text-muted-foreground">
                          Grade {student.grade}
                        </p>
                      )}
                    </div>
                    {student.assignedRouteId && (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Assigned
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {student.assignedRouteId ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                        <RouteIcon className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Route</p>
                          <p className="text-sm text-muted-foreground">
                            {student.routeName}
                          </p>
                        </div>
                      </div>

                      {student.pickupStop && (
                        <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                          <MapPin className="h-5 w-5 text-success mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Pickup</p>
                            <p className="text-sm text-muted-foreground">
                              {student.pickupStop.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {student.pickupStop.scheduledTime}
                            </p>
                          </div>
                        </div>
                      )}

                      {student.dropoffStop && (
                        <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                          <MapPin className="h-5 w-5 text-destructive mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Dropoff</p>
                            <p className="text-sm text-muted-foreground">
                              {student.dropoffStop.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {student.dropoffStop.scheduledTime}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <UserCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Not assigned to a route yet
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Children Found After Connection Attempt */}
      {hasAttemptedConnection && students && students.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Matching Children Found</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm mb-3">
              No children were found with a guardian phone number matching <span className="font-medium">{user?.phoneNumber}</span>.
              Please contact the administrator to ensure your phone number is registered as a guardian for your children.
            </p>
            <p className="text-sm text-muted-foreground">
              Note: Children must be added by an administrator before they can be connected to your parent account.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
