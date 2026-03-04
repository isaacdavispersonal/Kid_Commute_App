// Driver students page - view students assigned to driver's routes
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useRegisterRefresh } from "@/contexts/RefreshContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MedicalBadge } from "@/components/medical-badge";
import { 
  Users, 
  Route as RouteIcon, 
  Phone, 
  AlertCircle,
  Sunrise,
  Sunset,
  Clock,
  Calendar,
  Heart,
  MessageSquarePlus
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  guardianPhones: string[];
  allergies?: string | null;
  medicalNotes?: string | null;
  specialNeeds?: string | null;
  photoUrl?: string | null;
  routeName: string;
  routeId: string;
  shiftType: "MORNING" | "AFTERNOON" | "EXTRA" | null;
  attendance?: {
    status: "riding" | "absent";
    markedByUserId: string;
    createdAt: string;
  } | null;
}

interface GroupedStudent {
  id: string;
  firstName: string;
  lastName: string;
  guardianPhones: string[];
  allergies?: string | null;
  medicalNotes?: string | null;
  specialNeeds?: string | null;
  photoUrl?: string | null;
  routes: Array<{
    routeId: string;
    routeName: string;
    shiftType: "MORNING" | "AFTERNOON" | "EXTRA" | null;
  }>;
}

function ShiftTypeBadge({ type }: { type: "MORNING" | "AFTERNOON" | "EXTRA" | null }) {
  if (!type) return null;
  
  const config = {
    MORNING: { icon: Sunrise, label: "AM", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    AFTERNOON: { icon: Sunset, label: "PM", className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
    EXTRA: { icon: Clock, label: "Extra", className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  };

  const { icon: Icon, label, className } = config[type];

  return (
    <Badge variant="outline" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function StudentCard({ student }: { student: GroupedStudent }) {
  const hasMedical = !!(student.allergies?.trim() || student.medicalNotes?.trim());
  
  return (
    <Card className="hover-elevate" data-testid={`card-student-${student.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {student.firstName[0]}
              {student.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-medium truncate" data-testid={`text-student-name-${student.id}`}>
                {student.firstName} {student.lastName}
              </h3>
              <div className="flex items-center gap-1">
                <MedicalBadge 
                  allergies={student.allergies} 
                  medicalNotes={student.medicalNotes}
                  size="sm"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {student.routes.map((route, idx) => (
                <div key={`${route.routeId}-${idx}`} className="flex items-center gap-1">
                  <ShiftTypeBadge type={route.shiftType} />
                  <Badge variant="outline" className="text-muted-foreground">
                    <RouteIcon className="h-3 w-3 mr-1" />
                    {route.routeName}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Medical Info Display */}
            {hasMedical && (
              <div className="mt-2 p-2 rounded-md bg-destructive/5 border border-destructive/10 space-y-1">
                {student.allergies?.trim() && (
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-destructive">Allergies:</span>{" "}
                      <span className="text-muted-foreground">{student.allergies}</span>
                    </div>
                  </div>
                )}
                {student.medicalNotes?.trim() && (
                  <div className="flex items-start gap-2 text-sm">
                    <Heart className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-destructive">Medical:</span>{" "}
                      <span className="text-muted-foreground">{student.medicalNotes}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guardian contact */}
            {student.guardianPhones && student.guardianPhones.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3 w-3" />
                <a 
                  href={`tel:${student.guardianPhones[0]}`}
                  className="hover:text-primary transition-colors"
                  data-testid={`link-phone-${student.id}`}
                >
                  {student.guardianPhones[0]}
                </a>
              </div>
            )}

            {/* Request info update - link to Messages to contact admin */}
            <div className="mt-3 pt-3 border-t">
              <Link href="/driver/messages">
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" data-testid={`button-request-update-${student.id}`}>
                  <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
                  Request info update
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DriverStudents() {
  const { data: students, isLoading, error } = useQuery<Student[]>({
    queryKey: ["/api/driver/students"],
  });

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/driver/students"] });
  }, []);
  useRegisterRefresh("driver-students", handleRefresh);

  if (isLoading) {
    return (
      <div className="p-4">
        <StudentsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Students</AlertTitle>
          <AlertDescription>
            {(error as any).message || "Failed to load students. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Group students by student ID to deduplicate, showing all their routes
  const groupedStudents: GroupedStudent[] = Object.values(
    (students || []).reduce((acc, student) => {
      if (!acc[student.id]) {
        acc[student.id] = {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          guardianPhones: student.guardianPhones,
          allergies: student.allergies,
          medicalNotes: student.medicalNotes,
          specialNeeds: student.specialNeeds,
          photoUrl: student.photoUrl,
          routes: [],
        };
      }
      acc[student.id].routes.push({
        routeId: student.routeId,
        routeName: student.routeName,
        shiftType: student.shiftType,
      });
      return acc;
    }, {} as Record<string, GroupedStudent>)
  );

  // Sort by name
  groupedStudents.sort((a, b) => 
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );

  const medicalCount = groupedStudents.filter(s => s.allergies?.trim() || s.medicalNotes?.trim()).length;

  return (
      <div className="p-4 space-y-6 max-w-3xl mx-auto overflow-x-hidden">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold" data-testid="title-students">
              My Students
            </h1>
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              {groupedStudents.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Students on today's assigned routes
          </p>
        </div>

        {/* Medical info summary */}
        {medicalCount > 0 && (
          <Alert className="border-destructive/50 bg-destructive/5" data-testid="alert-medical-summary">
            <Heart className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Medical Information</AlertTitle>
            <AlertDescription>
              <span className="font-semibold">{medicalCount}</span> student{medicalCount !== 1 ? 's' : ''} have medical information. Look for the <Badge variant="destructive" className="text-xs px-1.5 py-0.5 inline-flex items-center gap-1"><Heart className="h-3 w-3" />Medical</Badge> badge.
            </AlertDescription>
          </Alert>
        )}

        {/* Today's date */}
        <div className="flex items-center gap-2 p-4 rounded-md bg-muted/30 border">
          <Calendar className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Today's Students</p>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Students list - deduplicated by student with route chips */}
        {groupedStudents.length > 0 ? (
          <div className="grid gap-3">
            {groupedStudents.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </div>
        ) : (
          <Card data-testid="card-no-students">
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Students Today</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any students on your assigned routes for today.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    
  );
}
