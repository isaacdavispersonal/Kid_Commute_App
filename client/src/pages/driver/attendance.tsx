import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, XCircle, Users, Clock, Bell, Info, AlertCircle, Lock, Play, ClipboardCheck } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Link } from "wouter";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string;
  attendance?: {
    status: "PENDING" | "riding" | "absent";
    markedByUserId: string;
    createdAt: string;
  } | null;
};

interface TodayShift {
  id: string;
  routeId: string | null;
  routeName: string;
  shiftType: string;
  routeStartedAt: string | null;
  routeCompletedAt: string | null;
  inspectionCompletedAt: string | null;
  status: string;
}

export default function DriverAttendance() {
  const { toast } = useToast();
  const { socket } = useWebSocket();
  const { user } = useAuth();
  
  // Only lead drivers can mark attendance (absent/riding)
  // Regular drivers can only record board/deboard events on the route page
  const canMarkAttendance = user?.isLeadDriver === true;

  // Get today's shifts for better state feedback
  const { data: todayShifts } = useQuery<TodayShift[]>({
    queryKey: ["/api/driver/today-shifts"],
  });

  const { data: driverAssignments } = useQuery<any[]>({
    queryKey: ["/api/driver/my-assignments"],
  });

  // Find the currently active assignment for today
  // Use local date for comparison to match how shifts are stored
  const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  
  const localToday = getLocalDate();
  const currentRoute = driverAssignments?.find(
    (a: any) => a.date === localToday && a.isActive
  );
  
  // Find matching shift for more status details
  const currentShift = todayShifts?.find(
    (s) => s.routeId === currentRoute?.routeId
  );
  
  // Determine route state
  const isRouteCompleted = !!currentShift?.routeCompletedAt;
  const isRouteStarted = !!currentShift?.routeStartedAt;
  const isInspectionComplete = !!currentShift?.inspectionCompletedAt;
  
  // Use the shift date from the route assignment for consistency
  // This ensures attendance queries use the same date as the shift
  const shiftDate = currentRoute?.date || localToday;

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ["/api/driver/route-students", currentRoute?.routeId],
    enabled: !!currentRoute?.routeId,
  });

  // Get shiftId from current route assignment for per-shift attendance tracking
  const currentShiftId = currentRoute?.shiftId || currentRoute?.id;
  
  const setAttendanceMutation = useMutation({
    mutationFn: async (data: { studentId: string; status: "riding" | "absent" }) => {
      return await apiRequest("POST", "/api/attendance", {
        studentId: data.studentId,
        date: shiftDate,
        status: data.status,
        shiftId: currentShiftId, // Track AM/PM attendance separately
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-students"] });
      toast({
        title: "Success",
        description: "Attendance updated successfully",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to update attendance";
      toast({
        title: "Cannot Update Attendance",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleAttendance = (studentId: string, status: "riding" | "absent") => {
    setAttendanceMutation.mutate({ studentId, status });
  };

  if (!currentRoute) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Student Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No active route assignment for today. Please check your schedule or contact an administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Listen for WebSocket attendance updates from parents
  useEffect(() => {
    if (!socket || !currentRoute) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "attendance_update" && data.routeId === currentRoute.routeId && data.date === shiftDate) {
          // Show toast notification (no student identity leaked from server)
          toast({
            title: "Attendance Updated",
            description: "A parent updated attendance for a student on your route",
          });
          // Refresh the student list
          queryClient.invalidateQueries({ queryKey: ["/api/driver/route-students"] });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, currentRoute, toast, shiftDate]);

  const ridingCount = students.filter(s => s.attendance?.status === "riding").length;
  const absentCount = students.filter(s => s.attendance?.status === "absent").length;
  const pendingCount = students.filter(s => !s.attendance || s.attendance.status === "PENDING").length;

  return (
    <PullToRefresh queryKeys={[["/api/driver/my-assignments"], ["/api/driver/route-students"], ["/api/driver/today-shifts"]]}>
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Route: {currentRoute.routeName}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riding</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ridingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Route Completed Notice */}
      {isRouteCompleted && (
        <Alert className="border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-950" data-testid="alert-route-completed">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">Route Completed</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  This route has been completed. Attendance records are now locked and cannot be modified.
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Route Not Started Notice */}
      {currentShift && !isRouteStarted && !isRouteCompleted && (
        <Alert className="border-amber-500 dark:border-amber-400" data-testid="alert-route-not-started">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Route Not Started</h3>
                <p className="text-sm text-muted-foreground">
                  {!isInspectionComplete 
                    ? "Complete vehicle inspection and start your route to modify attendance."
                    : "Start your route from the dashboard to modify attendance."
                  }
                </p>
              </div>
              <Link href="/driver">
                <Button variant="outline" size="sm" data-testid="button-go-to-dashboard">
                  <Play className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info alert for non-lead drivers */}
      {!canMarkAttendance && !isRouteCompleted && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You can view student attendance status here. To record when students board or leave the bus, 
            use the route dashboard during your active shift.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading students...</p>
          </CardContent>
        </Card>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              No students assigned to this route.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`student-attendance-${student.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium" data-testid={`text-student-name-${student.id}`}>
                      {student.firstName} {student.lastName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {student.attendance && student.attendance.status !== "PENDING" ? (
                      <>
                        <Badge
                          variant={student.attendance.status === "riding" ? "default" : "destructive"}
                          data-testid={`badge-status-${student.id}`}
                        >
                          {student.attendance.status === "riding" ? "Riding" : "Absent"}
                        </Badge>
                        {canMarkAttendance && (
                          <Button
                            size="touch"
                            variant="outline"
                            onClick={() =>
                              handleAttendance(
                                student.id,
                                student.attendance!.status === "riding" ? "absent" : "riding"
                              )
                            }
                            disabled={setAttendanceMutation.isPending}
                            data-testid={`button-toggle-${student.id}`}
                          >
                            Toggle
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending
                        </Badge>
                        {canMarkAttendance && (
                          <>
                            <Button
                              size="touch"
                              onClick={() => handleAttendance(student.id, "riding")}
                              disabled={setAttendanceMutation.isPending}
                              data-testid={`button-riding-${student.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Riding
                            </Button>
                            <Button
                              size="touch"
                              variant="destructive"
                              onClick={() => handleAttendance(student.id, "absent")}
                              disabled={setAttendanceMutation.isPending}
                              data-testid={`button-absent-${student.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Absent
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </PullToRefresh>
  );
}
