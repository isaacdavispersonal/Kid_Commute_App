// Driver vehicle inspection checklist
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const inspectionItems = [
  { id: "tiresOk", label: "Tires (pressure, tread, damage)" },
  { id: "lightsOk", label: "Lights (headlights, brake lights, signals)" },
  { id: "brakesOk", label: "Brakes (responsiveness, noise)" },
  { id: "fluidLevelsOk", label: "Fluid Levels (oil, coolant, windshield)" },
  { id: "cleanlinessOk", label: "Interior Cleanliness" },
];

export default function DriverInspection() {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    tiresOk: false,
    lightsOk: false,
    brakesOk: false,
    fluidLevelsOk: false,
    cleanlinessOk: false,
  });
  const [notes, setNotes] = useState("");

  const submitInspectionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/inspection", {
        ...checklist,
        notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Inspection Submitted",
        description: "Vehicle inspection has been recorded successfully",
      });
      setChecklist({
        tiresOk: false,
        lightsOk: false,
        brakesOk: false,
        fluidLevelsOk: false,
        cleanlinessOk: false,
      });
      setNotes("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit inspection. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [id]: checked }));
  };

  const allChecked = Object.values(checklist).every((value) => value === true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Vehicle Inspection</h1>
        <p className="text-sm text-muted-foreground">
          Complete your pre-trip vehicle safety check
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Inspection Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-4">
              {inspectionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 rounded-md bg-accent/50 hover-elevate"
                >
                  <Checkbox
                    id={item.id}
                    checked={checklist[item.id]}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(item.id, checked as boolean)
                    }
                    data-testid={`checkbox-${item.id}`}
                  />
                  <label
                    htmlFor={item.id}
                    className="flex-1 text-sm font-medium cursor-pointer"
                  >
                    {item.label}
                  </label>
                  {checklist[item.id] && (
                    <CheckCircle className="h-5 w-5 text-success" />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </label>
              <Textarea
                id="notes"
                placeholder="Report any issues or concerns..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                data-testid="input-notes"
              />
            </div>

            <Button
              onClick={() => submitInspectionMutation.mutate()}
              disabled={!allChecked || submitInspectionMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-submit-inspection"
            >
              {submitInspectionMutation.isPending
                ? "Submitting..."
                : "Submit Inspection"}
            </Button>

            {!allChecked && (
              <p className="text-sm text-muted-foreground text-center">
                Please complete all checklist items before submitting
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
