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
import { Plus, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EnrichedStop {
  id: string;
  routeId: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  stopOrder: number;
  scheduledTime: string;
  routeName: string;
}

interface Route {
  id: string;
  name: string;
}

export default function AdminStopsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: stops, isLoading: stopsLoading } = useQuery<EnrichedStop[]>({
    queryKey: ["/api/admin/stops"],
  });

  const { data: routes } = useQuery<Route[]>({
    queryKey: ["/api/admin/routes"],
  });

  const form = useForm<InsertStop>({
    resolver: zodResolver(insertStopSchema),
    defaultValues: {
      routeId: "",
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      stopOrder: 1,
      scheduledTime: "",
    },
  });

  const createStopMutation = useMutation({
    mutationFn: async (data: InsertStop) => {
      return await apiRequest("POST", "/api/admin/stops", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stops"] });
      setIsDialogOpen(false);
      form.reset();
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

  const handleSubmit = (data: InsertStop) => {
    createStopMutation.mutate(data);
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
      header: "Route",
      accessor: "routeName",
    },
    {
      header: "Address",
      accessor: "address",
    },
    {
      header: "Order",
      accessor: "stopOrder",
      cell: (value: number) => `#${value}`,
    },
    {
      header: "Scheduled Time",
      accessor: "scheduledTime",
    },
    {
      header: "Coordinates",
      accessor: "latitude",
      cell: (_: string, row: EnrichedStop) => (
        <span className="text-xs text-muted-foreground font-mono">
          {parseFloat(row.latitude).toFixed(4)}, {parseFloat(row.longitude).toFixed(4)}
        </span>
      ),
    },
  ];

  if (stopsLoading) {
    return <StopsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Stop Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage pickup/dropoff stops for routes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-stop">
              <Plus className="h-4 w-4 mr-2" />
              Add Stop
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Stop</DialogTitle>
              <DialogDescription>
                Add a new pickup or dropoff stop to a route
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="stopOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stop Order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            data-testid="input-stop-order"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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

                <FormField
                  control={form.control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          data-testid="input-scheduled-time"
                          {...field}
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
                    onClick={() => setIsDialogOpen(false)}
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
