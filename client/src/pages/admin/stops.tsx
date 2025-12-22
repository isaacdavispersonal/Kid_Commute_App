import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStopSchema, type InsertStop } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { Plus, MapPin, Pencil, Trash2, Shield, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface EnrichedStop {
  id: string;
  name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  geofenceId: string | null;
  geofence: {
    id: string;
    name: string;
    radiusMeters: number;
    isActive: boolean;
  } | null;
}

export default function AdminStopsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<EnrichedStop | null>(null);

  const { data: stops, isLoading: stopsLoading } = useQuery<EnrichedStop[]>({
    queryKey: ["/api/admin/stops"],
  });

  const createForm = useForm<InsertStop>({
    resolver: zodResolver(insertStopSchema),
    defaultValues: {
      name: "",
      address: "",
      latitude: "",
      longitude: "",
    },
  });

  const editForm = useForm<InsertStop>({
    resolver: zodResolver(insertStopSchema),
    defaultValues: {
      name: "",
      address: "",
      latitude: "",
      longitude: "",
    },
  });

  const createStopMutation = useMutation({
    mutationFn: async (data: InsertStop) => {
      return await apiRequest("POST", "/api/admin/stops", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stops"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Stop created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stop",
        variant: "destructive",
      });
    },
  });

  const updateStopMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertStop }) => {
      return await apiRequest("PATCH", `/api/admin/stops/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stops"] });
      setIsEditDialogOpen(false);
      setSelectedStop(null);
      toast({
        title: "Success",
        description: "Stop updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stop",
        variant: "destructive",
      });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/stops/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stops"] });
      setIsDeleteDialogOpen(false);
      setSelectedStop(null);
      toast({
        title: "Success",
        description: "Stop deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stop",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: InsertStop) => {
    createStopMutation.mutate(data);
  };

  const handleEditSubmit = (data: InsertStop) => {
    if (!selectedStop) return;
    updateStopMutation.mutate({ id: selectedStop.id, data });
  };

  const handleEditClick = (stop: EnrichedStop) => {
    setSelectedStop(stop);
    editForm.reset({
      name: stop.name,
      address: stop.address,
      latitude: stop.latitude || "",
      longitude: stop.longitude || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (stop: EnrichedStop) => {
    setSelectedStop(stop);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedStop) return;
    deleteStopMutation.mutate(selectedStop.id);
  };

  const columns = [
    {
      header: "Stop Name",
      accessor: "name",
      cell: (value: string) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      header: "Address",
      accessor: "address",
    },
    {
      header: "Coordinates",
      accessor: "latitude",
      cell: (_: string | null, row: EnrichedStop) => {
        if (!row.latitude || !row.longitude) {
          return <span className="text-xs text-muted-foreground">Not set</span>;
        }
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {parseFloat(row.latitude).toFixed(4)}, {parseFloat(row.longitude).toFixed(4)}
          </span>
        );
      },
    },
    {
      header: "Geofence",
      accessor: "geofenceId",
      cell: (_: string | null, row: EnrichedStop) => {
        if (!row.geofence) {
          return (
            <Badge variant="secondary" className="gap-1">
              <ShieldOff className="h-3 w-3" />
              None
            </Badge>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <Badge 
              variant={row.geofence.isActive ? "default" : "secondary"}
              className="gap-1"
            >
              <Shield className="h-3 w-3" />
              {row.geofence.radiusMeters}m
            </Badge>
          </div>
        );
      },
    },
    {
      header: "Actions",
      accessor: "id",
      cell: (_value: string, row: EnrichedStop) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditClick(row)}
            data-testid={`button-edit-stop-${row.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteClick(row)}
            data-testid={`button-delete-stop-${row.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  if (stopsLoading) {
    return <StopsSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Stop Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage pickup/dropoff locations with auto-provisioned geofences.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-stop" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Stop
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Stop</DialogTitle>
              <DialogDescription>
                Add a new pickup or dropoff location. Geofences auto-provision when coordinates are provided.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stop Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g., Main St & 5th Ave"
                          data-testid="input-stop-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Full street address"
                          data-testid="input-address"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="E.g., 40.7128"
                            data-testid="input-latitude"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="E.g., -74.0060"
                            data-testid="input-longitude"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                    disabled={createStopMutation.isPending}
                    data-testid="button-create-stop"
                  >
                    {createStopMutation.isPending ? "Creating..." : "Create Stop"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={stops || []}
        isLoading={stopsLoading}
        emptyMessage="No stops found. Create your first stop to get started."
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Stop</DialogTitle>
            <DialogDescription>
              Update stop information. Geofence will auto-sync if coordinates change.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stop Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g., Main St & 5th Ave"
                        data-testid="input-edit-stop-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Full street address"
                        data-testid="input-edit-address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g., 40.7128"
                          data-testid="input-edit-latitude"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g., -74.0060"
                          data-testid="input-edit-longitude"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  disabled={updateStopMutation.isPending}
                  data-testid="button-save-stop"
                >
                  {updateStopMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedStop?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteStopMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteStopMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StopsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    </div>
  );
}
