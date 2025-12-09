// Driver incident reporting form
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, FileText, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getLoginUrl } from "@/lib/config";

interface StudentWithRoute {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string | null;
  routeId: string;
  routeName: string;
}

interface RouteWithStudents {
  id: string;
  name: string;
  routeType?: string | null;
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    grade?: string | null;
  }>;
}

interface IncidentStudentsResponse {
  routes: RouteWithStudents[];
  students: StudentWithRoute[];
}

export default function DriverIncident() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "",
    location: "",
    studentId: "",
    routeId: "",
  });

  // Fetch students available for incident reporting
  const { data: incidentData, isLoading: isLoadingStudents } = useQuery<IncidentStudentsResponse>({
    queryKey: ["/api/driver/incident-students"],
  });

  const submitIncidentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/incident", {
        ...formData,
        studentId: formData.studentId || null,
        routeId: formData.routeId || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Incident Reported",
        description: "Your incident report has been submitted to administration",
      });
      setFormData({
        title: "",
        description: "",
        severity: "",
        location: "",
        studentId: "",
        routeId: "",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = getLoginUrl();
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit incident report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.severity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    submitIncidentMutation.mutate();
  };

  // Handle student selection - also set the route
  const handleStudentChange = (studentId: string) => {
    if (studentId === "none") {
      setFormData({ ...formData, studentId: "", routeId: "" });
      return;
    }
    const student = incidentData?.students.find(s => s.id === studentId);
    setFormData({
      ...formData,
      studentId,
      routeId: student?.routeId || "",
    });
  };

  const isFormValid =
    formData.title && formData.description && formData.severity;

  const students = incidentData?.students || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Report Incident</h1>
        <p className="text-sm text-muted-foreground">
          Submit a detailed incident report for administrative review
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incident Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Child Selection Dropdown */}
            <div className="space-y-2">
              <label htmlFor="student" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Child Involved (Optional)
              </label>
              {isLoadingStudents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading students...
                </div>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No students found on your assigned routes
                </p>
              ) : (
                <Select
                  value={formData.studentId || "none"}
                  onValueChange={handleStudentChange}
                >
                  <SelectTrigger data-testid="select-student">
                    <SelectValue placeholder="Select a child (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific child</SelectItem>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                        {student.grade ? ` (Grade ${student.grade})` : ""}
                        {" - "}{student.routeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Incident Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                placeholder="Brief description of the incident"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="severity" className="text-sm font-medium">
                Severity Level <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData({ ...formData, severity: value })
                }
              >
                <SelectTrigger data-testid="select-severity">
                  <SelectValue placeholder="Select severity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Minor issue</SelectItem>
                  <SelectItem value="medium">Medium - Moderate concern</SelectItem>
                  <SelectItem value="high">High - Serious issue</SelectItem>
                  <SelectItem value="critical">Critical - Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium">
                Location (Optional)
              </label>
              <Input
                id="location"
                placeholder="Where did this occur?"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                data-testid="input-location"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Detailed Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of what happened, including any relevant context..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={6}
                required
                data-testid="input-description"
              />
            </div>

            <Button
              type="submit"
              disabled={!isFormValid || submitIncidentMutation.isPending}
              className="w-full"
              size="lg"
              variant="destructive"
              data-testid="button-file-report"
            >
              <FileText className="h-5 w-5 mr-2" />
              {submitIncidentMutation.isPending
                ? "Filing Report..."
                : "File Incident Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
