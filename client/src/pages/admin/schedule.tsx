// Admin monthly calendar schedule management with shift-based system
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, User, Clock } from "lucide-react";
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
  firstName: string;
  lastName: string;
  role: string;
}

interface RouteType {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

const formSchema = insertShiftSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  plannedStart: z.string().min(1, "Start time is required"),
  plannedEnd: z.string().min(1, "End time is required"),
});

type FormData = z.infer<typeof formSchema>;

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

const SHIFT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MORNING: { label: "Morning", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  AFTERNOON: { label: "Afternoon", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  EXTRA: { label: "Extra", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", color: "bg-muted" },
  ACTIVE: { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  COMPLETED: { label: "Completed", color: "bg-gray-500/10 text-gray-700 dark:text-gray-400" },
  MISSED: { label: "Missed", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export default function AdminSchedule() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Shift | null>(null);

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

  const { data: allShifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/admin/shifts", { date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01` }],
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

  const handleAddShift = (date: string) => {
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

  const onSubmit = (data: FormData) => {
    if (editingShift) {
      updateMutation.mutate({ ...data, id: editingShift.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const getShiftsForDate = (date: Date): Shift[] => {
    if (date.getTime() === 0) return [];
    const dateStr = date.toISOString().split('T')[0];
    const shifts = allShifts?.filter(s => s.date === dateStr) || [];
    return shifts.sort((a, b) => {
      const order = { MORNING: 0, AFTERNOON: 1, EXTRA: 2 };
      return order[a.shiftType] - order[b.shiftType];
    });
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : "Unknown";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="title-schedule">
            Shift Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage driver shifts by date - supports multiple shifts per day
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {MONTH_NAMES[currentMonth]} {currentYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {DAY_NAMES.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {daysInMonth.map((date, index) => {
              const isPlaceholder = date.getTime() === 0;
              const dateStr = isPlaceholder ? "" : date.toISOString().split('T')[0];
              const dayShifts = isPlaceholder ? [] : getShiftsForDate(date);
              const isToday = !isPlaceholder && dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={index}
                  className={`min-h-[140px] p-2 rounded-md border ${
                    isPlaceholder ? "bg-muted/20" : "bg-card hover-elevate"
                  } ${isToday ? "border-primary" : ""}`}
                  data-testid={isPlaceholder ? `placeholder-${index}` : `day-${dateStr}`}
                >
                  {!isPlaceholder && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                          {date.getDate()}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => handleAddShift(dateStr)}
                          data-testid={`button-add-${dateStr}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        {dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="text-xs p-2 rounded bg-accent/30 hover-elevate cursor-pointer"
                            onClick={() => handleEditShift(shift)}
                            data-testid={`shift-${shift.id}`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs px-1 py-0 ${SHIFT_TYPE_LABELS[shift.shiftType].color}`}
                              >
                                {SHIFT_TYPE_LABELS[shift.shiftType].label}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialog(shift);
                                }}
                                data-testid={`button-delete-${shift.id}`}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-1 mb-1">
                              <User className="h-3 w-3 flex-shrink-0" />
                              <span className="font-medium truncate text-xs">
                                {getDriverName(shift.driverId).split(' ')[0]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="text-xs">{shift.plannedStart}</span>
                            </div>
                          </div>
                        ))}
                        {dayShifts.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            No shifts
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
                            {driver.firstName} {driver.lastName}
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
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-route">
                          <SelectValue placeholder="Select a route" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
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
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle">
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
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
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        placeholder="Add any notes about this shift"
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
                  {editingShift ? "Update Shift" : "Create Shift"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteDialog && SHIFT_TYPE_LABELS[deleteDialog.shiftType].label.toLowerCase()} shift on {deleteDialog && new Date(deleteDialog.date + 'T00:00:00').toLocaleDateString()}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
