import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudentSchema, updateStudentSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  UserCircle, 
  MapPin, 
  Route as RouteIcon, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  Plus,
  X,
  Edit,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EnrichedStudent {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  parentName: string;
  parentEmail: string | null;
  assignedRouteId: string | null;
  routeName: string | null;
  pickupStopId: string | null;
  dropoffStopId: string | null;
  pickupStop: any;
  dropoffStop: any;
}

interface Route {
  id: string;
  name: string;
}

interface Stop {
  id: string;
  name: string;
  scheduledTime: string;
}

// Form schema for create student - uses insertStudentSchema but makes guardianPhones required
const createStudentFormSchema = insertStudentSchema.extend({
  guardianPhones: z.array(
    z.string()
      .refine(
        (val) => {
          const digits = val.replace(/\D/g, '');
          return digits.length === 10;
        },
        { message: "Phone number must be exactly 10 digits" }
      )
  ).min(1, "At least one guardian phone is required"),
});

type CreateStudentFormValues = z.infer<typeof createStudentFormSchema>;

// Form schema for edit student - uses updateStudentSchema
const editStudentFormSchema = updateStudentSchema.extend({
  guardianPhones: z.array(
    z.string()
      .refine(
        (val) => {
          const digits = val.replace(/\D/g, '');
          return digits.length === 10;
        },
        { message: "Phone number must be exactly 10 digits" }
      )
  ).min(1, "At least one guardian phone is required"),
});

type EditStudentFormValues = z.infer<typeof editStudentFormSchema>;

