import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRouteSchema, insertStopSchema, insertRouteStopSchema, insertRouteGroupSchema, type InsertRoute, type InsertStop, type InsertRouteStop, type InsertRouteGroup, type Stop, type RouteStop, type RouteStopWithMetadata, type RouteGroup, type RouteColor } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteColorBadge } from "@/components/route-color-badge";
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
import { Plus, MapPin, Pencil, Trash2, List, Clock, ArrowUp, ArrowDown, ChevronDown, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface RouteWithStopCount {
  id: string;
  name: string;
  description: string | null;
  routeType: "MORNING" | "AFTERNOON" | "EXTRA" | null;
  color: RouteColor | null;
  groupId: string | null;
  isActive: boolean;
  stopCount: number;
}

export default function AdminRoutes() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("routes");
  const [isCreateRouteDialogOpen, setIsCreateRouteDialogOpen] = useState(false);
  const [isEditRouteDialogOpen, setIsEditRouteDialogOpen] = useState(false);
  const [isDeleteRouteDialogOpen, setIsDeleteRouteDialogOpen] = useState(false);
  const [isCreateStopDialogOpen, setIsCreateStopDialogOpen] = useState(false);
  const [isEditStopDialogOpen, setIsEditStopDialogOpen] = useState(false);
  const [isDeleteStopDialogOpen, setIsDeleteStopDialogOpen] = useState(false);
  const [isManageStopsDialogOpen, setIsManageStopsDialogOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteWithStopCount | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<RouteGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: routes, isLoading: routesLoading } = useQuery<RouteWithStopCount[]>({
    queryKey: ["/api/admin/routes"],
  });

  const { data: stops, isLoading: stopsLoading } = useQuery<Stop[]>({
    queryKey: ["/api/admin/stops"],
  });

  const { data: routeGroups, isLoading: routeGroupsLoading } = useQuery<RouteGroup[]>({
    queryKey: ["/api/admin/route-groups"],
  });

  const { data: routeStops, isLoading: routeStopsLoading } = useQuery<RouteStopWithMetadata[]>({
    queryKey: ["/api/admin/routes", selectedRoute?.id, "stops"],
    enabled: !!selectedRoute && isManageStopsDialogOpen,
  });

  const createRouteForm = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      name: "",
      description: "",
      routeType: null,
      color: null,
      groupId: null,
      isActive: true,
    },
  });

  const editRouteForm = useForm<InsertRoute>({
    resolver: zodResolver(insertRouteSchema),
    defaultValues: {
      name: "",
      description: "",
      routeType: null,
      color: null,
      groupId: null,
      isActive: true,
    },
  });

  const createStopForm = useForm<InsertStop>({
    resolver: zodResolver(insertStopSchema),
    defaultValues: {
      name: "",
      address: "",
      latitude: null,
      longitude: null,
    },
  });

  const editStopForm = useForm<InsertStop>({
    resolver: zodResolver(insertStopSchema),
    defaultValues: {
      name: "",
      address: "",
      latitude: null,
      longitude: null,
    },
  });

  const createGroupForm = useForm<InsertRouteGroup>({
    resolver: zodResolver(insertRouteGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "gray",
    },
  });

  const editGroupForm = useForm<InsertRouteGroup>({
    resolver: zodResolver(insertRouteGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "gray",
    },
  });

  // Route Mutations
  const createRouteMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      return await apiRequest("POST", "/api/admin/routes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsCreateRouteDialogOpen(false);
      createRouteForm.reset();
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
      setIsEditRouteDialogOpen(false);
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
      setIsDeleteRouteDialogOpen(false);
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

  // Stop Mutations
  const createStopMutation = useMutation({
    mutationFn: async (data: InsertStop) => {
      return await apiRequest("POST", "/api/admin/stops", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stops"] });
      setIsCreateStopDialogOpen(false);
      createStopForm.reset();
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
      setIsEditStopDialogOpen(false);
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
      setIsDeleteStopDialogOpen(false);
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

  // Route Group Mutations
  const createGroupMutation = useMutation({
    mutationFn: async (data: InsertRouteGroup) => {
      return await apiRequest("POST", "/api/admin/route-groups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/route-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsCreateGroupDialogOpen(false);
      createGroupForm.reset();
      toast({
        title: "Success",
        description: "Route group created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create route group",
        variant: "destructive",
      });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertRouteGroup }) => {
      return await apiRequest("PATCH", `/api/admin/route-groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/route-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsEditGroupDialogOpen(false);
      setSelectedGroup(null);
      toast({
        title: "Success",
        description: "Route group updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route group",
        variant: "destructive",
      });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/route-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/route-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      setIsDeleteGroupDialogOpen(false);
      setSelectedGroup(null);
      toast({
        title: "Success",
        description: "Route group deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete route group",
        variant: "destructive",
      });
    },
  });

  // Route Stop Mutations
  const addStopToRouteMutation = useMutation({
    mutationFn: async (data: InsertRouteStop) => {
      return await apiRequest("POST", `/api/admin/routes/${data.routeId}/stops`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      if (selectedRoute) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/routes", selectedRoute.id, "stops"] });
      }
      toast({
        title: "Success",
        description: "Stop added to route",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add stop to route",
        variant: "destructive",
      });
    },
  });

  const removeStopFromRouteMutation = useMutation({
    mutationFn: async ({ routeId, routeStopId }: { routeId: string; routeStopId: string }) => {
      return await apiRequest("DELETE", `/api/admin/routes/${routeId}/stops/${routeStopId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/routes"] });
      if (selectedRoute) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/routes", selectedRoute.id, "stops"] });
      }
      toast({
        title: "Success",
        description: "Stop removed from route",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove stop from route",
        variant: "destructive",
      });
    },
  });

  const reorderStopsMutation = useMutation({
    mutationFn: async ({ routeId, stops }: { routeId: string; stops: Array<{ id: string; stopOrder: number; scheduledTime: string | null }> }) => {
      return await apiRequest("PATCH", `/api/admin/routes/${routeId}/stops`, { stops });
    },
    onSuccess: () => {
      if (selectedRoute) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/routes", selectedRoute.id, "stops"] });
      }
      toast({
        title: "Success",
        description: "Stops reordered successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder stops",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleCreateRouteSubmit = (data: InsertRoute) => {
    createRouteMutation.mutate(data);
  };

  const handleEditRouteSubmit = (data: InsertRoute) => {
    if (!selectedRoute) return;
    updateRouteMutation.mutate({ id: selectedRoute.id, data });
  };

  const handleEditRouteClick = (route: RouteWithStopCount) => {
    setSelectedRoute(route);
    editRouteForm.reset({
      name: route.name,
      description: route.description || "",
      routeType: route.routeType || null,
      color: route.color || null,
      groupId: route.groupId || null,
      isActive: route.isActive,
    });
    setIsEditRouteDialogOpen(true);
  };

  const handleDeleteRouteClick = (route: RouteWithStopCount) => {
    setSelectedRoute(route);
    setIsDeleteRouteDialogOpen(true);
  };

  const handleDeleteRouteConfirm = () => {
    if (!selectedRoute) return;
    deleteRouteMutation.mutate(selectedRoute.id);
  };

  const handleCreateStopSubmit = (data: InsertStop) => {
    createStopMutation.mutate(data);
  };

  const handleEditStopSubmit = (data: InsertStop) => {
    if (!selectedStop) return;
    updateStopMutation.mutate({ id: selectedStop.id, data });
  };

  const handleEditStopClick = (stop: Stop) => {
    setSelectedStop(stop);
    editStopForm.reset({
      name: stop.name,
      address: stop.address,
      latitude: stop.latitude ?? null,
      longitude: stop.longitude ?? null,
    });
    setIsEditStopDialogOpen(true);
  };

  const handleDeleteStopClick = (stop: Stop) => {
    setSelectedStop(stop);
    setIsDeleteStopDialogOpen(true);
  };

  const handleDeleteStopConfirm = () => {
    if (!selectedStop) return;
    deleteStopMutation.mutate(selectedStop.id);
  };

  const handleCreateGroupSubmit = (data: InsertRouteGroup) => {
    createGroupMutation.mutate(data);
  };

  const handleEditGroupSubmit = (data: InsertRouteGroup) => {
    if (!selectedGroup) return;
    updateGroupMutation.mutate({ id: selectedGroup.id, data });
  };

  const handleEditGroupClick = (group: RouteGroup) => {
    setSelectedGroup(group);
    editGroupForm.reset({
      name: group.name,
      description: group.description || "",
      color: group.color,
    });
    setIsEditGroupDialogOpen(true);
  };

  const handleDeleteGroupClick = (group: RouteGroup) => {
    setSelectedGroup(group);
    setIsDeleteGroupDialogOpen(true);
  };

  const handleDeleteGroupConfirm = () => {
    if (!selectedGroup) return;
    deleteGroupMutation.mutate(selectedGroup.id);
  };

  const handleManageStopsClick = (route: RouteWithStopCount) => {
    setSelectedRoute(route);
    setIsManageStopsDialogOpen(true);
  };

  const handleAddStopToRoute = (stopId: string) => {
    if (!selectedRoute || !routeStops) return;
    const nextOrder = routeStops.length + 1;
    addStopToRouteMutation.mutate({
      routeId: selectedRoute.id,
      stopId,
      stopOrder: nextOrder,
      scheduledTime: undefined,
    });
  };

  const handleRemoveStopFromRoute = (routeStopId: string) => {
    if (!selectedRoute) return;
    removeStopFromRouteMutation.mutate({
      routeId: selectedRoute.id,
      routeStopId,
    });
  };

  const handleMoveStopUp = (index: number) => {
    if (!selectedRoute || !routeStops || index === 0) return;
    const newStops = [...routeStops];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    const updates = newStops.map((stop, idx) => ({
      id: stop.id,
      stopOrder: idx + 1,
      scheduledTime: stop.scheduledTime,
    }));
    reorderStopsMutation.mutate({ routeId: selectedRoute.id, stops: updates });
  };

  const handleMoveStopDown = (index: number) => {
    if (!selectedRoute || !routeStops || index === routeStops.length - 1) return;
    const newStops = [...routeStops];
    [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
    const updates = newStops.map((stop, idx) => ({
      id: stop.id,
      stopOrder: idx + 1,
      scheduledTime: stop.scheduledTime,
    }));
    reorderStopsMutation.mutate({ routeId: selectedRoute.id, stops: updates });
  };

  const routeColumns = [
    {
      header: "Route Name",
      accessor: "name",
      cell: (_value: string, row: RouteWithStopCount) => (
        <RouteColorBadge routeName={row.name} color={row.color} />
      ),
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
      header: "Group",
      accessor: "groupId",
      cell: (value: string | null, row: RouteWithStopCount) => {
        if (!value) return "—";
        const group = routeGroups?.find(g => g.id === value);
        if (!group) return "—";
        return <RouteColorBadge routeName={group.name} color={group.color} />;
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
            onClick={() => handleManageStopsClick(row)}
            data-testid={`button-manage-stops-${row.id}`}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditRouteClick(row)}
            data-testid={`button-edit-route-${row.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteRouteClick(row)}
            data-testid={`button-delete-route-${row.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const stopColumns = [
    {
      header: "Stop Name",
      accessor: "name",
    },
    {
      header: "Address",
      accessor: "address",
    },
    {
      header: "Actions",
      accessor: "id",
      cell: (_value: string, row: Stop) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditStopClick(row)}
            data-testid={`button-edit-stop-${row.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteStopClick(row)}
            data-testid={`button-delete-stop-${row.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const availableStops = stops?.filter(
    stop => !routeStops?.some(rs => rs.stopId === stop.id)
  ) || [];

  // Helper function to toggle group expansion
  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Group routes by their route group
  const groupedRoutes = routes?.reduce((acc, route) => {
    const groupKey = route.groupId || "ungrouped";
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(route);
    return acc;
  }, {} as Record<string, RouteWithStopCount[]>) || {};

  // Show all groups (even those without routes)
  const groupsWithRoutes = routeGroups || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Route Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage transportation routes and stops
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="routes" data-testid="tab-routes">Routes</TabsTrigger>
          <TabsTrigger value="stops" data-testid="tab-stops">Stops</TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isCreateRouteDialogOpen} onOpenChange={setIsCreateRouteDialogOpen}>
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
                <Form {...createRouteForm}>
                  <form onSubmit={createRouteForm.handleSubmit(handleCreateRouteSubmit)} className="space-y-4">
                    <FormField
                      control={createRouteForm.control}
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
                      control={createRouteForm.control}
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
                      control={createRouteForm.control}
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

                    <FormField
                      control={createRouteForm.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Label (Optional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-route-color">
                                <SelectValue placeholder="Select color" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="tan">Tan</SelectItem>
                              <SelectItem value="red">Red</SelectItem>
                              <SelectItem value="blue">Blue</SelectItem>
                              <SelectItem value="orange">Orange</SelectItem>
                              <SelectItem value="yellow">Yellow</SelectItem>
                              <SelectItem value="purple">Purple</SelectItem>
                              <SelectItem value="green">Green</SelectItem>
                              <SelectItem value="gray">Gray</SelectItem>
                              <SelectItem value="teal">Teal</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                              <SelectItem value="pink">Pink</SelectItem>
                              <SelectItem value="maroon">Maroon</SelectItem>
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
                        onClick={() => setIsCreateRouteDialogOpen(false)}
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

          {routesLoading || routeGroupsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading routes...</div>
          ) : !routes || routes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No routes found. Create your first route to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grouped Routes */}
              {groupsWithRoutes.map((group) => {
                const groupRoutes = groupedRoutes[group.id] || [];
                const isExpanded = expandedGroups.has(group.id);
                
                return (
                  <Card key={group.id}>
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleGroupExpansion(group.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between gap-4 p-4 cursor-pointer hover-elevate" data-testid={`group-${group.id}`}>
                          <div className="flex items-center gap-3">
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            <RouteColorBadge routeName={group.name} color={group.color} />
                            <Badge variant="secondary">{groupRoutes.length} {groupRoutes.length === 1 ? 'route' : 'routes'}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroup(group);
                                setIsEditGroupDialogOpen(true);
                              }}
                              data-testid={`button-edit-group-${group.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroup(group);
                                setIsDeleteGroupDialogOpen(true);
                              }}
                              data-testid={`button-delete-group-${group.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-2">
                          {groupRoutes.map((route) => (
                            <Card key={route.id}>
                              <CardContent className="flex items-center justify-between p-4">
                                <div>
                                  <p className="font-medium">{route.name}</p>
                                  {route.description && (
                                    <p className="text-sm text-muted-foreground">{route.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    {route.routeType && <Badge variant="outline">{route.routeType}</Badge>}
                                    <span className="text-xs text-muted-foreground">{route.stopCount} stops</span>
                                    {!route.isActive && <Badge variant="secondary">Inactive</Badge>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={route.groupId || "none"}
                                    onValueChange={(value) => {
                                      updateRouteMutation.mutate({
                                        id: route.id,
                                        data: { groupId: value === "none" ? null : value } as InsertRoute
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-[140px] h-8" data-testid={`select-route-group-${route.id}`}>
                                      <SelectValue placeholder="Assign group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No Group</SelectItem>
                                      {routeGroups?.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                          {group.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedRoute(route);
                                      setIsManageStopsDialogOpen(true);
                                    }}
                                    data-testid={`button-manage-stops-${route.id}`}
                                  >
                                    <List className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditRouteClick(route)}
                                    data-testid={`button-edit-route-${route.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteRouteClick(route)}
                                    data-testid={`button-delete-route-${route.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}

              {/* Ungrouped Routes */}
              {groupedRoutes.ungrouped && groupedRoutes.ungrouped.length > 0 && (
                <Card>
                  <Collapsible
                    defaultOpen={true}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between gap-4 p-4 cursor-pointer hover-elevate" data-testid="ungrouped-routes">
                        <div className="flex items-center gap-3">
                          <ChevronDown className="h-4 w-4" />
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Ungrouped Routes</span>
                          <Badge variant="secondary">{groupedRoutes.ungrouped.length} {groupedRoutes.ungrouped.length === 1 ? 'route' : 'routes'}</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-2">
                        {groupedRoutes.ungrouped.map((route) => (
                          <Card key={route.id}>
                            <CardContent className="flex items-center justify-between p-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  {route.color && <RouteColorBadge routeName={route.name} color={route.color} />}
                                  {!route.color && <p className="font-medium">{route.name}</p>}
                                </div>
                                {route.description && (
                                  <p className="text-sm text-muted-foreground">{route.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {route.routeType && <Badge variant="outline">{route.routeType}</Badge>}
                                  <span className="text-xs text-muted-foreground">{route.stopCount} stops</span>
                                  {!route.isActive && <Badge variant="secondary">Inactive</Badge>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={route.groupId || "none"}
                                  onValueChange={(value) => {
                                    updateRouteMutation.mutate({
                                      id: route.id,
                                      data: { groupId: value === "none" ? null : value } as InsertRoute
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[140px] h-8" data-testid={`select-route-group-${route.id}`}>
                                    <SelectValue placeholder="Assign group" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Group</SelectItem>
                                    {routeGroups?.map((group) => (
                                      <SelectItem key={group.id} value={group.id}>
                                        {group.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedRoute(route);
                                    setIsManageStopsDialogOpen(true);
                                  }}
                                  data-testid={`button-manage-stops-${route.id}`}
                                >
                                  <List className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditRouteClick(route)}
                                  data-testid={`button-edit-route-${route.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteRouteClick(route)}
                                  data-testid={`button-delete-route-${route.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

              {/* Create New Group Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsCreateGroupDialogOpen(true)}
                data-testid="button-create-group"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Group
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stops" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isCreateStopDialogOpen} onOpenChange={setIsCreateStopDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-stop">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stop
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Stop</DialogTitle>
                  <DialogDescription>
                    Add a reusable stop location
                  </DialogDescription>
                </DialogHeader>
                <Form {...createStopForm}>
                  <form onSubmit={createStopForm.handleSubmit(handleCreateStopSubmit)} className="space-y-4">
                    <FormField
                      control={createStopForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stop Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="E.g., Main Street & Oak Ave"
                              data-testid="input-stop-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createStopForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Full street address"
                              data-testid="input-stop-address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createStopForm.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                placeholder="e.g., 40.7128"
                                data-testid="input-stop-latitude"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createStopForm.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                placeholder="e.g., -74.0060"
                                data-testid="input-stop-longitude"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      GPS coordinates are optional and reserved for future vehicle tracking integration
                    </p>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateStopDialogOpen(false)}
                        data-testid="button-cancel-stop"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createStopMutation.isPending}
                        data-testid="button-submit-stop"
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
            columns={stopColumns}
            data={stops || []}
            isLoading={stopsLoading}
            emptyMessage="No stops found. Create your first stop to get started."
          />
        </TabsContent>
      </Tabs>

      {/* Create Group Dialog */}
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Route Group</DialogTitle>
            <DialogDescription>
              Create a group to organize related routes with a shared color
            </DialogDescription>
          </DialogHeader>
          <Form {...createGroupForm}>
            <form onSubmit={createGroupForm.handleSubmit(handleCreateGroupSubmit)} className="space-y-4">
              <FormField
                control={createGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g., Morning Routes"
                        data-testid="input-group-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createGroupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this group's purpose"
                        data-testid="input-group-description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createGroupForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Color</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-group-color">
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tan">Tan</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="yellow">Yellow</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="gray">Gray</SelectItem>
                        <SelectItem value="teal">Teal</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="pink">Pink</SelectItem>
                        <SelectItem value="maroon">Maroon</SelectItem>
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
                  onClick={() => setIsCreateGroupDialogOpen(false)}
                  data-testid="button-cancel-group"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createGroupMutation.isPending}
                  data-testid="button-submit-group"
                >
                  {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Route Dialog */}
      <Dialog open={isEditRouteDialogOpen} onOpenChange={setIsEditRouteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>
              Update the route information
            </DialogDescription>
          </DialogHeader>
          <Form {...editRouteForm}>
            <form onSubmit={editRouteForm.handleSubmit(handleEditRouteSubmit)} className="space-y-4">
              <FormField
                control={editRouteForm.control}
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
                control={editRouteForm.control}
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
                control={editRouteForm.control}
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

              <FormField
                control={editRouteForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Label (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-route-color">
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tan">Tan</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="yellow">Yellow</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="gray">Gray</SelectItem>
                        <SelectItem value="teal">Teal</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="pink">Pink</SelectItem>
                        <SelectItem value="maroon">Maroon</SelectItem>
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
                  onClick={() => setIsEditRouteDialogOpen(false)}
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

      {/* Delete Route Dialog */}
      <AlertDialog open={isDeleteRouteDialogOpen} onOpenChange={setIsDeleteRouteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRoute?.name}"? This will remove all stop assignments from this route. The stops themselves will remain available for other routes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRouteConfirm}
              disabled={deleteRouteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteRouteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Route Stops Dialog */}
      <Dialog open={isManageStopsDialogOpen} onOpenChange={setIsManageStopsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Stops for {selectedRoute?.name}</DialogTitle>
            <DialogDescription>
              Add, remove, and reorder stops on this route
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Stops */}
            <div>
              <h3 className="text-sm font-medium mb-3">Current Stops</h3>
              {routeStopsLoading ? (
                <p className="text-sm text-muted-foreground">Loading stops...</p>
              ) : routeStops && routeStops.length > 0 ? (
                <div className="space-y-2">
                  {routeStops.map((routeStop, index) => (
                    <Card key={routeStop.routeStopId}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{routeStop.name}</p>
                            <p className="text-sm text-muted-foreground">{routeStop.address}</p>
                            {routeStop.scheduledTime && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {routeStop.scheduledTime}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveStopUp(index)}
                            disabled={index === 0}
                            data-testid={`button-move-up-${routeStop.routeStopId}`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoveStopDown(index)}
                            disabled={index === routeStops.length - 1}
                            data-testid={`button-move-down-${routeStop.routeStopId}`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveStopFromRoute(routeStop.routeStopId)}
                            data-testid={`button-remove-stop-${routeStop.routeStopId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stops on this route yet</p>
              )}
            </div>

            {/* Available Stops */}
            {availableStops.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Add Stops</h3>
                <div className="space-y-2">
                  {availableStops.map((stop) => (
                    <Card key={stop.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{stop.name}</p>
                          <p className="text-sm text-muted-foreground">{stop.address}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddStopToRoute(stop.id)}
                          data-testid={`button-add-stop-${stop.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setIsManageStopsDialogOpen(false)}
              data-testid="button-close-manage-stops"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stop Dialog */}
      <Dialog open={isEditStopDialogOpen} onOpenChange={setIsEditStopDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stop</DialogTitle>
            <DialogDescription>
              Update the stop information
            </DialogDescription>
          </DialogHeader>
          <Form {...editStopForm}>
            <form onSubmit={editStopForm.handleSubmit(handleEditStopSubmit)} className="space-y-4">
              <FormField
                control={editStopForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stop Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g., Main Street & Oak Ave"
                        data-testid="input-edit-stop-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editStopForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Full street address"
                        data-testid="input-edit-stop-address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editStopForm.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 40.7128"
                          data-testid="input-edit-stop-latitude"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editStopForm.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., -74.0060"
                          data-testid="input-edit-stop-longitude"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                GPS coordinates are optional and reserved for future vehicle tracking integration
              </p>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditStopDialogOpen(false)}
                  data-testid="button-cancel-edit-stop"
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

      {/* Delete Stop Dialog */}
      <AlertDialog open={isDeleteStopDialogOpen} onOpenChange={setIsDeleteStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedStop?.name}"? This will remove this stop from all routes that use it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-stop">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStopConfirm}
              disabled={deleteStopMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-stop"
            >
              {deleteStopMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Route Group Dialog */}
      <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Route Group</DialogTitle>
            <DialogDescription>
              Update the group information and color
            </DialogDescription>
          </DialogHeader>
          <Form {...editGroupForm}>
            <form onSubmit={editGroupForm.handleSubmit(handleEditGroupSubmit)} className="space-y-4">
              <FormField
                control={editGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g., Morning Routes"
                        data-testid="input-edit-group-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editGroupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this group's purpose"
                        data-testid="input-edit-group-description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editGroupForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Color</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-group-color">
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tan">Tan</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="yellow">Yellow</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="gray">Gray</SelectItem>
                        <SelectItem value="teal">Teal</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="pink">Pink</SelectItem>
                        <SelectItem value="maroon">Maroon</SelectItem>
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
                  onClick={() => setIsEditGroupDialogOpen(false)}
                  data-testid="button-cancel-edit-group"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateGroupMutation.isPending}
                  data-testid="button-save-group"
                >
                  {updateGroupMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Route Group Dialog */}
      <AlertDialog open={isDeleteGroupDialogOpen} onOpenChange={setIsDeleteGroupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedGroup?.name}"? Routes in this group will remain but lose their group assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-group">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroupConfirm}
              disabled={deleteGroupMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-group"
            >
              {deleteGroupMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
