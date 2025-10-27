// Admin schedule management page with weekly calendar
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function AdminSchedule() {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["/api/admin/schedules"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Schedule Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage driver assignments and weekly schedules
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {daysOfWeek.map((day, dayIndex) => {
          const daySchedules = schedules?.filter(
            (s: any) => s.dayOfWeek === dayIndex
          ) || [];

          return (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {day}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {daySchedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {daySchedules.map((schedule: any) => (
                      <div
                        key={schedule.id}
                        className="p-4 rounded-md bg-accent/50 hover-elevate"
                        data-testid={`schedule-${schedule.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-sm">
                            {schedule.driverName}
                          </p>
                          <StatusBadge
                            status={schedule.isActive ? "active" : "inactive"}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {schedule.routeName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No assignments for {day}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
