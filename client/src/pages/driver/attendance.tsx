import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Users, Clock, Bell } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { PullToRefresh } from "@/components/pull-to-refresh";

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

export default function DriverAttendance() {
  const { toast } = useToast();
  const { socket } = useWebSocket();
  const today = new Date().toISOString().split('T')[0];

  const { data: driverAssignments } = useQuery<any[]>({
    queryKey: ["/api/driver/my-assignments"],
  });

  const currentRoute = driverAssignments?.find(
    (a: any) => a.date === today && a.isActive
  );

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ["/api/driver/route-students", currentRoute?.routeId],
    enabled: !!currentRoute?.routeId,
  });

  const setAttendanceMutation = useMutation({
    mutationFn: async (data: { studentId: string; status: "riding" | "absent" }) => {
      return await apiRequest("POST", "/api/attendance", {
        studentId: data.studentId,
        date: today,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-students"] });
      toast({
        title: "Success",
        description: "Attendance updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attendance",
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
        if (data.type === "attendance_update" && data.routeId === currentRoute.routeId && data.date === today) {
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
  }, [socket, currentRoute, toast]);

  const ridingCount = students.filter(s => s.attendance?.status === "riding").length;
  const absentCount = students.filter(s => s.attendance?.status === "absent").length;
  const pendingCount = students.filter(s => !s.attendance || s.attendance.status === "PENDING").length;

  return (
    <PullToRefresh queryKeys={[["/api/driver/my-assignments"], ["/api/driver/route-students"]]}>
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
                      </>
                    ) : (
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
