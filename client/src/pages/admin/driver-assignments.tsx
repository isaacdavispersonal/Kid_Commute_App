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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, User, Route, ChevronDown, Car, MoreVertical } from "lucide-react";

interface EnrichedDriverAssignment {
  id: string;
  driverId: string;
  routeId: string;
  vehicleId: string | null;
  notes: string | null;
  driver: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  route: {
    id: string;
    name: string;
    routeType: "MORNING" | "AFTERNOON" | "EXTRA" | null;
  } | null;
  vehicle: {
    id: string;
    name: string;
  } | null;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

interface Driver {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

function getDriverDisplayName(driver: { firstName: string | null; lastName: string | null; email: string } | null | undefined): string {
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

const formSchema = insertDriverAssignmentSchema;

type FormData = z.infer<typeof formSchema>;

export default function AdminDriverAssignments() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EnrichedDriverAssignment | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<EnrichedDriverAssignment | null>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driverId: "",
      routeId: "",
      vehicleId: "",
      notes: "",
    },
  });

  const toggleRouteSelection = (routeId: string) => {
    setSelectedRouteIds(prev => 
      prev.includes(routeId) 
        ? prev.filter(id => id !== routeId)
        : [...prev, routeId]
    );
  };

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

  const bulkCreateMutation = useMutation({
    mutationFn: async (assignments: FormData[]) => {
      const results = await Promise.allSettled(
        assignments.map(data => apiRequest("POST", "/api/admin/driver-assignments", data))
      );
      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;
      return { successful, failed };
    },
    onSuccess: ({ successful, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-assignments"] });
      handleCloseDialog();
      if (failed > 0) {
        toast({
          title: "Partial Success",
          description: `Created ${successful} assignment(s). ${failed} failed (may already exist).`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: `Created ${successful} driver assignment(s)`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create driver assignments",
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shifts"] });
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
      setSelectedRouteIds([]);
      form.reset({
        driverId: assignment.driverId,
        routeId: assignment.routeId,
        vehicleId: assignment.vehicleId || "",
        notes: assignment.notes || "",
      });
    } else {
      setEditingAssignment(null);
      setSelectedRouteIds([]);
      form.reset({
        driverId: "",
        routeId: "",
        vehicleId: "",
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssignment(null);
    setSelectedRouteIds([]);
    form.reset();
  };

  const onSubmit = (data: FormData) => {
    if (editingAssignment) {
      updateMutation.mutate({ id: editingAssignment.id, data });
    } else {
      if (selectedRouteIds.length > 0) {
        const assignments = selectedRouteIds.map(routeId => ({
          ...data,
          routeId,
        }));
        bulkCreateMutation.mutate(assignments);
      } else if (data.routeId) {
        createMutation.mutate(data);
      } else {
        toast({
          title: "Error",
          description: "Please select at least one route",
          variant: "destructive",
        });
      }
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

  const groupedAssignments = assignments?.reduce((acc, assignment) => {
    const key = assignment.driverId;
    if (!acc[key]) {
      acc[key] = {
        driverId: assignment.driverId,
        driverName: getDriverDisplayName(assignment.driver),
        driverEmail: assignment.driver?.email || "Unknown",
        assignments: [],
      };
    }
    acc[key].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { driverId: string; driverName: string; driverEmail: string; assignments: EnrichedDriverAssignment[] }>);

  const driverGroups = groupedAssignments ? Object.values(groupedAssignments) : [];

  const getRouteTypeBadge = (routeType: string | null) => {
    if (!routeType) return null;
    const label = routeType === 'MORNING' ? 'AM' : routeType === 'AFTERNOON' ? 'PM' : 'Extra';
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0">
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Driver Assignments</h1>
          <p className="text-muted-foreground text-sm">
            Assign drivers to routes
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpenDialog()} data-testid="button-create-assignment">
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-base">All Assignments</CardTitle>
          <CardDescription className="text-xs">
            Tap driver to expand routes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {assignmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : !assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm px-4">
              No assignments yet. Tap the button above to create one.
            </div>
          ) : (
            <div className="divide-y">
              {driverGroups.map((group) => (
                <Collapsible key={group.driverId} defaultOpen={driverGroups.length <= 3} data-testid={`driver-group-${group.driverId}`}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`button-toggle-driver-${group.driverId}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{group.driverName}</div>
                          <div className="text-xs text-muted-foreground truncate">{group.driverEmail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-count-${group.driverId}`}>
                          {group.assignments.length}
                        </Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/30">
                      {group.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between gap-2 flex-wrap px-3 py-2.5 border-b last:border-b-0"
                          data-testid={`row-assignment-${assignment.id}`}
                        >
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {assignment.route?.name || "Unknown"}
                              </span>
                              {getRouteTypeBadge(assignment.route?.routeType || null)}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                              <Car className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {assignment.vehicle?.name || "No vehicle"}
                              </span>
                              {assignment.notes && (
                                <>
                                  <span className="text-muted-foreground/50">•</span>
                                  <span className="truncate italic">{assignment.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`button-actions-${assignment.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenDialog(assignment)} data-testid={`button-edit-${assignment.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(assignment)} className="text-destructive" data-testid={`button-delete-${assignment.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg mx-4">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingAssignment ? "Edit Assignment" : "New Assignment"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingAssignment
                ? "Update the assignment details"
                : "Assign a driver to routes"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Driver</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-driver">
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {getDriverDisplayName(driver)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editingAssignment ? (
                <FormField
                  control={form.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Route</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-route">
                            <SelectValue placeholder="Select route" />
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
              ) : (
                <div className="space-y-2">
                  <FormLabel className="text-sm">Routes</FormLabel>
                  <ScrollArea className="h-36 border rounded-md p-2">
                    <div className="space-y-1">
                      {routes?.map((route) => (
                        <div key={route.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`route-${route.id}`}
                            checked={selectedRouteIds.includes(route.id)}
                            onCheckedChange={() => toggleRouteSelection(route.id)}
                            data-testid={`checkbox-route-${route.id}`}
                          />
                          <label
                            htmlFor={`route-${route.id}`}
                            className="text-sm cursor-pointer flex-1 truncate"
                          >
                            {route.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {selectedRouteIds.length} selected
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Vehicle (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle">
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name}
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add notes..."
                        className="h-16"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
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
                  disabled={createMutation.isPending || updateMutation.isPending || bulkCreateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingAssignment ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the assignment for{" "}
              <span className="font-semibold">{deleteDialog?.route?.name}</span>.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
