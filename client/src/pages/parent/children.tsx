import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MedicalBadge } from "@/components/medical-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, AlertCircle, CheckCircle, Phone, UserCircle, MapPin, Route as RouteIcon, Edit, Plus, X, XCircle, Calendar, Navigation, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateStudentSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import type { z } from "zod";

interface EnrichedStudent {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  guardianPhones: string[];
  heightInches?: number | null;
  race?: string | null;
  photoUrl?: string | null;
  allergies?: string | null;
  medicalNotes?: string | null;
  specialNeeds?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  notes?: string | null;
  assignedRouteId: string | null;
  routeName?: string | null;
  pickupStop?: {
    id: string;
    name: string;
    scheduledTime: string;
  } | null;
  dropoffStop?: {
    id: string;
    name: string;
    scheduledTime: string;
  } | null;
  attendance?: {
    status: "riding" | "absent";
    markedByUserId: string;
    createdAt: string;
  } | null;
}

function EditStudentDialog({ student }: { student: EnrichedStudent }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof updateStudentSchema>>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: {
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      guardianPhones: student.guardianPhones && student.guardianPhones.length > 0 ? student.guardianPhones : [""],
      dateOfBirth: student.dateOfBirth || "",
      gender: student.gender || "",
      heightInches: student.heightInches || undefined,
      race: student.race || "",
      allergies: student.allergies || "",
      medicalNotes: student.medicalNotes || "",
      specialNeeds: student.specialNeeds || "",
      emergencyContactName: student.emergencyContactName || "",
      emergencyContactPhone: student.emergencyContactPhone || "",
      emergencyContactRelation: student.emergencyContactRelation || "",
      notes: student.notes || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateStudentSchema>) => {
      return await apiRequest("PATCH", `/api/parent/students/${student.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setOpen(false);
      toast({
        title: "Student Updated",
        description: "Student information has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update student",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof updateStudentSchema>) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="touch" variant="outline" data-testid={`button-edit-student-${student.id}`}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student Information</DialogTitle>
          <DialogDescription>
            Update information for {student.firstName} {student.lastName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Guardian Phones Section */}
            <div className="space-y-3">
              <FormLabel>Guardian Phone Numbers</FormLabel>
              <p className="text-sm text-muted-foreground">
                Phone numbers used to link your account to your children
              </p>
              {form.watch("guardianPhones").map((_, index) => (
                <div key={index} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`guardianPhones.${index}`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input 
                            {...field} 
                            type="tel" 
                            placeholder="e.g., +1 (555) 123-4567"
                            data-testid={`input-guardian-phone-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("guardianPhones").length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-touch"
                      onClick={() => {
                        const phones = form.getValues("guardianPhones");
                        form.setValue("guardianPhones", phones.filter((_, i) => i !== index));
                      }}
                      data-testid={`button-remove-phone-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                size="touch"
                variant="outline"
                onClick={() => {
                  const phones = form.getValues("guardianPhones");
                  form.setValue("guardianPhones", [...phones, ""]);
                }}
                data-testid="button-add-phone"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Phone
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-date-of-birth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-gender" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heightInches"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (inches)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value || ""} 
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 48" 
                        data-testid="input-height-inches" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="race"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Race/Ethnicity</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-race" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-emergency-contact-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} type="tel" data-testid="input-emergency-contact-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactRelation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Relation</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., Grandmother" data-testid="input-emergency-contact-relation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="allergies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allergies</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={2} placeholder="List any food, medication, or environmental allergies..." data-testid="input-allergies" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={3} placeholder="Any medical conditions or important health information..." data-testid="input-medical-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialNeeds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Needs</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={3} placeholder="Any special accommodations or needs..." data-testid="input-special-needs" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={2} placeholder="Any other relevant information..." data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface RouteAssignment {
  id: string;
  routeId: string;
  routeName: string;
  routeType: string | null;
  pickupStopId: string | null;
  dropoffStopId: string | null;
}

function ManageRoutesSection({ student }: { student: EnrichedStudent }) {
  const { toast } = useToast();

  // Fetch route assignments for this student
  const { data: routeAssignments, isLoading, isError, refetch } = useQuery<RouteAssignment[]>({
    queryKey: ["/api/parent/students", student.id, "routes"],
    queryFn: async () => {
      const response = await fetch(`/api/parent/students/${student.id}/routes`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch routes");
      return response.json();
    },
  });

  // Mutation to remove a route assignment
  const removeRouteMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return await apiRequest("DELETE", `/api/parent/students/${student.id}/routes/${assignmentId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students", student.id, "routes"] });
      toast({
        title: "Route Removed",
        description: "The route assignment has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove route assignment",
        variant: "destructive",
      });
    },
  });

  const getRouteTypeBadge = (routeType: string | null) => {
    if (!routeType) return null;
    switch (routeType) {
      case "MORNING":
        return <Badge variant="outline" className="text-xs">AM</Badge>;
      case "AFTERNOON":
        return <Badge variant="outline" className="text-xs">PM</Badge>;
      case "EXTRA":
        return <Badge variant="outline" className="text-xs">Extra</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Assigned Routes</p>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-destructive font-medium">Failed to load routes</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => refetch()}
            className="h-auto p-0 text-xs text-destructive"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!routeAssignments || routeAssignments.length === 0) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
        <RouteIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            Not assigned to any routes yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Assigned Routes</p>
      <div className="space-y-2">
        {routeAssignments.map((assignment) => (
          <div
            key={assignment.id}
            className="flex items-center justify-between p-3 rounded-md bg-accent/50 gap-2"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <RouteIcon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm truncate">{assignment.routeName}</span>
              {getRouteTypeBadge(assignment.routeType)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRouteMutation.mutate(assignment.id)}
              disabled={removeRouteMutation.isPending}
              data-testid={`button-remove-route-${assignment.id}`}
              className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RouteProgressSection({ studentId, pickupStopId }: { studentId: string; pickupStopId: string | null }) {
  const today = new Date().toISOString().split("T")[0];
  
  const { data: progress, isLoading, error } = useQuery({
    queryKey: ["/api/parent/student-progress", studentId, today],
    queryFn: async () => {
      const response = await fetch(`/api/parent/student-progress/${studentId}?date=${today}`);
      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }
      return response.json();
    },
    enabled: !!studentId && !!pickupStopId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!pickupStopId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
        <Navigation className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Loading route progress...</p>
        </div>
      </div>
    );
  }

  if (error || !progress) {
    return null; // Route hasn't started yet
  }

  const { stops, completedCount, totalStops, pickupStopIndex, currentStopIndex } = progress;
  
  // Calculate stops away from pickup
  let stopsAway = null;
  let statusMessage = "Route not started";
  
  if (currentStopIndex !== null && currentStopIndex < pickupStopIndex) {
    stopsAway = pickupStopIndex - currentStopIndex;
    statusMessage = `${stopsAway} stop${stopsAway !== 1 ? 's' : ''} away`;
  } else if (currentStopIndex !== null && currentStopIndex >= pickupStopIndex) {
    statusMessage = "Pickup completed";
  } else if (completedCount === 0) {
    statusMessage = "Route starting soon";
  } else {
    statusMessage = "En route";
  }

  const progressPercentage = totalStops > 0 ? (completedCount / totalStops) * 100 : 0;

  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
      <Navigation className="h-5 w-5 text-primary mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Route Progress</p>
          <Badge variant="outline" className="text-xs">
            {completedCount} / {totalStops} stops
          </Badge>
        </div>
        
        <Progress value={progressPercentage} className="h-2" />
        
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">{statusMessage}</p>
          {stopsAway !== null && stopsAway > 0 && (
            <Badge variant="default" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Approaching
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface Stop {
  id: string;
  name: string;
  address: string;
  scheduledTime?: string;
  stopOrder?: number;
}

interface ETAData {
  available: boolean;
  distanceMiles?: number;
  distanceFormatted?: string;
  etaMinutes?: number;
  etaFormatted?: string;
  vehicleName?: string;
  stopName?: string;
  message?: string;
}

function ETABanner({ students }: { students: EnrichedStudent[] }) {
  // Get ETA data for all students with pickup stops
  const studentsWithStops = students.filter(s => s.pickupStop && s.assignedRouteId);
  
  const etaQueries = useQuery({
    queryKey: ["/api/parent/eta-all", ...studentsWithStops.map(s => s.id)],
    queryFn: async () => {
      if (studentsWithStops.length === 0) return [];
      
      const results = await Promise.all(
        studentsWithStops.map(async (student) => {
          try {
            const response = await fetch(`/api/parent/eta/${student.id}`);
            if (!response.ok) return null;
            const data: ETAData = await response.json();
            return { student, eta: data };
          } catch {
            return null;
          }
        })
      );
      
      return results.filter(r => r !== null && r.eta.available);
    },
    enabled: studentsWithStops.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activeETAs = etaQueries.data || [];

  if (activeETAs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {activeETAs.map((item) => {
        if (!item) return null;
        const { student, eta } = item;
        return (
        <Alert key={student.id} className="border-primary/50 bg-primary/5">
          <Navigation className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-semibold">
            {student.firstName}'s Bus is on the way!
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Arrives in:</span>
                <Badge variant="default" className="text-sm">
                  {eta.etaFormatted}
                </Badge>
              </div>
              <div className="text-muted-foreground hidden sm:block">•</div>
              <div className="text-muted-foreground">
                {eta.distanceFormatted} away
              </div>
              <div className="text-muted-foreground hidden sm:block">•</div>
              <div className="text-muted-foreground">
                Stop: {eta.stopName}
              </div>
            </div>
          </AlertDescription>
        </Alert>
        );
      })}
    </div>
  );
}

function PickupStopSelector({ student }: { student: EnrichedStudent }) {
  const { toast } = useToast();
  const [selectedStopId, setSelectedStopId] = useState<string>(student.pickupStop?.id || "");

  // Fetch available stops for this route
  const { data: availableStops, isLoading } = useQuery<Stop[]>({
    queryKey: ["/api/parent/students", student.id, "available-stops"],
    queryFn: async () => {
      const response = await fetch(`/api/parent/students/${student.id}/available-stops`);
      if (!response.ok) throw new Error("Failed to fetch stops");
      return response.json();
    },
    enabled: !!student.assignedRouteId,
  });

  const updateStopMutation = useMutation({
    mutationFn: async (pickupStopId: string) => {
      return await apiRequest("PATCH", `/api/parent/students/${student.id}/pickup-stop`, {
        pickupStopId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      toast({
        title: "Success",
        description: "Pickup stop updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pickup stop",
        variant: "destructive",
      });
    },
  });

  const handleStopChange = (stopId: string) => {
    setSelectedStopId(stopId);
    updateStopMutation.mutate(stopId);
  };

  if (!student.assignedRouteId || isLoading) {
    return null;
  }

  if (!availableStops || availableStops.length === 0) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
      <MapPin className="h-5 w-5 text-primary mt-0.5" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">Pickup Stop</p>
        <Select
          value={selectedStopId}
          onValueChange={handleStopChange}
          disabled={updateStopMutation.isPending}
        >
          <SelectTrigger className="w-full" data-testid={`select-pickup-stop-${student.id}`}>
            <SelectValue placeholder="Select a pickup stop" />
          </SelectTrigger>
          <SelectContent>
            {availableStops.map((stop) => (
              <SelectItem key={stop.id} value={stop.id} data-testid={`option-stop-${stop.id}`}>
                {stop.name}
                {stop.scheduledTime && ` - ${stop.scheduledTime}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {student.pickupStop && (
          <p className="text-xs text-muted-foreground">
            Current: {student.pickupStop.name}
          </p>
        )}
      </div>
    </div>
  );
}

function StopChangeRequestHistory() {
  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/parent/stop-change-requests"],
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Your Stop Change Requests
        </CardTitle>
        <CardDescription>Track the status of your submitted requests</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map((req: any) => (
            <div 
              key={req.id} 
              className={`p-3 rounded-md border ${
                req.status === "pending" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" :
                req.status === "approved" ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" :
                "bg-muted/30"
              }`}
              data-testid={`item-request-${req.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{req.studentName}</span>
                    <span className="text-xs text-muted-foreground">
                      {req.requestType === "pickup" ? "Pickup" : "Dropoff"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span>{req.currentStopName}</span>
                    <span className="mx-1">→</span>
                    <span className="font-medium text-foreground">{req.requestedStopName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Effective: {formatDate(req.effectiveDate)} • Submitted: {formatDate(req.createdAt)}
                  </div>
                  {req.reviewNotes && req.status !== "pending" && (
                    <div className="text-xs mt-2 p-2 bg-muted rounded">
                      <span className="font-medium">Admin Note: </span>{req.reviewNotes}
                    </div>
                  )}
                </div>
                {getStatusBadge(req.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StopChangeRequestDialog({ student }: { student: EnrichedStudent }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<"pickup" | "dropoff">("pickup");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const { data: availableStops, isLoading: stopsLoading } = useQuery<Stop[]>({
    queryKey: ["/api/parent/students", student.id, "available-stops"],
    queryFn: async () => {
      const response = await fetch(`/api/parent/students/${student.id}/available-stops`);
      if (!response.ok) throw new Error("Failed to fetch stops");
      return response.json();
    },
    enabled: open && !!student.assignedRouteId,
  });

  const { data: existingRequests } = useQuery<any[]>({
    queryKey: ["/api/parent/stop-change-requests"],
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/parent/stop-change-requests", {
        studentId: student.id,
        routeId: student.assignedRouteId,
        requestType,
        currentStopId: requestType === "pickup" ? student.pickupStop?.id : student.dropoffStop?.id,
        requestedStopId: selectedStopId,
        effectiveDate,
        reason: reason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/stop-change-requests"] });
      setOpen(false);
      setSelectedStopId("");
      setEffectiveDate("");
      setReason("");
      toast({
        title: "Request Submitted",
        description: "Your stop change request has been submitted for approval",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  if (!student.assignedRouteId) {
    return null;
  }

  const currentStop = requestType === "pickup" ? student.pickupStop : student.dropoffStop;
  const hasPendingRequest = existingRequests?.some(
    (r) => r.studentId === student.id && r.status === "pending"
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-request-stop-change-${student.id}`}>
          <Calendar className="h-4 w-4 mr-2" />
          Request Stop Change
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Stop Change</DialogTitle>
          <DialogDescription>
            Submit a request to change {student.firstName}'s pickup or dropoff stop. 
            Requests require admin approval.
          </DialogDescription>
        </DialogHeader>
        
        {hasPendingRequest && (
          <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              You already have a pending request for this student.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Change Type</label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as "pickup" | "dropoff")}>
              <SelectTrigger data-testid="select-request-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Pickup Stop</SelectItem>
                <SelectItem value="dropoff">Dropoff Stop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Current Stop</label>
            <p className="text-sm text-muted-foreground">
              {currentStop?.name || "Not assigned"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Stop</label>
            {stopsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedStopId} onValueChange={setSelectedStopId}>
                <SelectTrigger data-testid="select-new-stop">
                  <SelectValue placeholder="Select a stop" />
                </SelectTrigger>
                <SelectContent>
                  {availableStops?.map((stop) => (
                    <SelectItem key={stop.id} value={stop.id} data-testid={`option-new-stop-${stop.id}`}>
                      {stop.name}
                      {stop.scheduledTime && ` - ${stop.scheduledTime}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Effective Date</label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={minDate}
              data-testid="input-effective-date"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (Optional)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you requesting this change?"
              data-testid="input-reason"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-request">
              Cancel
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!selectedStopId || !effectiveDate || submitMutation.isPending || hasPendingRequest}
              data-testid="button-submit-request"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceSection({ student }: { student: EnrichedStudent }) {
  const { toast } = useToast();
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);
  const [endDate, setEndDate] = useState("");
  const today = new Date().toISOString().split('T')[0];

  const setAttendanceMutation = useMutation({
    mutationFn: async (data: { status: "riding" | "absent"; endDate?: string }) => {
      return await apiRequest("POST", "/api/attendance", {
        studentId: student.id,
        date: today,
        endDate: data.endDate,
        status: data.status,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setShowDateRangeDialog(false);
      setEndDate("");
      toast({
        title: "Success",
        description: data.message || "Attendance updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    },
  });

  const handleAttendance = (status: "riding" | "absent") => {
    setAttendanceMutation.mutate({ status });
  };

  const handleAbsentClick = () => {
    setShowDateRangeDialog(true);
  };

  const handleConfirmAbsence = () => {
    setAttendanceMutation.mutate({ status: "absent", endDate: endDate || undefined });
  };

  return (
    <>
      <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
        <Calendar className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Today's Attendance</p>
          {student.attendance ? (
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant={student.attendance.status === "riding" ? "default" : "destructive"}
                data-testid={`badge-attendance-${student.id}`}
              >
                {student.attendance.status === "riding" ? "Riding" : "Absent"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleAttendance(
                    student.attendance!.status === "riding" ? "absent" : "riding"
                  )
                }
                disabled={setAttendanceMutation.isPending}
                data-testid={`button-toggle-attendance-${student.id}`}
              >
                Toggle
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 mt-2 flex-wrap">
              <p className="text-sm text-muted-foreground" data-testid={`text-riding-default-${student.id}`}>
                Riding (default)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAbsentClick}
                disabled={setAttendanceMutation.isPending}
                data-testid={`button-absent-${student.id}`}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Mark as Absent
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showDateRangeDialog} onOpenChange={setShowDateRangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Absent</DialogTitle>
            <DialogDescription>
              Mark {student.firstName} as absent for today or multiple days
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={today}
                disabled
                className="mt-1"
                data-testid="input-start-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date (Optional)</label>
              <p className="text-xs text-muted-foreground mb-1">
                Leave empty for today only, or select a future date for multiple days
              </p>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={today}
                placeholder="Select end date"
                className="mt-1"
                data-testid="input-end-date"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDateRangeDialog(false);
                  setEndDate("");
                }}
                data-testid="button-cancel-absence"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmAbsence}
                disabled={setAttendanceMutation.isPending}
                data-testid="button-confirm-absence"
              >
                {setAttendanceMutation.isPending ? "Marking..." : "Mark Absent"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ConnectChildrenPage() {
  const { toast } = useToast();
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: students, isLoading: studentsLoading } = useQuery<EnrichedStudent[]>({
    queryKey: ["/api/parent/students"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/parent/connect-children", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setHasAttemptedConnection(true);
      if (data.linkedCount > 0) {
        toast({
          title: "Success",
          description: data.message || "Children connected successfully",
        });
      }
    },
    onError: (error: any) => {
      if (error.requiresPhoneNumber) {
        toast({
          title: "Phone Number Required",
          description: "Please set up your phone number in your profile first",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to connect children",
          variant: "destructive",
        });
      }
    },
  });

  const handleConnect = () => {
    if (!user?.phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please set up your phone number in your profile first",
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate();
  };

  if (studentsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Connect Children</h1>
          <p className="text-sm text-muted-foreground">
            Link your account to your children using your phone number
          </p>
        </div>

        {/* Phone Number Status Card */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Number Status
          </CardTitle>
          <CardDescription>
            Your phone number must match the guardian phone number registered for your children
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.phoneNumber ? (
            <Alert className="border-success/50 bg-success/5">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertTitle className="text-success font-semibold">
                Phone Number Set
              </AlertTitle>
              <AlertDescription>
                <p className="text-sm mt-1">
                  Your phone number: <span className="font-medium">{user.phoneNumber}</span>
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive font-semibold">
                Phone Number Required
              </AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-3">
                <p className="text-sm">
                  You need to add your phone number to your profile before connecting children.
                  This phone number must match the guardian phone registered for your children by the administrator.
                </p>
                <div>
                  <Button asChild size="sm" variant="destructive" data-testid="button-go-to-profile">
                    <Link href="/profile">
                      <Phone className="h-4 w-4 mr-2" />
                      Set Up Phone Number
                    </Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleConnect}
              disabled={!user?.phoneNumber || connectMutation.isPending}
              className="flex-1"
              data-testid="button-connect-children"
            >
              <Link2 className="h-4 w-4 mr-2" />
              {connectMutation.isPending ? "Connecting..." : "Connect Children"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Children */}
      {students && students.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Connected Children ({students.length})</h2>
            <p className="text-sm text-muted-foreground">
              Children linked to your account via phone number
            </p>
          </div>

          <ETABanner students={students} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {students.map((student) => (
              <Card key={student.id} className="hover-elevate" data-testid={`card-student-${student.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {student.firstName[0]}
                        {student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {student.firstName} {student.lastName}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <MedicalBadge allergies={student.allergies} medicalNotes={student.medicalNotes} />
                      {student.assignedRouteId && (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Assigned
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <ManageRoutesSection student={student} />

                    {student.assignedRouteId && (
                      <>
                        <PickupStopSelector student={student} />
                        <StopChangeRequestDialog student={student} />
                      </>
                    )}

                    <AttendanceSection student={student} />
                  </div>
                  
                  <div className="pt-2">
                    <EditStudentDialog student={student} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Stop Change Request History */}
          <StopChangeRequestHistory />
        </div>
      )}

      {/* No Children Found After Connection Attempt */}
      {hasAttemptedConnection && students && students.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Matching Children Found</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm mb-3">
              No children were found with a guardian phone number matching <span className="font-medium">{user?.phoneNumber}</span>.
              Please contact the administrator to ensure your phone number is registered as a guardian for your children.
            </p>
            <p className="text-sm text-muted-foreground">
              Note: Children must be added by an administrator before they can be connected to your parent account.
            </p>
          </AlertDescription>
        </Alert>
      )}
      </div>
    
  );
}
