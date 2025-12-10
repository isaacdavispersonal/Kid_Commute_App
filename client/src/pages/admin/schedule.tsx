import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Trash2, User, Clock, Edit, Sun, Sunset, Star, CalendarPlus, Copy, Car } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertShiftSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Shift {
  id: string;
  driverId: string;
  routeId: string | null;
  vehicleId: string | null;
  date: string;
  shiftType: "MORNING" | "AFTERNOON" | "EXTRA";
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "MISSED";
  plannedStart: string;
  plannedEnd: string;
  notes: string | null;
}

interface Driver {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

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

interface RouteType {
  id: string;
  name: string;
  routeType?: "MORNING" | "AFTERNOON" | "EXTRA" | null;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

interface DriverAssignment {
  id: string;
  driverId: string;
  routeId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  driver: Driver;
  route: RouteType;
  vehicle: Vehicle;
}

interface SelectedAssignment {
  driverId: string;
  assignmentIds: string[]; // Empty array means "all assignments for this driver"
}

const formSchema = insertShiftSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  plannedStart: z.string().min(1, "Start time is required"),
  plannedEnd: z.string().min(1, "End time is required"),
});

type FormData = z.infer<typeof formSchema>;

const addFromAssignmentsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  assignments: z.array(z.string()).min(1, "Select at least one assignment"),
});

type AddFromAssignmentsData = z.infer<typeof addFromAssignmentsSchema>;