export default function AdminStudentsPage() {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<EnrichedStudent | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [selectedPickupStop, setSelectedPickupStop] = useState<string>("");
  const [selectedDropoffStop, setSelectedDropoffStop] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [guardianPhones, setGuardianPhones] = useState<string[]>([""]);
  const [editGuardianPhones, setEditGuardianPhones] = useState<string[]>([""]);

  const createForm = useForm<CreateStudentFormValues>({
    resolver: zodResolver(createStudentFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      guardianPhones: [""],
      grade: "",
      notes: "",
    },
  });

  const editForm = useForm<EditStudentFormValues>({
    resolver: zodResolver(editStudentFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      guardianPhones: [""],
      grade: "",
      notes: "",
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery<EnrichedStudent[]>({
    queryKey: ["/api/admin/students"],
  });

  const { data: routes } = useQuery<Route[]>({
    queryKey: ["/api/admin/routes"],
  });

  const { data: stops } = useQuery<Stop[]>({
    queryKey: ["/api/admin/stops", selectedRoute],
    enabled: !!selectedRoute,
    queryFn: async () => {
      const response = await fetch(`/api/admin/routes/${selectedRoute}/stops`);
      if (!response.ok) throw new Error("Failed to fetch stops");
      return response.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      studentId,
      routeId,
      pickupStopId,
      dropoffStopId,
    }: {
      studentId: string;
      routeId: string | null;
      pickupStopId: string | null;
      dropoffStopId: string | null;
    }) => {
      return await apiRequest(
        "PATCH",
        `/api/admin/students/${studentId}/assign-route`,
        {
          assignedRouteId: routeId,
          pickupStopId,
          dropoffStopId,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      handleCloseDialog();
      toast({
        title: "Success",
        description: "Student route assignment updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route assignment",
        variant: "destructive",
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return await apiRequest("DELETE", `/api/admin/students/${studentId}/unassign-route`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      toast({
        title: "Success",
        description: "Student unassigned from route",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unassign student",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateStudentFormValues) => {
      return await apiRequest("POST", "/api/admin/students", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setGuardianPhones([""]);
      toast({
        title: "Success",
        description: "Student created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create student",
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ studentId, data }: { studentId: string; data: EditStudentFormValues }) => {
      return await apiRequest("PATCH", `/api/admin/students/${studentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      editForm.reset();
      setEditGuardianPhones([""]);
      toast({
        title: "Success",
        description: "Student updated successfully",
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

  const handleCreateStudent = (data: CreateStudentFormValues) => {
    createMutation.mutate(data);
  };

  const handleEditStudent = (data: EditStudentFormValues) => {
    if (!editingStudent) return;
    editMutation.mutate({ studentId: editingStudent.id, data });
  };

  const handleOpenEditDialog = (student: any) => {
    setEditingStudent(student);
    setEditGuardianPhones(student.guardianPhones || [""]);
    editForm.reset({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      guardianPhones: student.guardianPhones || [""],
      grade: student.grade || "",
      notes: student.notes || "",
      dateOfBirth: student.dateOfBirth || "",
      heightInches: student.heightInches || undefined,
      race: student.race || "",
      gender: student.gender || "",
      photoUrl: student.photoUrl || "",
      medicalNotes: student.medicalNotes || "",
      specialNeeds: student.specialNeeds || "",
      emergencyContactName: student.emergencyContactName || "",
      emergencyContactPhone: student.emergencyContactPhone || "",
      emergencyContactRelation: student.emergencyContactRelation || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleAddGuardianPhone = () => {
    setGuardianPhones([...guardianPhones, ""]);
    const currentPhones = createForm.getValues("guardianPhones");
    createForm.setValue("guardianPhones", [...currentPhones, ""]);
  };

  const handleRemoveGuardianPhone = (index: number) => {
    if (guardianPhones.length <= 1) return;
    const newPhones = guardianPhones.filter((_, i) => i !== index);
    setGuardianPhones(newPhones);
    createForm.setValue("guardianPhones", newPhones);
  };

  const handleAddEditGuardianPhone = () => {
    setEditGuardianPhones([...editGuardianPhones, ""]);
    const currentPhones = editForm.getValues("guardianPhones");
    editForm.setValue("guardianPhones", [...currentPhones, ""]);
  };

  const handleRemoveEditGuardianPhone = (index: number) => {
    if (editGuardianPhones.length <= 1) return;
    const newPhones = editGuardianPhones.filter((_, i) => i !== index);
    setEditGuardianPhones(newPhones);
    editForm.setValue("guardianPhones", newPhones);
  };

  const handleOpenDialog = (student: EnrichedStudent) => {
    setSelectedStudent(student);
    setSelectedRoute(student.assignedRouteId || "");
    setSelectedPickupStop(student.pickupStopId || "");
    setSelectedDropoffStop(student.dropoffStopId || "");
  };

  const handleCloseDialog = () => {
    setSelectedStudent(null);
    setSelectedRoute("");
    setSelectedPickupStop("");
    setSelectedDropoffStop("");
  };

  const handleSave = () => {
    if (!selectedStudent) return;

    // If route is cleared, use unassign endpoint
    if (!selectedRoute) {
      unassignMutation.mutate(selectedStudent.id);
      handleCloseDialog();
      return;
    }

    assignMutation.mutate({
      studentId: selectedStudent.id,
      routeId: selectedRoute,
      pickupStopId: selectedPickupStop || null,
      dropoffStopId: selectedDropoffStop || null,
    });
  };

  const handleUnassign = (studentId: string) => {
    unassignMutation.mutate(studentId);
  };

  const filteredStudents = students?.filter((student) => {
    if (filter === "assigned") return !!student.assignedRouteId;
    if (filter === "unassigned") return !student.assignedRouteId;
    return true;
  });

  const unassignedCount = students?.filter((s) => !s.assignedRouteId).length || 0;

  if (studentsLoading) {
    return <AdminStudentsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Student Management</h1>
          <p className="text-sm text-muted-foreground">
            Create students and manage route assignments
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-student">
          <Plus className="h-4 w-4 mr-2" />
          Create Student
        </Button>
      </div>

      {unassignedCount > 0 && (
        <Alert className="border-warning/50 bg-warning/5" data-testid="alert-unassigned-students">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <span className="font-semibold">{unassignedCount}</span> student{unassignedCount !== 1 ? 's' : ''} not assigned to any route
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          data-testid="filter-all"
        >
          All Students ({students?.length || 0})
        </Button>
        <Button
          variant={filter === "assigned" ? "default" : "outline"}
          onClick={() => setFilter("assigned")}
          data-testid="filter-assigned"
        >
          Assigned ({students?.filter((s) => s.assignedRouteId).length || 0})
        </Button>
        <Button
          variant={filter === "unassigned" ? "default" : "outline"}
          onClick={() => setFilter("unassigned")}
          data-testid="filter-unassigned"
        >
          Unassigned ({unassignedCount})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredStudents?.map((student) => (
          <Card key={student.id} className="hover-elevate" data-testid={`card-student-${student.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {student.firstName[0]}
                      {student.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">
                      {student.firstName} {student.lastName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground truncate">
                      {student.parentName}
                      {student.grade && ` • Grade ${student.grade}`}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {student.assignedRouteId ? (
                    <Badge className="bg-success/10 text-success border-success/20" data-testid={`badge-assigned-${student.id}`}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Assigned
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-unassigned-${student.id}`}>
                      <XCircle className="h-3 w-3 mr-1" />
                      Unassigned
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {student.assignedRouteId ? (
                <>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                    <RouteIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Route</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {student.routeName}
                      </p>
                    </div>
                  </div>
                  
                  {student.pickupStop && (
                    <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                      <MapPin className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Pickup</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {student.pickupStop.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.pickupStop.scheduledTime}
                        </p>
                      </div>
                    </div>
                  )}

                  {student.dropoffStop && (
                    <div className="flex items-start gap-3 p-3 rounded-md bg-accent/50">
                      <MapPin className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Dropoff</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {student.dropoffStop.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.dropoffStop.scheduledTime}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleOpenDialog(student)}
                      data-testid={`button-edit-${student.id}`}
                    >
                      Edit Assignment
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenEditDialog(student)}
                      data-testid={`button-edit-info-${student.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleUnassign(student.id)}
                      disabled={unassignMutation.isPending}
                      data-testid={`button-unassign-${student.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Not assigned to any route
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => handleOpenDialog(student)}
                      size="sm"
                      data-testid={`button-assign-${student.id}`}
                    >
                      Assign to Route
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditDialog(student)}
                      data-testid={`button-edit-info-${student.id}`}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Info
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStudents?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Students Found</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "assigned"
                ? "No students are currently assigned to routes"
                : filter === "unassigned"
                ? "All students have been assigned to routes"
                : "No students registered in the system"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Student Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-student" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Student</DialogTitle>
            <DialogDescription>
              Add a student with guardian contact information. The system will automatically link parents with matching phone numbers.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateStudent)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-first-name" placeholder="Enter first name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-last-name" placeholder="Enter last name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-grade" placeholder="e.g., K, 1, 2, 3..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Guardian Phone Numbers *</FormLabel>
                <FormDescription>
                  Parents will be automatically linked when they register with these phone numbers
                </FormDescription>
                {guardianPhones.map((phone, index) => (
                  <FormField
                    key={index}
                    control={createForm.control}
                    name={`guardianPhones.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input 
                              {...field} 
                              data-testid={`input-guardian-phone-${index}`}
                              placeholder="(123) 456-7890" 
                              maxLength={14}
                              onChange={(e) => {
                                const formatted = formatPhoneNumber(e.target.value);
                                field.onChange(formatted);
                                const newPhones = [...guardianPhones];
                                newPhones[index] = formatted;
                                setGuardianPhones(newPhones);
                              }}
                            />
                          </FormControl>
                          {guardianPhones.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleRemoveGuardianPhone(index)}
                              data-testid={`button-remove-phone-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddGuardianPhone}
                  data-testid="button-add-guardian-phone"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Guardian Phone
                </Button>
              </div>

              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-notes" placeholder="Optional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    createForm.reset();
                    setGuardianPhones([""]);
                  }}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  Create Student
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-student" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
            <DialogDescription>
              Update student details and guardian contact information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditStudent)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-first-name" placeholder="Enter first name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-last-name" placeholder="Enter last name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-edit-grade" placeholder="e.g., K, 1, 2, 3..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Guardian Phone Numbers *</FormLabel>
                <FormDescription>
                  Parents will be automatically linked when they register with these phone numbers
                </FormDescription>
                {editGuardianPhones.map((phone, index) => (
                  <FormField
                    key={index}
                    control={editForm.control}
                    name={`guardianPhones.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input 
                              {...field} 
                              data-testid={`input-edit-guardian-phone-${index}`}
                              placeholder="(123) 456-7890" 
                              maxLength={14}
                              onChange={(e) => {
                                const formatted = formatPhoneNumber(e.target.value);
                                field.onChange(formatted);
                                const newPhones = [...editGuardianPhones];
                                newPhones[index] = formatted;
                                setEditGuardianPhones(newPhones);
                                // Sync all phones to the form
                                editForm.setValue("guardianPhones", newPhones);
                              }}
                            />
                          </FormControl>
                          {editGuardianPhones.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleRemoveEditGuardianPhone(index)}
                              data-testid={`button-edit-remove-phone-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddEditGuardianPhone}
                  data-testid="button-edit-add-guardian-phone"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Guardian Phone
                </Button>
              </div>

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-edit-notes" placeholder="Optional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingStudent(null);
                    editForm.reset();
                    setEditGuardianPhones([""]);
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={handleCloseDialog}>
        <DialogContent data-testid="dialog-assign-route">
          <DialogHeader>
            <DialogTitle>
              Assign Route for {selectedStudent?.firstName} {selectedStudent?.lastName}
            </DialogTitle>
            <DialogDescription>
              Select a route and pickup/dropoff stops
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="route">Route</Label>
              <Select 
                value={selectedRoute} 
                onValueChange={(value) => {
                  setSelectedRoute(value);
                  // Clear stop selections when route changes
                  if (value !== selectedRoute) {
                    setSelectedPickupStop("");
                    setSelectedDropoffStop("");
                  }
                }}
              >
                <SelectTrigger id="route" data-testid="select-route">
                  <SelectValue placeholder="Select a route" />
                </SelectTrigger>
                <SelectContent>
                  {routes?.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStudent?.assignedRouteId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedRoute("");
                    setSelectedPickupStop("");
                    setSelectedDropoffStop("");
                  }}
                  data-testid="button-clear-route"
                >
                  Clear Route Assignment
                </Button>
              )}
            </div>

            {selectedRoute && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pickup">Pickup Stop</Label>
                  <Select value={selectedPickupStop} onValueChange={setSelectedPickupStop}>
                    <SelectTrigger id="pickup" data-testid="select-pickup">
                      <SelectValue placeholder="Select pickup stop" />
                    </SelectTrigger>
                    <SelectContent>
                      {stops?.map((stop) => (
                        <SelectItem key={stop.id} value={stop.id}>
                          {stop.name} - {stop.scheduledTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dropoff">Dropoff Stop</Label>
                  <Select value={selectedDropoffStop} onValueChange={setSelectedDropoffStop}>
                    <SelectTrigger id="dropoff" data-testid="select-dropoff">
                      <SelectValue placeholder="Select dropoff stop" />
                    </SelectTrigger>
                    <SelectContent>
                      {stops?.map((stop) => (
                        <SelectItem key={stop.id} value={stop.id}>
                          {stop.name} - {stop.scheduledTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={assignMutation.isPending || unassignMutation.isPending}
                data-testid="button-save-assignment"
              >
                {selectedRoute ? "Save Assignment" : "Clear Assignment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminStudentsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
