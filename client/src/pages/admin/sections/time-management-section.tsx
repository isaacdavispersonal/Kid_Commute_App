// Admin comprehensive time management dashboard with tabbed interface
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Clock, 
  Calendar, 
  PlayCircle, 
  StopCircle, 
  Edit, 
  Filter,
  X,
  Check,
  User,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Wrench
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, subDays } from "date-fns";

interface ClockEvent {
  id: string;
  driverId: string;
  shiftId: string | null;
  type: "IN" | "OUT";
  timestamp: string;
  source: "USER" | "AUTO" | "ADMIN_EDIT" | "AUTO_CLOCKOUT";
  notes: string | null;
  isResolved?: boolean;
  resolved?: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolvedNotes?: string | null;
}

interface EnrichedClockEvent extends ClockEvent {
  driverName: string;
  shiftDate: string | null;
  shiftType: string | null;
}

interface Driver {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

// Helper function to safely display driver names
function getDriverDisplayName(driver: Driver | undefined): string {
  if (!driver) return "Unknown Driver";
  
  const firstName = driver.firstName?.trim();
  const lastName = driver.lastName?.trim();
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else {
    return driver.email || "Unknown Driver";
  }
}

export default function TimeManagementSection() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Overview tab state
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("week");
  const [editingEvent, setEditingEvent] = useState<EnrichedClockEvent | null>(null);
  const [editedTimestamp, setEditedTimestamp] = useState<string>("");
  const [collapsedDrivers, setCollapsedDrivers] = useState<Set<string>>(new Set());
  
  // Exceptions tab state
  const [selectedEvent, setSelectedEvent] = useState<EnrichedClockEvent | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

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

