import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, AlertTriangle, UserMinus, UserPlus, MapPin, HelpCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
}

interface ReportRouteIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeRunId: string;
  routeId?: string;
  students?: Student[];
}

const REQUEST_TYPES = [
  {
    value: "MISSING_STUDENT",
    label: "Student Missing",
    description: "A student who should be on this route isn't listed",
    icon: UserMinus,
  },
  {
    value: "UNEXPECTED_STUDENT",
    label: "Unexpected Student",
    description: "A student is here who shouldn't be on this route",
    icon: UserPlus,
  },
  {
    value: "WRONG_STOP",
    label: "Wrong Stop",
    description: "A student is assigned to the incorrect pickup/dropoff stop",
    icon: MapPin,
  },
  {
    value: "ROSTER_CLARIFICATION",
    label: "Roster Question",
    description: "I need clarification about the roster",
    icon: HelpCircle,
  },
];

export default function ReportRouteIssueDialog({
  open,
  onOpenChange,
  routeRunId,
  routeId,
  students = [],
}: ReportRouteIssueDialogProps) {
  const { toast } = useToast();
  const [requestType, setRequestType] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");

  const createRequestMutation = useMutation({
    mutationFn: async (data: {
      routeRunId: string;
      routeId?: string;
      requestType: string;
      studentId?: string;
      studentName?: string;
      description?: string;
      priority: string;
    }) => {
      return apiRequest("POST", "/api/route-requests", data);
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your route issue has been reported. Admin will review it shortly.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/route-requests/route-run", routeRunId] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/route-requests"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRequestType("");
    setStudentId("");
    setStudentName("");
    setDescription("");
    setPriority("normal");
  };

  const handleSubmit = () => {
    if (!requestType) {
      toast({
        title: "Select Issue Type",
        description: "Please select what type of issue you're reporting",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate({
      routeRunId,
      routeId,
      requestType,
      studentId: studentId || undefined,
      studentName: studentName || undefined,
      description: description || undefined,
      priority,
    });
  };

  const needsStudentSelection = ["WRONG_STOP"].includes(requestType);
  const needsStudentName = ["MISSING_STUDENT", "UNEXPECTED_STUDENT"].includes(requestType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report Route Issue
          </DialogTitle>
          <DialogDescription>
            Report a roster or route problem. Admin will review and respond.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">What's the issue?</Label>
            <RadioGroup
              value={requestType}
              onValueChange={setRequestType}
              className="space-y-2"
            >
              {REQUEST_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    requestType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setRequestType(type.value)}
                >
                  <RadioGroupItem
                    value={type.value}
                    id={type.value}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4 text-muted-foreground" />
                      <Label
                        htmlFor={type.value}
                        className="font-medium cursor-pointer"
                      >
                        {type.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {type.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {needsStudentSelection && students.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="student">Which student?</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="student" data-testid="select-student">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsStudentName && (
            <div className="space-y-2">
              <Label htmlFor="studentName">
                {requestType === "MISSING_STUDENT"
                  ? "Student's name (if known)"
                  : "Student's name"}
              </Label>
              <Input
                id="studentName"
                placeholder="Enter student name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                data-testid="input-student-name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={priority === "normal" ? "default" : "outline"}
                size="sm"
                onClick={() => setPriority("normal")}
                data-testid="button-priority-normal"
              >
                Normal
              </Button>
              <Button
                type="button"
                variant={priority === "urgent" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setPriority("urgent")}
                data-testid="button-priority-urgent"
              >
                Urgent
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createRequestMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!requestType || createRequestMutation.isPending}
            data-testid="button-submit-request"
          >
            {createRequestMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
