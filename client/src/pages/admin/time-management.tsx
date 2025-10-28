// Admin comprehensive time management dashboard
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  Calendar, 
  PlayCircle, 
  StopCircle, 
  Edit, 
  Filter,
  Download,
  X,
  Check,
  User,
  TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, subDays } from "date-fns";

interface ClockEvent {
  id: string;
  driverId: string;
  shiftId: string | null;
  type: "IN" | "OUT";
  timestamp: string;
  source: "USER" | "AUTO" | "ADMIN_EDIT";
  notes: string | null;
  isResolved: boolean;
}

interface EnrichedClockEvent extends ClockEvent {
  driverName: string;
  shiftDate: string | null;
  shiftType: string | null;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function AdminTimeManagement() {
  const { toast } = useToast();
  
  // Filters
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("week");
  
  // Edit dialog state
  const [editingEvent, setEditingEvent] = useState<EnrichedClockEvent | null>(null);
  const [editedTimestamp, setEditedTimestamp] = useState<string>("");

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "week":
        return {
          startDate: format(subDays(now, 7), "yyyy-MM-dd"),
          endDate: format(now, "yyyy-MM-dd"),
        };
      case "month":
        return {
          startDate: format(subDays(now, 30), "yyyy-MM-dd"),
          endDate: format(now, "yyyy-MM-dd"),
        };
      case "all":
        return {};
      default:
        return {
          startDate: format(subDays(now, 7), "yyyy-MM-dd"),
          endDate: format(now, "yyyy-MM-dd"),
        };
    }
  };

  const range = getDateRange();

  // Fetch all drivers
  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ["/api/admin/users"],
    select: (users) => users.filter((u: any) => u.role === "driver"),
  });

  // Fetch all clock events
  const { data: clockEvents, isLoading } = useQuery<ClockEvent[]>({
    queryKey: ["/api/admin/all-clock-events", range.startDate, range.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range.startDate) params.append("startDate", range.startDate);
      if (range.endDate) params.append("endDate", range.endDate);
      
      const response = await fetch(`/api/admin/all-clock-events?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch clock events");
      }
      return response.json();
    },
  });

  // Fetch shifts for enrichment
  const { data: shifts } = useQuery({
    queryKey: ["/api/admin/shifts"],
  });

  // Edit clock event mutation
  const editClockEventMutation = useMutation({
    mutationFn: async (data: { id: string; timestamp: string; notes: string }) => {
      const timestampDate = new Date(data.timestamp);
      return await apiRequest("PATCH", `/api/admin/clock-events/${data.id}/edit`, {
        timestamp: timestampDate.toISOString(),
        notes: data.notes,
        source: "ADMIN_EDIT",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/all-clock-events"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/shifts"] });
      toast({
        title: "Clock Event Updated",
        description: "Clock event has been successfully updated",
      });
      setEditingEvent(null);
      setEditedTimestamp("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to update clock event",
        variant: "destructive",
      });
    },
  });

  // Enrich events with driver and shift information
  const enrichedEvents: EnrichedClockEvent[] = (clockEvents || []).map((event) => {
    const driver = drivers?.find((d) => d.id === event.driverId);
    const shift = shifts?.find((s: any) => s.id === event.shiftId);
    
    return {
      ...event,
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : "Unknown Driver",
      shiftDate: shift?.date || null,
      shiftType: shift?.shiftType || null,
    };
  });

  // Apply filters
  const filteredEvents = enrichedEvents.filter((event) => {
    if (selectedDriver !== "all" && event.driverId !== selectedDriver) return false;
    if (statusFilter === "resolved" && !event.isResolved) return false;
    if (statusFilter === "unresolved" && event.isResolved) return false;
    return true;
  });

  // Calculate statistics
  const stats = {
    totalEvents: filteredEvents.length,
    clockIns: filteredEvents.filter(e => e.type === "IN").length,
    clockOuts: filteredEvents.filter(e => e.type === "OUT").length,
    unresolvedEvents: filteredEvents.filter(e => !e.isResolved).length,
  };

  const handleEditClick = (event: EnrichedClockEvent) => {
    setEditingEvent(event);
    const date = new Date(event.timestamp);
    const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
    setEditedTimestamp(formatted);
  };

  const handleSaveEdit = () => {
    if (editingEvent && editedTimestamp) {
      editClockEventMutation.mutate({
        id: editingEvent.id,
        timestamp: editedTimestamp,
        notes: `Admin edit: corrected timestamp from ${new Date(editingEvent.timestamp).toLocaleString()} to ${new Date(editedTimestamp).toLocaleString()}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-1" data-testid="title-time-management">
          Time Management Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage all clock events across drivers
        </p>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger data-testid="select-driver">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={dateRange === "week" ? "default" : "outline"}
                  onClick={() => setDateRange("week")}
                  className="flex-1"
                  data-testid="button-range-week"
                >
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={dateRange === "month" ? "default" : "outline"}
                  onClick={() => setDateRange("month")}
                  className="flex-1"
                  data-testid="button-range-month"
                >
                  Month
                </Button>
                <Button
                  size="sm"
                  variant={dateRange === "all" ? "default" : "outline"}
                  onClick={() => setDateRange("all")}
                  className="flex-1"
                  data-testid="button-range-all"
                >
                  All
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-events">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-events">
              {stats.totalEvents}
            </div>
            <p className="text-xs text-muted-foreground">clock events</p>
          </CardContent>
        </Card>

        <Card data-testid="card-clock-ins">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clock Ins</CardTitle>
            <PlayCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-clock-ins">
              {stats.clockIns}
            </div>
            <p className="text-xs text-muted-foreground">entries</p>
          </CardContent>
        </Card>

        <Card data-testid="card-clock-outs">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clock Outs</CardTitle>
            <StopCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-clock-outs">
              {stats.clockOuts}
            </div>
            <p className="text-xs text-muted-foreground">entries</p>
          </CardContent>
        </Card>

        <Card data-testid="card-unresolved">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unresolved">
              {stats.unresolvedEvents}
            </div>
            <p className="text-xs text-muted-foreground">need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card data-testid="card-events-list">
        <CardHeader>
          <CardTitle>Clock Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-md hover-elevate group"
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex items-center gap-3">
                    {event.type === "IN" ? (
                      <PlayCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <StopCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.driverName}</span>
                        <Badge variant={event.type === "IN" ? "default" : "secondary"}>
                          {event.type}
                        </Badge>
                        {!event.isResolved && (
                          <Badge variant="destructive" className="text-xs">
                            Unresolved
                          </Badge>
                        )}
                        {event.source === "AUTO" && (
                          <Badge variant="outline" className="text-xs">
                            Auto
                          </Badge>
                        )}
                        {event.source === "ADMIN_EDIT" && (
                          <Badge variant="outline" className="text-xs">
                            Edited
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                        {event.shiftDate && event.shiftType && (
                          <span className="ml-2">
                            • {event.shiftDate} ({event.shiftType})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleEditClick(event)}
                    data-testid={`button-edit-${event.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-events">
                No clock events found for the selected filters
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Clock Event Dialog */}
      <Dialog open={editingEvent !== null} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent data-testid="dialog-edit-clock-event">
          <DialogHeader>
            <DialogTitle>Edit Clock Event</DialogTitle>
            <DialogDescription>
              Edit the timestamp for this {editingEvent?.type === "IN" ? "clock in" : "clock out"} event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Driver</Label>
              <Input value={editingEvent?.driverName || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timestamp">Timestamp</Label>
              <Input
                id="timestamp"
                type="datetime-local"
                value={editedTimestamp}
                onChange={(e) => setEditedTimestamp(e.target.value)}
                data-testid="input-timestamp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEvent(null)}
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editClockEventMutation.isPending}
              data-testid="button-save-edit"
            >
              <Check className="h-4 w-4 mr-2" />
              {editClockEventMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
