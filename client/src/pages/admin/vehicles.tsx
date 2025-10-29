import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVehicleSchema, type InsertVehicle } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminVehicles() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["/api/admin/vehicles"],
  });

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      name: "",
      plateNumber: "",
      capacity: 0,
      status: "active",
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      return await apiRequest("/api/admin/vehicles", {
        method: "POST",
        body: JSON.stringify(data),
      });
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

  const onSubmit = (data: InsertVehicle) => {
    createVehicleMutation.mutate(data);
  };

  const columns = [
    {
      header: "Vehicle Name",
      accessor: "name",
    },
    {
      header: "Plate Number",
      accessor: "plateNumber",
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-add-vehicle">
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
            <DialogDescription>
              Enter the details of the new vehicle to add to your fleet.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Name</FormLabel>
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    form.reset();
                  }}
                  data-testid="button-cancel-vehicle"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createVehicleMutation.isPending}
                  data-testid="button-submit-vehicle"
                >
                  {createVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
