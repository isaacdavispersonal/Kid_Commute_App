// Admin schedule management page with interactive weekly calendar
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Plus, Edit, Trash2, User, Route as RouteIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertDriverAssignmentSchema } from "@shared/schema";
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

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

interface EnrichedAssignment {
  id: string;
  driverId: string;
  routeId: string;
  vehicleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  driverName: string;
  driverEmail: string;
  routeName: string;
  vehicleName: string;
  vehiclePlate: string;
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

const formSchema = insertDriverAssignmentSchema.extend({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
});

type FormData = z.infer<typeof formSchema>;

export default function AdminSchedule() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<EnrichedAssignment | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<EnrichedAssignment | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driverId: "",
      routeId: "",
      vehicleId: "",
      dayOfWeek: 1,
      startTime: "07:00",
      endTime: "15:00",
      isActive: true,
    },
  });

  const { data: schedules, isLoading } = useQuery<EnrichedAssignment[]>({
    queryKey: ["/api/admin/schedules"],
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
      return await apiRequest("POST", "/api/admin/driver-assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-assignments"] });
      handleCloseDialog();
      toast({
        title: "Success",
        description: "Driver assignment created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create driver assignment",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData & { id: string }) => {
      return await apiRequest("PATCH", `/api/admin/driver-assignments/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-assignments"] });
      handleCloseDialog();
      toast({
        title: "Success",
        description: "Driver assignment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update driver assignment",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/driver-assignments/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-assignments"] });
      setDeleteDialog(null);
      toast({
        title: "Success",
        description: "Driver assignment deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete driver assignment",
        variant: "destructive",
      });
    },
  });

  const handleAddAssignment = (dayOfWeek: number) => {
    setSelectedDay(dayOfWeek);
    setEditingAssignment(null);
    form.reset({
      driverId: "",
      routeId: "",
      vehicleId: "",
      dayOfWeek,
      startTime: "07:00",
      endTime: "15:00",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEditAssignment = (assignment: EnrichedAssignment) => {
    setEditingAssignment(assignment);
    setSelectedDay(assignment.dayOfWeek);
    form.reset({
      driverId: assignment.driverId,
      routeId: assignment.routeId,
      vehicleId: assignment.vehicleId,
      dayOfWeek: assignment.dayOfWeek,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      isActive: assignment.isActive,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssignment(null);
    setSelectedDay(null);
    form.reset();
  };

  const onSubmit = (data: FormData) => {
    if (editingAssignment) {
      updateMutation.mutate({ ...data, id: editingAssignment.id });
    } else {
      createMutation.mutate(data);
    }
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
            Weekly Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage driver assignments by day
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {DAYS_OF_WEEK.map((day) => {
          const daySchedules = schedules?.filter(
            (s) => s.dayOfWeek === day.value
          ) || [];

          return (
            <Card key={day.value} data-testid={`day-card-${day.value}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    {day.label}
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => handleAddAssignment(day.value)}
                    data-testid={`button-add-${day.value}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Assign Driver
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {daySchedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="p-4 rounded-md bg-accent/50 hover-elevate"
                        data-testid={`schedule-${schedule.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-sm">
                              {schedule.driverName}
                            </p>
                          </div>
                          <StatusBadge
                            status={schedule.isActive ? "active" : "inactive"}
                          />
                        </div>

                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RouteIcon className="h-3 w-3" />
                            <span>{schedule.routeName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{schedule.startTime} - {schedule.endTime}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAssignment(schedule)}
                            className="flex-1"
                            data-testid={`button-edit-${schedule.id}`}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteDialog(schedule)}
                            data-testid={`button-delete-${schedule.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid={`no-assignments-${day.value}`}>
                    No assignments for {day.label}. Click "Assign Driver" to add one.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title">
              {editingAssignment ? "Edit Driver Assignment" : "New Driver Assignment"}
              {selectedDay !== null && ` - ${DAYS_OF_WEEK[selectedDay].label}`}
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
                          <SelectItem key={driver.id} value={driver.id}>
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
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-route">
                          <SelectValue placeholder="Select a route" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {routes?.map((route) => (
                          <SelectItem key={route.id} value={route.id}>
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
                    <FormLabel>Vehicle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle">
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
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
                  name="startTime"
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
                  name="endTime"
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
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "true")}
                      value={field.value !== undefined ? field.value.toString() : "true"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
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
                  {editingAssignment ? "Update Assignment" : "Create Assignment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the assignment for {deleteDialog?.driverName} on {deleteDialog && DAYS_OF_WEEK[deleteDialog.dayOfWeek]?.label}? This action cannot be undone.
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
