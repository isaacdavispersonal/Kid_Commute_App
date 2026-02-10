import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGeofenceSchema } from "@shared/schema";
import type { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/data-table";
import { Shield, Plus, Pencil, Trash2, MapPin, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type InsertGeofence = z.infer<typeof insertGeofenceSchema>;

interface Geofence extends InsertGeofence {
  id: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function GeofencesSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full">
          <Skeleton className="h-8 w-full sm:w-64 mb-2" />
          <Skeleton className="h-4 w-full sm:w-96" />
        </div>
        <Skeleton className="h-10 w-full sm:w-40" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function GeofencesPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);

  const { data: geofences, isLoading } = useQuery<Geofence[]>({
    queryKey: ["/api/admin/geofences"],
  });

  const createForm = useForm<InsertGeofence>({
    resolver: zodResolver(insertGeofenceSchema),
    defaultValues: {
      name: "",
      type: "SCHOOL",
      centerLat: "",
      centerLng: "",
      radiusMeters: 100,
      scheduleStartTime: "",
      scheduleEndTime: "",
      isActive: true,
    },
  });

  const editForm = useForm<InsertGeofence>({
    resolver: zodResolver(insertGeofenceSchema),
    defaultValues: {
      name: "",
      type: "SCHOOL",
      centerLat: "",
      centerLng: "",
      radiusMeters: 100,
      scheduleStartTime: "",
      scheduleEndTime: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGeofence) => {
      return await apiRequest("POST", "/api/admin/geofences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geofences"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Geofence created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create geofence",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertGeofence }) => {
      return await apiRequest("PATCH", `/api/admin/geofences/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geofences"] });
      setIsEditDialogOpen(false);
      setSelectedGeofence(null);
      toast({
        title: "Success",
        description: "Geofence updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update geofence",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/geofences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geofences"] });
      setIsDeleteDialogOpen(false);
      setSelectedGeofence(null);
      toast({
        title: "Success",
        description: "Geofence deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete geofence",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: InsertGeofence) => {
    createMutation.mutate(data);
  };

  const handleEditClick = (geofence: Geofence) => {
    setSelectedGeofence(geofence);
    editForm.reset({
      name: geofence.name,
      type: geofence.type,
      centerLat: geofence.centerLat,
      centerLng: geofence.centerLng,
      radiusMeters: geofence.radiusMeters,
      scheduleStartTime: geofence.scheduleStartTime || "",
      scheduleEndTime: geofence.scheduleEndTime || "",
      isActive: geofence.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (data: InsertGeofence) => {
    if (!selectedGeofence) return;
    updateMutation.mutate({ id: selectedGeofence.id, data });
  };

  const handleDeleteClick = (geofence: Geofence) => {
    setSelectedGeofence(geofence);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedGeofence) return;
    deleteMutation.mutate(selectedGeofence.id);
  };

  const columns = [
    {
      header: "Name",
      accessor: "name",
      cell: (value: string, row: Geofence) => (
        <div className="flex items-center gap-2">
          <Shield className={`h-4 w-4 ${row.isActive ? 'text-green-600' : 'text-muted-foreground'}`} />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      header: "Type",
      accessor: "type",
      cell: (value: string) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
          {value}
        </span>
      ),
    },
    {
      header: "Center Coordinates",
      accessor: "centerLat",
      cell: (_: string, row: Geofence) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">
            {parseFloat(row.centerLat).toFixed(5)}, {parseFloat(row.centerLng).toFixed(5)}
          </span>
        </div>
      ),
    },
    {
      header: "Radius",
      accessor: "radiusMeters",
      cell: (value: number) => `${value}m`,
    },
    {
      header: "Schedule",
      accessor: "scheduleStartTime",
      cell: (_: string | null, row: Geofence) => {
        if (!row.scheduleStartTime || !row.scheduleEndTime) {
          return <span className="text-xs text-muted-foreground">Always active</span>;
        }
        return (
          <div className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{row.scheduleStartTime} - {row.scheduleEndTime}</span>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: "isActive",
      cell: (value: boolean) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
          value 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
        }`}>
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: "id",
      cell: (_value: string, row: Geofence) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditClick(row)}
            data-testid={`button-edit-geofence-${row.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteClick(row)}
            data-testid={`button-delete-geofence-${row.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <GeofencesSkeleton />;
  }

  return (
    <div className="overflow-x-hidden space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full">
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Geofence Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Define geographic boundaries for automatic vehicle tracking and parent notifications
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-geofence" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Geofence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Geofence</DialogTitle>
              <DialogDescription>
                Define a geographic boundary to monitor vehicle entry and exit events
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Geofence Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g., Main School Campus"
                          data-testid="input-geofence-name"
                          className="w-full"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-geofence-type" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SCHOOL">School</SelectItem>
                            <SelectItem value="CUSTOM">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          School geofences trigger parent notifications on exit
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="radiusMeters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Radius (meters)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="100"
                            data-testid="input-geofence-radius"
                            className="w-full"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Typical school zone: 100-500m
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="centerLat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Center Latitude</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="37.7749"
                            data-testid="input-geofence-lat"
                            className="w-full"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="centerLng"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Center Longitude</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="-122.4194"
                            data-testid="input-geofence-lng"
                            className="w-full"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="scheduleStartTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule Start (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            data-testid="input-geofence-start-time"
                            className="w-full"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Leave empty for always active
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="scheduleEndTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule End (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            data-testid="input-geofence-end-time"
                            className="w-full"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Supports overnight (e.g., 22:00-06:00)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Enable monitoring for this geofence
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-geofence-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-create-geofence"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Geofence"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={geofences || []}
        isLoading={isLoading}
        emptyMessage="No geofences found. Create your first geofence to enable boundary monitoring."
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Geofence</DialogTitle>
            <DialogDescription>
              Update the geofence configuration
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geofence Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g., Main School Campus"
                        data-testid="input-edit-geofence-name"
                        className="w-full"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-geofence-type" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SCHOOL">School</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="radiusMeters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Radius (meters)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="input-edit-geofence-radius"
                          className="w-full"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="centerLat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Center Latitude</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-edit-geofence-lat"
                          className="w-full"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="centerLng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Center Longitude</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-edit-geofence-lng"
                          className="w-full"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="scheduleStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Start (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          data-testid="input-edit-geofence-start-time"
                          className="w-full"
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
                  name="scheduleEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule End (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          data-testid="input-edit-geofence-end-time"
                          className="w-full"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable monitoring for this geofence
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-geofence-active"
                      />
                    </FormControl>
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
                  disabled={updateMutation.isPending}
                  data-testid="button-update-geofence"
                >
                  {updateMutation.isPending ? "Updating..." : "Update Geofence"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Geofence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedGeofence?.name}"? This will stop all monitoring for this boundary and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
