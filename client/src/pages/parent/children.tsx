import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, UserCircle, Route as RouteIcon, MapPin } from "lucide-react";
import type { Student } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface StudentFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  grade: string;
  heightInches: string;
  race: string;
  gender: string;
  medicalNotes: string;
  specialNeeds: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  notes: string;
}

interface EnrichedStudent extends Student {
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
}

const emptyFormData: StudentFormData = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  grade: "",
  heightInches: "",
  race: "",
  gender: "",
  medicalNotes: "",
  specialNeeds: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  notes: "",
};

export default function ChildrenPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<StudentFormData>(emptyFormData);

  const { data: students, isLoading } = useQuery<EnrichedStudent[]>({
    queryKey: ["/api/parent/students"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      const payload = {
        ...data,
        heightInches: data.heightInches ? parseInt(data.heightInches) : null,
      };
      return await apiRequest("POST", "/api/parent/students", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setIsDialogOpen(false);
      setFormData(emptyFormData);
      toast({
        title: "Success",
        description: "Child profile created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create child profile",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StudentFormData }) => {
      const payload = {
        ...data,
        heightInches: data.heightInches ? parseInt(data.heightInches) : null,
      };
      return await apiRequest("PATCH", `/api/parent/students/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setIsDialogOpen(false);
      setEditingStudent(null);
      setFormData(emptyFormData);
      toast({
        title: "Success",
        description: "Child profile updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update child profile",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/parent/students/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      setDeleteStudent(null);
      toast({
        title: "Success",
        description: "Child profile deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete child profile",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        dateOfBirth: student.dateOfBirth || "",
        grade: student.grade || "",
        heightInches: student.heightInches?.toString() || "",
        race: student.race || "",
        gender: student.gender || "",
        medicalNotes: student.medicalNotes || "",
        specialNeeds: student.specialNeeds || "",
        emergencyContactName: student.emergencyContactName || "",
        emergencyContactPhone: student.emergencyContactPhone || "",
        emergencyContactRelation: student.emergencyContactRelation || "",
        notes: student.notes || "",
      });
    } else {
      setEditingStudent(null);
      setFormData(emptyFormData);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName) {
      toast({
        title: "Validation Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <ChildrenPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Children</h1>
          <p className="text-sm text-muted-foreground">
            Manage your children's profiles
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-child">
              <Plus className="h-4 w-4 mr-2" />
              Add Child
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? "Edit Child Profile" : "Add New Child"}
              </DialogTitle>
              <DialogDescription>
                Enter your child's information below
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      data-testid="input-date-of-birth"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input
                      id="grade"
                      placeholder="e.g., 5th"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      data-testid="input-grade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heightInches">Height (inches)</Label>
                    <Input
                      id="heightInches"
                      type="number"
                      placeholder="e.g., 54"
                      value={formData.heightInches}
                      onChange={(e) => setFormData({ ...formData, heightInches: e.target.value })}
                      data-testid="input-height"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Input
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      data-testid="input-gender"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="race">Race/Ethnicity</Label>
                    <Input
                      id="race"
                      value={formData.race}
                      onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                      data-testid="input-race"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Medical Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="medicalNotes">Medical Notes (allergies, conditions, etc.)</Label>
                  <Textarea
                    id="medicalNotes"
                    placeholder="List any allergies, medical conditions, or medications..."
                    value={formData.medicalNotes}
                    onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                    rows={3}
                    data-testid="input-medical-notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialNeeds">Special Needs/Accommodations</Label>
                  <Textarea
                    id="specialNeeds"
                    placeholder="List any special needs or accommodations..."
                    value={formData.specialNeeds}
                    onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                    rows={3}
                    data-testid="input-special-needs"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Emergency Contact</h3>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    placeholder="e.g., Jane Smith"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    data-testid="input-emergency-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      data-testid="input-emergency-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactRelation">Relationship</Label>
                    <Input
                      id="emergencyContactRelation"
                      placeholder="e.g., Grandmother"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                      data-testid="input-emergency-relation"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any other important information..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  data-testid="input-notes"
                />
              </div>

              <div className="flex justify-end gap-3">
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-child"
                >
                  {editingStudent ? "Update Child" : "Add Child"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {students && students.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {students.map((student) => (
            <Card key={student.id} className="hover-elevate" data-testid={`card-child-${student.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {student.firstName[0]}
                        {student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {student.firstName} {student.lastName}
                      </CardTitle>
                      {student.grade && (
                        <p className="text-sm text-muted-foreground">
                          Grade {student.grade}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(student)}
                      data-testid={`button-edit-child-${student.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteStudent(student)}
                      data-testid={`button-delete-child-${student.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Route Assignment Section */}
                {student.assignedRouteId ? (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                      <RouteIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Assigned Route</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {student.routeName || "Unknown Route"}
                        </p>
                      </div>
                    </div>
                    
                    {student.pickupStop && (
                      <div className="flex items-start gap-3 p-3 rounded-md bg-success/5 border border-success/20">
                        <MapPin className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Pickup Location</p>
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
                      <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                        <MapPin className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Dropoff Location</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {student.dropoffStop.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.dropoffStop.scheduledTime}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3" />
                  </>
                ) : (
                  <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
                    <p className="text-sm text-warning flex items-center gap-2">
                      <RouteIcon className="h-4 w-4" />
                      Not yet assigned to a route
                    </p>
                  </div>
                )}

                {student.dateOfBirth && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="text-sm">{student.dateOfBirth}</p>
                  </div>
                )}
                {student.medicalNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Medical Notes</p>
                    <p className="text-sm">{student.medicalNotes}</p>
                  </div>
                )}
                {student.emergencyContactName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Emergency Contact</p>
                    <p className="text-sm">
                      {student.emergencyContactName}
                      {student.emergencyContactRelation && ` (${student.emergencyContactRelation})`}
                    </p>
                    {student.emergencyContactPhone && (
                      <p className="text-sm text-muted-foreground">
                        {student.emergencyContactPhone}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Children Registered</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding your first child's profile
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-child">
              <Plus className="h-4 w-4 mr-2" />
              Add Child
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStudent} onOpenChange={() => setDeleteStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">
                {deleteStudent?.firstName} {deleteStudent?.lastName}'s
              </span>{" "}
              profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStudent && deleteMutation.mutate(deleteStudent.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChildrenPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
