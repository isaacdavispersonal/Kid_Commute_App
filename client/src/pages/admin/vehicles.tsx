import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVehicleSchema, type InsertVehicle, type User, type Vehicle } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Extended schema to handle "UNASSIGNED" -> null conversion for driverId and samsaraVehicleId
const vehicleFormSchema = insertVehicleSchema.extend({
  nickname: z.string().optional().transform(val => val === "" ? null : val || null),
  driverId: z.string().optional().transform(val => val === "UNASSIGNED" || val === "" ? null : val || null),
  samsaraVehicleId: z.string().optional().transform(val => val === "" ? null : val || null),
});

export default function AdminVehicles() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/admin/vehicles"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Filter users to only show drivers
  const drivers = users?.filter(user => user.role === "driver") || [];

  const form = useForm<z.infer<typeof vehicleFormSchema>>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      name: "",
      nickname: "",
      plateNumber: "",
      capacity: 0,
      status: "active",
      driverId: "UNASSIGNED",
      samsaraVehicleId: "",
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vehicleFormSchema>) => {
      return await apiRequest("POST", "/api/admin/vehicles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle added successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add vehicle",
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vehicleFormSchema>) => {
      if (!editingVehicle) throw new Error("No vehicle selected for editing");
      return await apiRequest("PUT", `/api/admin/vehicles/${editingVehicle.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle updated successfully",
      });
      setIsDialogOpen(false);
      setEditingVehicle(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle",
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      return await apiRequest("DELETE", `/api/admin/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
      setVehicleToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vehicle",
        variant: "destructive",
      });
      setVehicleToDelete(null);
    },
  });

  const onSubmit = (data: z.infer<typeof vehicleFormSchema>) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      name: vehicle.name,
      nickname: vehicle.nickname || "",
      plateNumber: vehicle.plateNumber,
      capacity: vehicle.capacity,
      status: vehicle.status,
      driverId: vehicle.driverId || "UNASSIGNED",
      samsaraVehicleId: vehicle.samsaraVehicleId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteVehicle = () => {
    if (vehicleToDelete) {
      deleteVehicleMutation.mutate(vehicleToDelete);
    }
  };

  const columns = [
    {
      header: "Vehicle Name",
      accessor: "name",
      cell: (value: string, row: Vehicle) => (
        <div>
          <span className="font-medium">{row.nickname || value}</span>
          {row.nickname && (
            <span className="text-muted-foreground text-sm ml-2">({value})</span>
          )}
        </div>
      ),
    },
    {
      header: "Plate Number",
      accessor: "plateNumber",
    },
    {
      header: "Assigned Driver",
      accessor: "driverId",
      cell: (value: string | null, row: any) => {
        if (!value) return <span className="text-muted-foreground">Unassigned</span>;
        const driver = drivers.find(d => d.id === value);
        if (!driver) return <span className="text-muted-foreground">Unknown</span>;
        
        const firstName = driver.firstName?.trim();
        const lastName = driver.lastName?.trim();
        const displayName = firstName && lastName 
          ? `${firstName} ${lastName}`
          : firstName || lastName || driver.email;
        
        return <span>{displayName}</span>;
      },
    },
    {
      header: "Capacity",
      accessor: "capacity",
      cell: (value: number) => `${value} passengers`,
    },
    {
      header: "Status",
      accessor: "status",
      cell: (value: string) => <StatusBadge status={value as any} />,
    },
    {
      header: "Last Update",
      accessor: "lastLocationUpdate",
      cell: (value: string) => {
        if (!value) return "Never";
        return new Date(value).toLocaleString();
      },
    },
    {
      header: "Actions",
      accessor: "id",
      cell: (value: string, row: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEditVehicle(row)}
            data-testid={`button-edit-vehicle-${value}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVehicleToDelete(value)}
            data-testid={`button-delete-vehicle-${value}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Vehicle Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your fleet vehicles
          </p>
        </div>
        <Button
          data-testid="button-add-vehicle"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={vehicles || []}
        isLoading={isLoading}
        emptyMessage="No vehicles found. Add your first vehicle to get started."
      />

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingVehicle(null);
          form.reset();
        }
      }}>
        <DialogContent data-testid="dialog-add-vehicle">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
            <DialogDescription>
              {editingVehicle 
                ? "Update the vehicle details below." 
                : "Enter the details of the new vehicle to add to your fleet."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Name / Unit Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Bus 1, Van A"
                        data-testid="input-vehicle-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nickname (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="e.g., Big Yellow, Morning Express"
                        data-testid="input-vehicle-nickname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plate Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., ABC-1234"
                        data-testid="input-vehicle-plate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passenger Capacity</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        placeholder="e.g., 24"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-vehicle-capacity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Driver</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || "UNASSIGNED"}
                      value={field.value || "UNASSIGNED"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle-driver">
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                        {drivers.map((driver) => {
                          const firstName = driver.firstName?.trim();
                          const lastName = driver.lastName?.trim();
                          const displayName = firstName && lastName 
                            ? `${firstName} ${lastName}`
                            : firstName || lastName || driver.email;
                          
                          return (
                            <SelectItem key={driver.id} value={driver.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="samsaraVehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Samsara Vehicle ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Optional - Samsara integration ID"
                        data-testid="input-samsara-vehicle-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingVehicle(null);
                    form.reset();
                  }}
                  data-testid="button-cancel-vehicle"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
                  data-testid="button-submit-vehicle"
                >
                  {editingVehicle 
                    ? (updateVehicleMutation.isPending ? "Updating..." : "Update Vehicle")
                    : (createVehicleMutation.isPending ? "Adding..." : "Add Vehicle")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={vehicleToDelete !== null} onOpenChange={() => setVehicleToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-vehicle">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone.
              The vehicle cannot be deleted if it has active driver assignments or shifts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVehicle}
              disabled={deleteVehicleMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteVehicleMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