  // Fetch all clock events for overview
  const { data: clockEvents, isLoading: isLoadingAll } = useQuery<ClockEvent[]>({
    queryKey: ["/api/admin/all-clock-events", range.startDate, range.endDate],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
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

  // Fetch unresolved events for exceptions tab
  const { data: unresolvedEvents, isLoading: isLoadingUnresolved } = useQuery<ClockEvent[]>({
    queryKey: ["/api/admin/clock-events/unresolved"],
    refetchInterval: 30000,
  });

  // Fetch shifts for enrichment
  const { data: shifts } = useQuery<any[]>({
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
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/clock-events/unresolved"] });
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

  // Resolve event mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/admin/clock-events/${id}/resolve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clock-events/unresolved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-clock-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timecard-anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-drivers"] });
      setSelectedEvent(null);
      setResolveNotes("");
      toast({
        title: "Event Resolved",
        description: "Clock event has been marked as resolved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve clock event",
        variant: "destructive",
      });
    },
  });

  // Auto-clockout mutation
  const autoClockoutMutation = useMutation({
    mutationFn: async (graceHours?: number) => {
      return await apiRequest("POST", "/api/admin/auto-clockout", { graceHours });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clock-events/unresolved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-clock-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timecard-anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-drivers"] });
      toast({
        title: "Auto-Clockout Complete",
        description: data.message || `Processed ${data.processed} orphaned shift(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run auto-clockout",
        variant: "destructive",
      });
    },
  });

  // Fix stuck shifts mutation
  const fixStuckShiftsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/maintenance/fix-stuck-shifts", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver"] });
      toast({
        title: "Stuck Shifts Fixed",
        description: data.message || `Fixed ${data.fixedCount} stuck shift(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fix stuck shifts",
        variant: "destructive",
      });
    },
  });

  // Enrich events with driver and shift information
  // Backend now provides driverName, shiftDate, shiftType - use them if available
  const enrichEvents = (events: (ClockEvent & { driverName?: string; shiftDate?: string | null; shiftType?: string | null })[]): EnrichedClockEvent[] => {
    return (events || []).map((event) => {
      // Use backend-provided enrichment if available, otherwise fallback to local lookup
      if (event.driverName) {
        return {
          ...event,
          driverName: event.driverName,
          shiftDate: event.shiftDate ?? null,
          shiftType: event.shiftType ?? null,
        };
      }
      
      // Fallback to local driver lookup
      const driver = drivers?.find((d) => d.id === event.driverId);
      const shift = shifts?.find((s: any) => s.id === event.shiftId);
      
      return {
        ...event,
        driverName: getDriverDisplayName(driver),
        shiftDate: shift?.date || null,
        shiftType: shift?.shiftType || null,
      };
    });
  };

  const enrichedAllEvents = enrichEvents(clockEvents || []);
  const enrichedUnresolvedEvents = enrichEvents(unresolvedEvents || []);

  // Apply filters to overview tab
  const filteredEvents = enrichedAllEvents.filter((event) => {
    if (selectedDriver !== "all" && event.driverId !== selectedDriver) return false;
    const isResolved = event.isResolved ?? event.resolved ?? false;
    if (statusFilter === "resolved" && !isResolved) return false;
    if (statusFilter === "unresolved" && isResolved) return false;
    return true;
  });

  // Calculate statistics
  const stats = {
    totalEvents: filteredEvents.length,
    clockIns: filteredEvents.filter(e => e.type === "IN").length,
    clockOuts: filteredEvents.filter(e => e.type === "OUT").length,
    unresolvedEvents: enrichedUnresolvedEvents.length,
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

  const handleResolve = (event: EnrichedClockEvent) => {
    setSelectedEvent(event);
    setResolveNotes("");
  };

  const submitResolve = () => {
    if (selectedEvent) {
      resolveMutation.mutate({
        id: selectedEvent.id,
        notes: resolveNotes,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-1" data-testid="title-time-management">
          Time Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage clock events, review exceptions, and track driver hours
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-time-management">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="exceptions" data-testid="tab-exceptions">
            <AlertCircle className="h-4 w-4 mr-2" />
            Exceptions
            {stats.unresolvedEvents > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unresolvedEvents}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
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
                          {getDriverDisplayName(driver)}
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

          {/* Events List - Grouped by Driver */}
          <Card data-testid="card-events-list">
            <CardHeader>
              <CardTitle>Clock Events by Driver</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAll ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredEvents.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    // Group events by driver
                    const groupedByDriver = filteredEvents.reduce((acc, event) => {
                      const driverId = event.driverId;
                      if (!acc[driverId]) {
                        acc[driverId] = {
                          driverName: event.driverName,
                          events: [],
                        };
                      }
                      acc[driverId].events.push(event);
                      return acc;
                    }, {} as Record<string, { driverName: string; events: EnrichedClockEvent[] }>);

                    return Object.entries(groupedByDriver).map(([driverId, group]) => {
                      const isOpen = !collapsedDrivers.has(driverId);
                      const toggleOpen = () => {
                        setCollapsedDrivers(prev => {
                          const next = new Set(prev);
                          if (next.has(driverId)) {
                            next.delete(driverId);
                          } else {
                            next.add(driverId);
                          }
                          return next;
                        });
                      };
                      const unresolvedCount = group.events.filter(
                        e => !(e.isResolved ?? e.resolved ?? false)
                      ).length;
                      
                      return (
                        <Collapsible 
                          key={driverId} 
                          open={isOpen} 
                          onOpenChange={toggleOpen}
                          className="border rounded-md"
                        >
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover-elevate" data-testid={`driver-group-${driverId}`}>
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <div className="text-left">
                                <div className="font-semibold">{group.driverName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
                                  {unresolvedCount > 0 && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      {unresolvedCount} unresolved
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-2 border-t pt-2">
                              {group.events.map((event) => {
                                const isResolved = event.isResolved ?? event.resolved ?? false;
                                return (
                                  <div
                                    key={event.id}
                                    className="flex items-center justify-between p-2 bg-muted/30 rounded hover-elevate group text-sm"
                                    data-testid={`event-${event.id}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {event.type === "IN" ? (
                                        <PlayCircle className="h-3.5 w-3.5 text-green-600" />
                                      ) : (
                                        <StopCircle className="h-3.5 w-3.5 text-red-600" />
                                      )}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={event.type === "IN" ? "default" : "secondary"} className="text-[10px]">
                                            {event.type}
                                          </Badge>
                                          {!isResolved && (
                                            <Badge variant="destructive" className="text-[10px]">
                                              Unresolved
                                            </Badge>
                                          )}
                                          {event.source === "AUTO" && (
                                            <Badge variant="outline" className="text-[10px]">
                                              Auto
                                            </Badge>
                                          )}
                                          {event.source === "AUTO_CLOCKOUT" && (
                                            <Badge variant="destructive" className="text-[10px]">
                                              Max Duration
                                            </Badge>
                                          )}
                                          {event.source === "ADMIN_EDIT" && (
                                            <Badge variant="outline" className="text-[10px]">
                                              Edited
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
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
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleEditClick(event)}
                                      data-testid={`button-edit-${event.id}`}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    });
                  })()}
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
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Exceptions Queue</h2>
              <p className="text-sm text-muted-foreground">
                Review and resolve unresolved clock events
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fixStuckShiftsMutation.mutate()}
                disabled={fixStuckShiftsMutation.isPending}
                data-testid="button-fix-stuck-shifts"
              >
                {fixStuckShiftsMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Fix Stuck Shifts
                  </>
                )}
              </Button>
              <Button
                onClick={() => autoClockoutMutation.mutate(2)}
                disabled={autoClockoutMutation.isPending}
                data-testid="button-auto-clockout"
              >
                {autoClockoutMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Run Auto-Clockout
                  </>
                )}
              </Button>
            </div>
          </div>

          {isLoadingUnresolved ? (
            <div className="space-y-6">
              <Skeleton className="h-48" />
            </div>
          ) : enrichedUnresolvedEvents.length === 0 ? (
            <Card data-testid="card-no-exceptions">
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">All Clear!</h3>
                <p className="text-sm text-muted-foreground">
                  There are no unresolved clock events at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Alert variant="destructive" data-testid="alert-unresolved-count">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{enrichedUnresolvedEvents.length} Unresolved Event(s)</AlertTitle>
                <AlertDescription>
                  These clock events require admin attention. Review each one and mark as resolved after addressing.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {enrichedUnresolvedEvents.map((event) => (
                  <Card key={event.id} data-testid={`event-card-${event.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          {event.type === "IN" ? (
                            <PlayCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <StopCircle className="h-5 w-5 text-red-600" />
                          )}
                          <CardTitle className="text-base">
                            Clock {event.type === "IN" ? "In" : "Out"} Event
                          </CardTitle>
                          <Badge 
                            variant={event.source === "AUTO_CLOCKOUT" ? "destructive" : "secondary"}
                            className={
                              event.source === "AUTO" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
                              event.source === "ADMIN_EDIT" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                              event.source === "AUTO_CLOCKOUT" ? "" :
                              ""
                            }
                            data-testid={`badge-source-${event.id}`}
                          >
                            {event.source === "AUTO_CLOCKOUT" ? "Max Duration" : event.source}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleResolve(event)}
                          data-testid={`button-resolve-${event.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Driver</p>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="font-medium" data-testid={`text-driver-${event.id}`}>
                              {event.driverName}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Time</p>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span data-testid={`text-time-${event.id}`}>
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Shift Date</p>
                          {event.shiftDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span data-testid={`text-shift-date-${event.id}`}>
                                {new Date(event.shiftDate + 'T00:00:00').toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No shift linked</span>
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Shift Type</p>
                          {event.shiftType ? (
                            <Badge variant="outline" data-testid={`badge-shift-type-${event.id}`}>
                              {event.shiftType}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                      {event.notes && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm bg-muted p-2 rounded" data-testid={`text-notes-${event.id}`}>
                            {event.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

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

      {/* Resolve Event Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Clock Event</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Driver:</span> {selectedEvent.driverName}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Event:</span> Clock {selectedEvent.type}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Time:</span> {new Date(selectedEvent.timestamp).toLocaleString()}
                </p>
                {selectedEvent.notes && (
                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground mb-1">Event Notes:</p>
                    <p className="text-sm">{selectedEvent.notes}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolve-notes">Resolution Notes (Optional)</Label>
                <Textarea
                  id="resolve-notes"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Add notes about how this issue was resolved..."
                  rows={4}
                  data-testid="input-resolve-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedEvent(null)}
              data-testid="button-cancel-resolve"
            >
              Cancel
            </Button>
            <Button
              onClick={submitResolve}
              disabled={resolveMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
