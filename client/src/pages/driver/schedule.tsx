// Driver weekly schedule page
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, Route as RouteIcon, Car } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

interface ScheduleAssignment {
  id: string;
  routeId: string;
  vehicleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  routeName: string;
  vehicleName: string;
  vehiclePlate: string;
  stops: any[];
}

export default function DriverSchedule() {
  const { data: schedule, isLoading } = useQuery<ScheduleAssignment[]>({
    queryKey: ["/api/driver/schedule"],
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
        <h1 className="text-2xl font-semibold mb-1" data-testid="title-schedule">
          My Schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          View your weekly route assignments
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {DAYS_OF_WEEK.map((day) => {
          const dayAssignments = schedule?.filter(
            (s) => s.dayOfWeek === day.value
          ) || [];

          return (
            <Card key={day.value} data-testid={`day-card-${day.value}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    {day.label}
                  </div>
                  {dayAssignments.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {dayAssignments.length} {dayAssignments.length === 1 ? 'route' : 'routes'}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dayAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {dayAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="p-4 rounded-md bg-accent/50 hover-elevate"
                        data-testid={`assignment-${assignment.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <RouteIcon className="h-4 w-4 text-primary" />
                            <p className="font-semibold">
                              {assignment.routeName}
                            </p>
                          </div>
                          <StatusBadge
                            status={assignment.isActive ? "active" : "inactive"}
                          />
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {assignment.startTime} - {assignment.endTime}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Car className="h-3.5 w-3.5" />
                            <span>
                              {assignment.vehicleName} ({assignment.vehiclePlate})
                            </span>
                          </div>

                          {assignment.stops && assignment.stops.length > 0 && (
                            <div className="pt-2 mt-2 border-t">
                              <p className="text-xs font-medium mb-1.5">
                                {assignment.stops.length} {assignment.stops.length === 1 ? 'stop' : 'stops'}
                              </p>
                              <div className="space-y-1">
                                {assignment.stops.slice(0, 3).map((stop: any, idx: number) => (
                                  <p key={stop.id} className="text-xs text-muted-foreground">
                                    {idx + 1}. {stop.name}
                                  </p>
                                ))}
                                {assignment.stops.length > 3 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    +{assignment.stops.length - 3} more stops
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid={`no-assignments-${day.value}`}>
                    No routes assigned for {day.label}
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
