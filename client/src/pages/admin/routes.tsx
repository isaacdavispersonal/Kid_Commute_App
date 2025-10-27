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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Plus, MapPin } from "lucide-react";

interface RouteWithStopCount {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stopCount: number;
}

export default function AdminRoutes() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: routes, isLoading } = useQuery<RouteWithStopCount[]>({
    queryKey: ["/api/admin/routes"],
  });

  const form = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      return await apiRequest("POST", "/api/admin/routes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsDialogOpen(false);
      form.reset();
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

  const handleSubmit = (data: InsertRoute) => {
    createRouteMutation.mutate(data);
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
    </div>
  );
}
