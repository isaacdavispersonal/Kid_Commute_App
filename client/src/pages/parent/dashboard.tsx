// Parent dashboard with student overview
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, MapPin, Clock, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { NoChildrenBanner } from "@/components/no-children-banner";
import { ParentTutorialBanner } from "@/components/parent-tutorial-banner";

export default function ParentDashboard() {
  const { data: students, isLoading } = useQuery({
    queryKey: ["/api/parent/students"],
  });

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
                    {student.grade && (
                      <p className="text-sm text-muted-foreground">
                        Grade {student.grade}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {student.assignedRoute ? (
                  <>
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

                    <div className="flex gap-2">
                      <Button asChild variant="default" className="flex-1" data-testid="button-track-vehicle">
                        <Link href="/parent/tracking">
                          <MapPin className="h-4 w-4 mr-2" />
                          Track Vehicle
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="flex-1" data-testid="button-contact-driver">
                        <Link href="/parent/messages">Contact Driver</Link>
                      </Button>
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
