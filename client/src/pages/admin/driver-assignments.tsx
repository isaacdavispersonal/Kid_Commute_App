import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertDriverAssignmentSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CalendarDays, Clock, User, Route, Car, ChevronRight } from "lucide-react";

interface EnrichedDriverAssignment {
  id: string;
  driverId: string;
  routeId: string;
  vehicleId: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  driverName: string;
  driverEmail: string;
  routeName: string;
  routeType: string | null;
  vehicleName: string;
  vehiclePlate: string;
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

interface RouteType {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

const formSchema = insertDriverAssignmentSchema;

type FormData = z.infer<typeof formSchema>;

export default function AdminDriverAssignments() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EnrichedDriverAssignment | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<EnrichedDriverAssignment | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driverId: "",
      routeId: "",
      vehicleId: "",
      startTime: "",
      endTime: "",
      notes: "",
    },
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<EnrichedDriverAssignment[]>({
    queryKey: ["/api/admin/driver-assignments"],
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      return await apiRequest("PATCH", `/api/admin/driver-assignments/${id}`, data);
    },
    onSuccess: () => {
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
      return await apiRequest("DELETE", `/api/admin/driver-assignments/${id}`);
    },
    onSuccess: () => {
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

  const handleOpenDialog = (assignment?: EnrichedDriverAssignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      form.reset({
        driverId: assignment.driverId,
        routeId: assignment.routeId,
        vehicleId: assignment.vehicleId,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        notes: assignment.notes || "",
      });
    } else {
      setEditingAssignment(null);
      form.reset({
        driverId: "",
        routeId: "",
        vehicleId: "",
        startTime: "",
        endTime: "",
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssignment(null);
    form.reset();
  };

  const onSubmit = (data: FormData) => {
    if (editingAssignment) {
      updateMutation.mutate({ id: editingAssignment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (assignment: EnrichedDriverAssignment) => {
    setDeleteDialog(assignment);
  };

  const confirmDelete = () => {
    if (deleteDialog) {
      deleteMutation.mutate(deleteDialog.id);
    }
  };


  // Group assignments by driver
  const groupedAssignments = assignments?.reduce((acc, assignment) => {
    const key = assignment.driverId;
    if (!acc[key]) {
      acc[key] = {
        driverId: assignment.driverId,
        driverName: assignment.driverName,
        driverEmail: assignment.driverEmail,
        assignments: [],
      };
    }
    acc[key].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { driverId: string; driverName: string; driverEmail: string; assignments: EnrichedDriverAssignment[] }>);

  const driverGroups = groupedAssignments ? Object.values(groupedAssignments) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Driver Assignments</h1>
          <p className="text-muted-foreground mt-1">
            Set up driver assignments to routes and vehicles for scheduling
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-create-assignment">
          <Plus className="h-4 w-4 mr-2" />
          New Assignment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
          <CardDescription>
            Grouped by driver - expand to view and manage assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading assignments...
            </div>
          ) : !assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No driver assignments found. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {driverGroups.map((group) => (
                <Collapsible key={group.driverId} defaultOpen={driverGroups.length <= 5} data-testid={`driver-group-${group.driverId}`}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover-elevate" data-testid={`button-toggle-driver-${group.driverId}`}>
                        <div className="flex items-center gap-3">
                          <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                          <User className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-semibold">{group.driverName}</div>
                            <div className="text-sm text-muted-foreground">{group.driverEmail}</div>
                          </div>
                        </div>
                        <Badge variant="secondary" data-testid={`badge-count-${group.driverId}`}>
                          {group.assignments.length} {group.assignments.length === 1 ? 'assignment' : 'assignments'}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Route</TableHead>
                              <TableHead>Vehicle</TableHead>
                              <TableHead>Schedule</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.assignments.map((assignment) => (
                              <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <Route className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{assignment.routeName}</span>
                                    </div>
                                    {assignment.routeType && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium w-fit ml-6">
                                        {assignment.routeType === 'MORNING' ? 'Morning' : assignment.routeType === 'AFTERNOON' ? 'Afternoon' : 'Extra'}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Car className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <div>{assignment.vehicleName}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {assignment.vehiclePlate}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">
                                      {assignment.startTime} - {assignment.endTime}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {assignment.notes || '—'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenDialog(assignment)}
                                      data-testid={`button-edit-${assignment.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDelete(assignment)}
                                      data-testid={`button-delete-${assignment.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? "Edit Driver Assignment" : "New Driver Assignment"}
            </DialogTitle>
            <DialogDescription>
              {editingAssignment
                ? "Update the driver assignment details"
                : "Assign a driver to a route with a vehicle and schedule"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-driver">
                          <SelectValue placeholder="Select a driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {getDriverDisplayName(driver)} ({driver.email})
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Add any notes about this assignment"
                        {...field}
                        value={field.value || ""}
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
              Are you sure you want to delete the assignment for{" "}
              <span className="font-semibold">{deleteDialog?.driverName}</span> on{" "}
              <span className="font-semibold">{deleteDialog && new Date(deleteDialog.date).toLocaleDateString()}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
