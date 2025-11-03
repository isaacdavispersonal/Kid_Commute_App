import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRouteSchema, type InsertRoute } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";

interface RouteWithStopCount {
  id: string;
  name: string;
  description: string | null;
  routeType: "MORNING" | "AFTERNOON" | "EXTRA" | null;
  isActive: boolean;
  stopCount: number;
}

export default function AdminRoutes() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteWithStopCount | null>(null);

  const { data: routes, isLoading } = useQuery<RouteWithStopCount[]>({
    queryKey: ["/api/admin/routes"],
  });

  const createForm = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      name: "",
      description: "",
      routeType: null,
      isActive: true,
    },
  });

  const editForm = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      name: "",
      description: "",
      routeType: null,
      isActive: true,
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      return await apiRequest("POST", "/api/admin/routes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Route created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create route",
        variant: "destructive",
      });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertRoute }) => {
      return await apiRequest("PATCH", `/api/admin/routes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsEditDialogOpen(false);
      setSelectedRoute(null);
      toast({
        title: "Success",
        description: "Route updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route",
        variant: "destructive",
      });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/routes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsDeleteDialogOpen(false);
      setSelectedRoute(null);
      toast({
        title: "Success",
        description: "Route deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete route",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: InsertRoute) => {
    createRouteMutation.mutate(data);
  };

  const handleEditSubmit = (data: InsertRoute) => {
    if (!selectedRoute) return;
    updateRouteMutation.mutate({ id: selectedRoute.id, data });
  };

  const handleEditClick = (route: RouteWithStopCount) => {
    setSelectedRoute(route);
    editForm.reset({
      name: route.name,
      description: route.description || "",
      shiftType: (route as any).shiftType || null,
      isActive: route.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (route: RouteWithStopCount) => {
    setSelectedRoute(route);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedRoute) return;
    deleteRouteMutation.mutate(selectedRoute.id);
  };

  const columns = [
    {
      header: "Route Name",
      accessor: "name",
    },
    {
      header: "Description",
      accessor: "description",
      cell: (value: string) => value || "—",
    },
    {
      header: "Route Type",
      accessor: "routeType",
      cell: (value: string | null) => {
        if (!value) return "—";
        const typeLabels: Record<string, string> = {
          MORNING: "Morning",
          AFTERNOON: "Afternoon",
          EXTRA: "Extra",
        };
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
            {typeLabels[value] || value}
          </span>
        );
      },
    },
    {
      header: "Stops",
      accessor: "stopCount",
      cell: (value: number) => (
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {value || 0} stops
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "isActive",
      cell: (value: boolean) => (
        <StatusBadge status={value ? "active" : "inactive"} />
      ),
    },
    {
      header: "Actions",
      accessor: "id",
      cell: (_value: string, row: RouteWithStopCount) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditClick(row)}
            data-testid={`button-edit-route-${row.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteClick(row)}
            data-testid={`button-delete-route-${row.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Route Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage transportation routes
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-route">
              <Plus className="h-4 w-4 mr-2" />
              Add Route
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Route</DialogTitle>
              <DialogDescription>
                Add a new transportation route to your fleet
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Route Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g., Morning Pickup Route"
                          data-testid="input-route-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe this route's purpose and coverage area"
                          data-testid="input-route-description"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="routeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Route Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-route-type">
                            <SelectValue placeholder="Select route type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MORNING">Morning Route</SelectItem>
                          <SelectItem value="AFTERNOON">Afternoon Route</SelectItem>
                          <SelectItem value="EXTRA">Extra Route</SelectItem>
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
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRouteMutation.isPending}
                    data-testid="button-create-route"
                  >
                    {createRouteMutation.isPending ? "Creating..." : "Create Route"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={routes || []}
        isLoading={isLoading}
        emptyMessage="No routes found. Create your first route to get started."
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>
              Update the route information
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g., Morning Pickup Route"
                        data-testid="input-edit-route-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this route's purpose and coverage area"
                        data-testid="input-edit-route-description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="routeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-route-type">
                          <SelectValue placeholder="Select route type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MORNING">Morning Route</SelectItem>
                        <SelectItem value="AFTERNOON">Afternoon Route</SelectItem>
                        <SelectItem value="EXTRA">Extra Route</SelectItem>
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
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateRouteMutation.isPending}
                  data-testid="button-save-route"
                >
                  {updateRouteMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRoute?.name}"? This will also delete all stops associated with this route. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteRouteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteRouteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