const bulkScheduleSchema = z.object({
  driverIds: z.array(z.string()).min(1, "Select at least one driver"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
  daysOfWeek: z.array(z.number()).min(1, "Select at least one day of the week"),
});

type BulkScheduleData = z.infer<typeof bulkScheduleSchema>;

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  
  const startDayOfWeek = firstDay.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(new Date(0));
  }
  
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }
  
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SHIFT_TYPE_LABELS: Record<string, { label: string; Icon: any; color: string }> = {
  MORNING: { label: "Morning", Icon: Sun, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  AFTERNOON: { label: "Afternoon", Icon: Sunset, color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  EXTRA: { label: "Extra", Icon: Star, color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", color: "bg-muted" },
  ACTIVE: { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  COMPLETED: { label: "Completed", color: "bg-gray-500/10 text-gray-700 dark:text-gray-400" },
  MISSED: { label: "Missed", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

interface ShiftTypeSummary {
  MORNING: number;
  AFTERNOON: number;
  EXTRA: number;
  total: number;
}

interface DriverShiftGroup {
  driverId: string;
  driverName: string;
  shifts: Shift[];
}

export default function AdminSchedule() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Shift | null>(null);
  const [viewDayDialog, setViewDayDialog] = useState<string | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedDriverIdsForBulkEdit, setSelectedDriverIdsForBulkEdit] = useState<string[]>([]);
  const [addFromAssignmentsOpen, setAddFromAssignmentsOpen] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [selectedDriversForAll, setSelectedDriversForAll] = useState<string[]>([]); // Track which drivers have "all" selected
  const [bulkPanelExpanded, setBulkPanelExpanded] = useState(false); // Collapsible bulk edit panel

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driverId: "",
      routeId: null,
      vehicleId: null,
      date: "",
      shiftType: "MORNING",
      plannedStart: "07:00",
      plannedEnd: "15:00",
      status: "SCHEDULED",
      notes: null,
    },
  });

  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;
  
  const { data: allShifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/admin/shifts", monthStart, monthEnd],
    queryFn: async () => {
      const url = `/api/admin/shifts?startDate=${monthStart}&endDate=${monthEnd}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
  });

  const { data: allUsers } = useQuery<Driver[]>({
    queryKey: ["/api/admin/users"],
  });

  const drivers = allUsers?.filter((user) => user.role === "driver") || [];

  const { data: routes } = useQuery<RouteType[]>({
    queryKey: ["/api/admin/routes"],
  });

  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/admin/vehicles"],
  });

  const { data: driverAssignments } = useQuery<DriverAssignment[]>({
    queryKey: ["/api/admin/driver-assignments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/admin/shifts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      handleCloseDialog();
      toast({
        title: "Success",
        description: "Shift created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shift",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData & { id: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PATCH", `/api/admin/shifts/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      handleCloseDialog();
      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update shift",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/shifts/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      setDeleteDialog(null);
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete shift",
        variant: "destructive",
      });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (data: { dates: string[]; driverIds: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/shifts/bulk-add", data);
      return await res.json();
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      setSelectedDates([]);
      setSelectedDriverIdsForBulkEdit([]);
      
      const count = response.count || 0;
      const skipped = response.skipped || [];
      
      if (count === 0 && skipped.length > 0) {
        toast({
          title: "No Shifts Created",
          description: `${skipped.length} driver${skipped.length > 1 ? 's have' : ' has'} no route assignments. Please assign routes first.`,
          variant: "destructive",
        });
      } else if (skipped.length > 0) {
        toast({
          title: "Partially Successful",
          description: `Added ${count} shifts. ${skipped.length} driver${skipped.length > 1 ? 's' : ''} skipped (no assignments).`,
        });
      } else {
        toast({
          title: "Success",
          description: `Created ${count} shift${count !== 1 ? 's' : ''} successfully`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add shifts",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (data: { dates: string[]; driverIds: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/shifts/bulk-delete", data);
      return await res.json();
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      setSelectedDates([]);
      setSelectedDriverIdsForBulkEdit([]);
      toast({
        title: "Success",
        description: `Removed ${response.count || 0} shift${response.count !== 1 ? 's' : ''} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove shifts",
        variant: "destructive",
      });
    },
  });

  const addFromAssignmentsMutation = useMutation({
    mutationFn: async (data: { date: string; assignmentIds: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/shifts/from-assignments", data);
      return await res.json();
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
      setAddFromAssignmentsOpen(false);
      setSelectedAssignments([]);
      setSelectedDriversForAll([]);
      setSelectedDate(null);
      toast({
        title: "Success",
        description: `Created ${response.count || 0} ${response.count === 1 ? 'shift' : 'shifts'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shifts from assignments",
        variant: "destructive",
      });
    },
  });

  const handleAddShift = (date: string) => {
    setSelectedDate(date);
    setSelectedAssignments([]);
    setSelectedDriversForAll([]);
    setAddFromAssignmentsOpen(true);
  };

  const handleOpenOldShiftDialog = (date: string) => {
    setSelectedDate(date);
    setEditingShift(null);
    form.reset({
      driverId: "",
      routeId: null,
      vehicleId: null,
      date,
      shiftType: "MORNING",
      plannedStart: "07:00",
      plannedEnd: "15:00",
      status: "SCHEDULED",
      notes: null,
    });
    setDialogOpen(true);
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setSelectedDate(shift.date);
    form.reset({
      driverId: shift.driverId,
      routeId: shift.routeId,
      vehicleId: shift.vehicleId,
      date: shift.date,
      shiftType: shift.shiftType,
      plannedStart: shift.plannedStart,
      plannedEnd: shift.plannedEnd,
      status: shift.status,
      notes: shift.notes,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingShift(null);
    setSelectedDate(null);
    form.reset();
  };

  const handleToggleDriverAll = (driverId: string) => {
    const driverAssignments2 = (driverAssignments || []).filter(a => a.driverId === driverId);
    const driverAssignmentIds = driverAssignments2.map(a => a.id);
    
    if (selectedDriversForAll.includes(driverId)) {
      // Remove all this driver's assignments
      setSelectedDriversForAll(prev => prev.filter(id => id !== driverId));
      setSelectedAssignments(prev => prev.filter(id => !driverAssignmentIds.includes(id)));
    } else {
      // Add all this driver's assignments
      setSelectedDriversForAll(prev => [...prev, driverId]);
      setSelectedAssignments(prev => {
        const newSelections = [...prev];
        driverAssignmentIds.forEach(id => {
          if (!newSelections.includes(id)) {
            newSelections.push(id);
          }
        });
        return newSelections;
      });
    }
  };

  const handleToggleAssignment = (assignmentId: string, driverId: string) => {
    const driverAssignments2 = (driverAssignments || []).filter(a => a.driverId === driverId);
    const driverAssignmentIds = driverAssignments2.map(a => a.id);
    
    if (selectedAssignments.includes(assignmentId)) {
      // Remove this assignment
      setSelectedAssignments(prev => prev.filter(id => id !== assignmentId));
      // If this was the last one for this driver, uncheck "all"
      const remainingForDriver = selectedAssignments.filter(id => 
        id !== assignmentId && driverAssignmentIds.includes(id)
      );
      if (remainingForDriver.length < driverAssignmentIds.length - 1) {
        setSelectedDriversForAll(prev => prev.filter(id => id !== driverId));
      }
    } else {
      // Add this assignment
      setSelectedAssignments(prev => [...prev, assignmentId]);
      // Check if all are now selected for this driver
      const allSelected = driverAssignmentIds.every(id => 
        id === assignmentId || selectedAssignments.includes(id)
      );
      if (allSelected) {
        setSelectedDriversForAll(prev => [...prev, driverId]);
      }
    }
  };

  const handleSubmitFromAssignments = () => {
    if (!selectedDate || selectedAssignments.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one assignment",
        variant: "destructive",
      });
      return;
    }
    
    addFromAssignmentsMutation.mutate({
      date: selectedDate,
      assignmentIds: selectedAssignments,
    });
  };

  // Group assignments by driver
  const assignmentsByDriver = (driverAssignments || []).reduce((acc, assignment) => {
    if (!acc[assignment.driverId]) {
      acc[assignment.driverId] = [];
    }
    acc[assignment.driverId].push(assignment);
    return acc;
  }, {} as Record<string, DriverAssignment[]>);

  const onSubmit = (data: FormData) => {
    if (editingShift) {
      updateMutation.mutate({ ...data, id: editingShift.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleBulkEditMode = () => {
    setBulkEditMode(!bulkEditMode);
    setSelectedDates([]);
    setSelectedDriverIdsForBulkEdit([]);
  };

  const toggleDateSelection = (dateStr: string) => {
    setSelectedDates(prev =>
      prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr].sort()
    );
  };

  const toggleDriverForBulkEdit = (driverId: string) => {
    setSelectedDriverIdsForBulkEdit(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const handleBulkAdd = () => {
    if (selectedDates.length === 0 || selectedDriverIdsForBulkEdit.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one date and one driver",
        variant: "destructive",
      });
      return;
    }
    bulkAddMutation.mutate({
      dates: selectedDates,
      driverIds: selectedDriverIdsForBulkEdit,
    });
  };

  const handleBulkDelete = () => {
    if (selectedDates.length === 0 || selectedDriverIdsForBulkEdit.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one date and one driver",
        variant: "destructive",
      });
      return;
    }
    bulkDeleteMutation.mutate({
      dates: selectedDates,
      driverIds: selectedDriverIdsForBulkEdit,
    });
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const getShiftSummaryForDate = (date: Date): ShiftTypeSummary => {
    if (date.getTime() === 0) return { MORNING: 0, AFTERNOON: 0, EXTRA: 0, total: 0 };
    const dateStr = date.toISOString().split('T')[0];
    const dayShifts = allShifts?.filter(s => s.date === dateStr) || [];
    
    return {
      MORNING: dayShifts.filter(s => s.shiftType === "MORNING").length,
      AFTERNOON: dayShifts.filter(s => s.shiftType === "AFTERNOON").length,
      EXTRA: dayShifts.filter(s => s.shiftType === "EXTRA").length,
      total: dayShifts.length,
    };
  };

  const getDriverShiftsForDate = (date: string): DriverShiftGroup[] => {
    const dayShifts = allShifts?.filter(s => s.date === date) || [];
    
    const groupedByDriver = dayShifts.reduce((acc, shift) => {
      if (!acc[shift.driverId]) {
        acc[shift.driverId] = [];
      }
      acc[shift.driverId].push(shift);
      return acc;
    }, {} as Record<string, Shift[]>);

    return Object.entries(groupedByDriver).map(([driverId, shifts]) => {
      const driver = drivers.find(d => d.id === driverId);
      return {
        driverId,
        driverName: getDriverDisplayName(driver),
        shifts: shifts.sort((a, b) => {
          const order = { MORNING: 0, AFTERNOON: 1, EXTRA: 2 };
          return order[a.shiftType] - order[b.shiftType];
        }),
      };
    }).sort((a, b) => a.driverName.localeCompare(b.driverName));
  };

  const getShiftsByTypeForDate = (date: string, shiftType: "MORNING" | "AFTERNOON" | "EXTRA"): DriverShiftGroup[] => {
    const allDriverShifts = getDriverShiftsForDate(date);
    return allDriverShifts
      .map(group => ({
        ...group,
        shifts: group.shifts.filter(s => s.shiftType === shiftType),
      }))
      .filter(group => group.shifts.length > 0);
  };

  const getRouteName = (routeId: string | null) => {
    if (!routeId) return "No route";
    const route = routes?.find(r => r.id === routeId);
    return route?.name || "Unknown route";
  };

  const getVehicleName = (vehicleId: string | null) => {
    if (!vehicleId) return "No vehicle";
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : "Unknown vehicle";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1" data-testid="title-schedule">
            Shift Schedule
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage driver shifts - tap any day to view details
          </p>
        </div>
        <Button
          onClick={toggleBulkEditMode}
          variant={bulkEditMode ? "default" : "outline"}
          className="gap-2 self-start sm:self-auto"
          data-testid="button-bulk-edit"
        >
          <Edit className="h-4 w-4" />
          <span className="text-xs sm:text-sm">{bulkEditMode ? "Exit Bulk" : "Bulk Edit"}</span>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-xl flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{MONTH_NAMES[currentMonth]} {currentYear}</span>
              <span className="sm:hidden">{MONTH_NAMES[currentMonth].slice(0, 3)} {currentYear}</span>
            </CardTitle>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Mobile legend for shift type colors */}
          <div className="flex items-center justify-center gap-3 mt-2 sm:hidden">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] text-muted-foreground">AM</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-[10px] text-muted-foreground">PM</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-[10px] text-muted-foreground">Extra</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-2 sm:p-6">
          <div className="min-w-[320px] sm:min-w-[700px]">
            {/* Day names header - abbreviated on mobile */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 sm:mb-2">
              {DAY_NAMES.map((day, i) => (
                <div key={day} className="text-center text-[10px] sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {daysInMonth.map((date, index) => {
                const isPlaceholder = date.getTime() === 0;
                const dateStr = isPlaceholder ? "" : date.toISOString().split('T')[0];
                const summary = isPlaceholder ? null : getShiftSummaryForDate(date);
                const isToday = !isPlaceholder && dateStr === new Date().toISOString().split('T')[0];
                const isSelected = !isPlaceholder && selectedDates.includes(dateStr);

                return (
                  <div
                    key={index}
                    className={`min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 rounded-md border transition-all ${
                      isPlaceholder ? "bg-muted/20" : "bg-card"
                    } ${isToday ? "border-primary" : ""} ${
                      bulkEditMode && !isPlaceholder ? "cursor-pointer hover-elevate" : ""
                    } ${
                      isSelected ? "border-primary border-2 bg-primary/10" : ""
                    }`}
                    onClick={() => bulkEditMode && !isPlaceholder && toggleDateSelection(dateStr)}
                    data-testid={isPlaceholder ? `placeholder-${index}` : `day-${dateStr}`}
                  >
                    {!isPlaceholder && summary && (
                      <>
                        <div className="flex items-center justify-between mb-1 sm:mb-2">
                          <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                            {date.getDate()}
                          </span>
                          {!bulkEditMode && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                              onClick={() => handleAddShift(dateStr)}
                              data-testid={`button-add-${dateStr}`}
                            >
                              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                          )}
                          {bulkEditMode && isSelected && (
                            <Checkbox checked={true} className="pointer-events-none h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </div>

                        {summary.total > 0 ? (
                          <div
                            className={`space-y-0.5 sm:space-y-1.5 p-1 sm:p-2 rounded-md bg-accent/30 ${!bulkEditMode ? "cursor-pointer hover-elevate" : ""}`}
                            onClick={(e) => {
                              if (!bulkEditMode) {
                                e.stopPropagation();
                                setViewDayDialog(dateStr);
                              }
                            }}
                            data-testid={`summary-${dateStr}`}
                          >
                            {/* Mobile: Compact summary with color coding */}
                            <div className="sm:hidden">
                              <div className="flex items-center justify-center gap-0.5">
                                {summary.MORNING > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-blue-500" title="Morning" />
                                )}
                                {summary.AFTERNOON > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-orange-500" title="Afternoon" />
                                )}
                                {summary.EXTRA > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-purple-500" title="Extra" />
                                )}
                              </div>
                              <div className="text-[10px] font-medium text-center mt-0.5">{summary.total}</div>
                            </div>
                            
                            {/* Desktop: Detailed breakdown */}
                            <div className="hidden sm:block">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {summary.total} {summary.total === 1 ? 'shift' : 'shifts'}
                              </div>
                              
                              {summary.MORNING > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <SHIFT_TYPE_LABELS.MORNING.Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                  <span className="text-muted-foreground">Morning:</span>
                                  <span className="font-medium">{summary.MORNING}</span>
                                </div>
                              )}
                              
                              {summary.AFTERNOON > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <SHIFT_TYPE_LABELS.AFTERNOON.Icon className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                                  <span className="text-muted-foreground">Afternoon:</span>
                                  <span className="font-medium">{summary.AFTERNOON}</span>
                                </div>
                              )}
                              
                              {summary.EXTRA > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <SHIFT_TYPE_LABELS.EXTRA.Icon className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                  <span className="text-muted-foreground">Extra:</span>
                                  <span className="font-medium">{summary.EXTRA}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] sm:text-xs text-muted-foreground text-center py-1 sm:py-4">
                            <span className="hidden sm:inline">No shifts</span>
                            <span className="sm:hidden">-</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Details Dialog - Mobile optimized */}
      <Dialog open={!!viewDayDialog} onOpenChange={(open) => !open && setViewDayDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] w-[calc(100vw-32px)] sm:w-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg">
              {viewDayDialog && new Date(viewDayDialog + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {viewDayDialog && (
                <>
                  {(['MORNING', 'AFTERNOON', 'EXTRA'] as const).map((shiftType) => {
                    const driverGroups = getShiftsByTypeForDate(viewDayDialog, shiftType);
                    
                    if (driverGroups.length === 0) return null;
                    
                    const ShiftIcon = SHIFT_TYPE_LABELS[shiftType].Icon;
                    
                    return (
                      <div key={shiftType} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <ShiftIcon className="h-5 w-5" />
                          <h3 className="font-semibold">{SHIFT_TYPE_LABELS[shiftType].label} Shifts</h3>
                          <Badge variant="secondary" className="ml-auto">
                            {driverGroups.length} {driverGroups.length === 1 ? 'driver' : 'drivers'}
                          </Badge>
                        </div>
                        
                        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
                          {driverGroups.map((group) => (
                            <div
                              key={group.driverId}
                              className="p-3 rounded-md border bg-card space-y-3"
                            >
                              {/* Driver Header */}
                              <div className="flex items-center gap-2 pb-2 border-b">
                                <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span className="font-medium text-sm flex-1">{group.driverName}</span>
                                {group.shifts.length > 1 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {group.shifts.length} shifts
                                  </Badge>
                                )}
                              </div>
                              
                              {/* All shifts for this driver */}
                              <div className="space-y-2">
                                {group.shifts.map((shift) => (
                                  <div 
                                    key={shift.id}
                                    className="text-xs space-y-1.5 p-2 rounded bg-accent/30"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-foreground font-medium">{shift.plannedStart} - {shift.plannedEnd}</span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={() => handleEditShift(shift)}
                                          data-testid={`button-edit-${shift.id}`}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                          onClick={() => setDeleteDialog(shift)}
                                          data-testid={`button-delete-${shift.id}`}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    <div className="text-muted-foreground">
                                      Route: <span className="text-foreground">{getRouteName(shift.routeId)}</span>
                                    </div>
                                    
                                    <div className="text-muted-foreground">
                                      Vehicle: <span className="text-foreground">{getVehicleName(shift.vehicleId)}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      Status:
                                      <Badge 
                                        variant="secondary"
                                        className={`text-[10px] ${STATUS_LABELS[shift.status].color}`}
                                      >
                                        {STATUS_LABELS[shift.status].label}
                                      </Badge>
                                    </div>
                                    
                                    {shift.notes && (
                                      <div className="pt-1.5 border-t text-muted-foreground">
                                        Notes: <span className="text-foreground italic">{shift.notes}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add from Assignments Dialog - Mobile optimized */}
      <Dialog open={addFromAssignmentsOpen} onOpenChange={setAddFromAssignmentsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] w-[calc(100vw-32px)] sm:w-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg">
              <span className="hidden sm:inline">Add Shifts from Driver Assignments</span>
              <span className="sm:hidden">Add from Assignments</span>
              {selectedDate && (
                <span className="block text-sm font-normal text-muted-foreground mt-1">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {Object.keys(assignmentsByDriver).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No driver assignments found.</p>
                  <p className="text-sm mt-2">Please create driver assignments first in the Driver Assignments section.</p>
                </div>
              ) : (
                Object.entries(assignmentsByDriver).map(([driverId, assignments]) => {
                  const driver = assignments[0].driver;
                  const allSelected = selectedDriversForAll.includes(driverId);
                  
                  return (
                    <Card key={driverId}>
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => handleToggleDriverAll(driverId)}
                            data-testid={`checkbox-driver-all-${driverId}`}
                          />
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">{getDriverDisplayName(driver)}</CardTitle>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {assignments.length} {assignments.length === 1 ? 'route' : 'routes'}
                            </p>
                          </div>
                          {allSelected && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">All</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        {assignments.map((assignment) => {
                          const isSelected = selectedAssignments.includes(assignment.id);
                          const routeTypeBadge = assignment.route?.routeType
                            ? SHIFT_TYPE_LABELS[assignment.route.routeType as "MORNING" | "AFTERNOON" | "EXTRA"]
                            : null;
                          
                          return (
                            <div
                              key={assignment.id}
                              className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md border ${
                                isSelected ? 'bg-accent border-primary' : 'bg-card'
                              } hover-elevate cursor-pointer`}
                              onClick={() => handleToggleAssignment(assignment.id, driverId)}
                              data-testid={`assignment-${assignment.id}`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleAssignment(assignment.id, driverId)}
                                data-testid={`checkbox-assignment-${assignment.id}`}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-sm truncate">{assignment.route?.name || "Unknown Route"}</span>
                                  {routeTypeBadge && (
                                    <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                                      <routeTypeBadge.Icon className="h-3 w-3 mr-0.5" />
                                      <span className="hidden sm:inline">{routeTypeBadge.label}</span>
                                      <span className="sm:hidden">{routeTypeBadge.label.slice(0, 2)}</span>
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    {assignment.startTime} - {assignment.endTime}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Car className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="truncate max-w-[100px]">{assignment.vehicle?.name || "No Vehicle"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              {selectedAssignments.length} selected
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddFromAssignmentsOpen(false)}
                data-testid="button-cancel-assignments"
                className="flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitFromAssignments}
                disabled={selectedAssignments.length === 0 || addFromAssignmentsMutation.isPending}
                data-testid="button-add-assignments"
                className="flex-1 sm:flex-initial"
              >
                {addFromAssignmentsMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Shift Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title">
              {editingShift ? "Edit Shift" : "New Shift"}
              {selectedDate && ` - ${new Date(selectedDate + 'T00:00:00').toLocaleDateString()}`}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-driver">
                          <SelectValue placeholder="Select a driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers?.map((driver) => (
                          <SelectItem 
                            key={driver.id} 
                            value={driver.id}
                            data-testid={`option-driver-${driver.id}`}
                          >
                            {getDriverDisplayName(driver)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shiftType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-shift-type">
                          <SelectValue placeholder="Select shift type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MORNING">Morning</SelectItem>
                        <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                        <SelectItem value="EXTRA">Extra</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value || null)} 
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-route">
                          <SelectValue placeholder="Select a route (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {routes?.map((route) => (
                          <SelectItem 
                            key={route.id} 
                            value={route.id}
                            data-testid={`option-route-${route.id}`}
                          >
                            {route.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value || null)} 
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle">
                          <SelectValue placeholder="Select a vehicle (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem 
                            key={vehicle.id} 
                            value={vehicle.id}
                            data-testid={`option-vehicle-${vehicle.id}`}
                          >
                            {vehicle.name} - {vehicle.plateNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plannedStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          data-testid="input-start-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          data-testid="input-end-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="MISSED">Missed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Add any additional notes..."
                        className="resize-none"
                        rows={3}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? "Saving..."
                    : editingShift
                    ? "Update Shift"
                    : "Create Shift"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shift? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Floating Action Panel - Mobile responsive & collapsible */}
      {bulkEditMode && selectedDates.length > 0 && (
        <div className="fixed bottom-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 pb-[env(safe-area-inset-bottom)]">
          <Card className="w-full sm:w-[500px] shadow-lg border-2">
            <CardContent className="p-3 sm:p-4 space-y-0">
              {/* Collapsed Header - Always visible, tap to expand on mobile only */}
              <div 
                className="flex items-center justify-between gap-2 cursor-pointer sm:cursor-default"
                onClick={() => {
                  if (window.innerWidth < 640) {
                    setBulkPanelExpanded(!bulkPanelExpanded);
                  }
                }}
                data-testid="bulk-panel-header"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">Bulk Edit</h3>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'}
                  </Badge>
                  {selectedDriverIdsForBulkEdit.length > 0 && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {selectedDriverIdsForBulkEdit.length} driver{selectedDriverIdsForBulkEdit.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 sm:hidden flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBulkPanelExpanded(!bulkPanelExpanded);
                  }}
                  data-testid="button-toggle-bulk-panel"
                >
                  {bulkPanelExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>

              {/* Expandable Content - Always visible on desktop, collapsible on mobile */}
              <div className={`space-y-3 overflow-hidden transition-all duration-200 sm:!max-h-[400px] sm:!opacity-100 sm:!mt-3 ${
                bulkPanelExpanded ? 'max-h-[400px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
              }`}>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Select Drivers</Label>
                  <ScrollArea className="h-24 sm:h-32 border rounded-md p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                      {drivers.map((driver) => {
                        const hasAssignments = (driverAssignments || []).some(a => a.driverId === driver.id);
                        return (
                          <div key={driver.id} className="flex items-center space-x-2 py-0.5">
                            <Checkbox
                              id={`bulk-driver-${driver.id}`}
                              checked={selectedDriverIdsForBulkEdit.includes(driver.id)}
                              onCheckedChange={() => toggleDriverForBulkEdit(driver.id)}
                              data-testid={`checkbox-bulk-driver-${driver.id}`}
                            />
                            <label
                              htmlFor={`bulk-driver-${driver.id}`}
                              className={`text-xs sm:text-sm cursor-pointer truncate flex items-center gap-1 ${!hasAssignments ? 'text-muted-foreground' : ''}`}
                            >
                              {getDriverDisplayName(driver)}
                              {!hasAssignments && (
                                <span className="text-[10px] text-destructive">(no routes)</span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Shifts are created from existing route assignments
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleBulkAdd}
                    disabled={selectedDriverIdsForBulkEdit.length === 0 || bulkAddMutation.isPending}
                    className="flex-1 h-10"
                    data-testid="button-bulk-add"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    <span className="text-xs sm:text-sm">Add Shifts</span>
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={selectedDriverIdsForBulkEdit.length === 0 || bulkDeleteMutation.isPending}
                    variant="destructive"
                    className="flex-1 h-10"
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    <span className="text-xs sm:text-sm">Remove Shifts</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
