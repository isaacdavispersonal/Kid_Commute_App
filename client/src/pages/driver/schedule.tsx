// Driver weekly schedule page
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, Route as RouteIcon, Car } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";

interface ScheduleAssignment {
  id: string;
  routeId: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  isActive: boolean;
  routeName: string;
  vehicleName: string;
  vehiclePlate: string;
  stops: any[];
}

function getWeekDates(): Date[] {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - currentDay); // Go to Sunday
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DriverSchedule() {
  const { data: schedule, isLoading } = useQuery<ScheduleAssignment[]>({
    queryKey: ["/api/driver/schedule"],
  });

  const weekDates = getWeekDates();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const getAssignmentsForDate = (date: Date): ScheduleAssignment[] => {
    const dateStr = date.toISOString().split('T')[0];
    return schedule?.filter(s => s.date === dateStr) || [];
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1" data-testid="title-schedule">
          My Schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          View your route assignments for this week
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {weekDates.map((date, dayIndex) => {
          const dateStr = date.toISOString().split('T')[0];
          const dayAssignments = getAssignmentsForDate(date);
          const isToday = dateStr === today;

          return (
            <Card 
              key={dayIndex} 
              data-testid={`day-card-${dayIndex}`}
              className={isToday ? "border-primary" : ""}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    <div>
                      <div className={`${isToday ? "text-primary" : ""}`}>
                        {DAY_NAMES[dayIndex]}
                      </div>
                      <div className="text-sm font-normal text-muted-foreground">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
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
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid={`no-assignments-${dayIndex}`}>
                    No routes assigned for {DAY_NAMES[dayIndex]}
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
