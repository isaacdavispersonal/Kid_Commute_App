import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, CheckCircle2, AlertTriangle, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface VehicleChecklist {
  id: string;
  driverId: string;
  vehicleId: string;
  shiftId: string | null;
  checklistType: "PRE_TRIP" | "POST_TRIP";
  tiresOk: boolean;
  lightsOk: boolean;
  brakesOk: boolean;
  fluidLevelsOk: boolean;
  interiorCleanOk: boolean;
  emergencyEquipmentOk: boolean;
  mirrorsOk: boolean;
  seatsOk: boolean;
  odometerReading: number | null;
  fuelLevel: string | null;
  issues: string | null;
  createdAt: string;
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

const CHECKLIST_ITEMS = [
  { id: "tiresOk", label: "Tires (pressure, condition)" },
  { id: "lightsOk", label: "Lights (headlights, tail lights, signals)" },
  { id: "brakesOk", label: "Brakes (responsiveness)" },
  { id: "fluidLevelsOk", label: "Fluid Levels (oil, coolant, windshield)" },
  { id: "interiorCleanOk", label: "Interior Clean" },
  { id: "emergencyEquipmentOk", label: "Emergency Equipment (first aid, fire extinguisher)" },
  { id: "mirrorsOk", label: "Mirrors (clean, properly adjusted)" },
  { id: "seatsOk", label: "Seats (condition, seat belts)" },
];

export default function DriverChecklist() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [checklistType, setChecklistType] = useState<"PRE_TRIP" | "POST_TRIP">("PRE_TRIP");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [fuelLevel, setFuelLevel] = useState("FULL");
  const [issues, setIssues] = useState("");
  const [checkItems, setCheckItems] = useState<Record<string, boolean>>({});

  const { data: vehicles, isLoading: loadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: checklists, isLoading: loadingChecklists } = useQuery<VehicleChecklist[]>({
    queryKey: ["/api/driver/vehicle-checklists"],
  });

  useEffect(() => {
    // Initialize all checklist items to false
    const initial: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach(item => {
      initial[item.id] = false;
    });
    setCheckItems(initial);
  }, [showDialog]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/driver/vehicle-checklist", {
        vehicleId: selectedVehicle,
        shiftId: null,
        checklistType,
        ...checkItems,
        odometerReading: odometerReading ? parseInt(odometerReading) : null,
        fuelLevel,
        issues: issues || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/vehicle-checklists"] });
      toast({
        title: "Checklist Completed",
        description: `${checklistType === "PRE_TRIP" ? "Pre-trip" : "Post-trip"} checklist submitted successfully`,
      });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit checklist",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setChecklistType("PRE_TRIP");
    setSelectedVehicle("");
    setOdometerReading("");
    setFuelLevel("FULL");
    setIssues("");
    const initial: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach(item => {
      initial[item.id] = false;
    });
    setCheckItems(initial);
  };

  const handleSubmit = () => {
    if (!selectedVehicle) {
      toast({
        title: "Validation Error",
        description: "Please select a vehicle",
        variant: "destructive",
      });
      return;
    }

    const allChecked = CHECKLIST_ITEMS.every(item => checkItems[item.id]);
    if (!allChecked) {
      toast({
        title: "Incomplete Checklist",
        description: "Please check all items before submitting",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate();
  };

  const toggleCheckItem = (id: string) => {
    setCheckItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const allItemsOk = (checklist: VehicleChecklist) => {
    return checklist.tiresOk && checklist.lightsOk && checklist.brakesOk &&
           checklist.fluidLevelsOk && checklist.interiorCleanOk &&
           checklist.emergencyEquipmentOk && checklist.mirrorsOk && checklist.seatsOk;
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary" data-testid="icon-checklist" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-checklist">Vehicle Checklists</h1>
            <p className="text-muted-foreground">Complete pre-trip and post-trip vehicle inspections</p>
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-new-checklist">
          <ClipboardCheck className="h-4 w-4 mr-2" />
          New Checklist
        </Button>
      </div>

      <div className="space-y-4">
        {loadingChecklists ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : checklists && checklists.length > 0 ? (
          checklists.map((checklist) => {
            const vehicle = vehicles?.find(v => v.id === checklist.vehicleId);
            const hasIssues = !allItemsOk(checklist) || checklist.issues;

            return (
              <Card key={checklist.id} data-testid={`checklist-${checklist.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">
                      {vehicle?.name || "Unknown Vehicle"} ({vehicle?.plateNumber || "N/A"})
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={checklist.checklistType === "PRE_TRIP" ? "default" : "secondary"}>
                      {checklist.checklistType === "PRE_TRIP" ? "Pre-Trip" : "Post-Trip"}
                    </Badge>
                    {hasIssues ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Issues
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        All OK
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {checklist.odometerReading && (
                        <div>
                          <span className="text-muted-foreground">Odometer:</span>{" "}
                          <span className="font-medium">{checklist.odometerReading.toLocaleString()} mi</span>
                        </div>
                      )}
                      {checklist.fuelLevel && (
                        <div>
                          <span className="text-muted-foreground">Fuel:</span>{" "}
                          <span className="font-medium">{checklist.fuelLevel.replace("_", " ")}</span>
                        </div>
                      )}
                    </div>

                    {checklist.issues && (
                      <div className="text-sm p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                        <span className="font-medium text-destructive">Issues Found: </span>
                        <span>{checklist.issues}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Completed {formatDistance(new Date(checklist.createdAt), new Date(), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Checklists Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Complete your first vehicle inspection checklist
              </p>
              <Button onClick={() => setShowDialog(true)} data-testid="button-first-checklist">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Start Checklist
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-new-checklist">
          <DialogHeader>
            <DialogTitle>Vehicle Inspection Checklist</DialogTitle>
            <DialogDescription>
              Complete all checklist items to ensure vehicle safety and readiness
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checklistType">Checklist Type *</Label>
                <Select value={checklistType} onValueChange={(v) => setChecklistType(v as "PRE_TRIP" | "POST_TRIP")}>
                  <SelectTrigger data-testid="select-checklist-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRE_TRIP">Pre-Trip Inspection</SelectItem>
                    <SelectItem value="POST_TRIP">Post-Trip Inspection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle *</Label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger data-testid="select-vehicle">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingVehicles ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : vehicles && vehicles.length > 0 ? (
                      vehicles.map(vehicle => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} ({vehicle.plateNumber})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No vehicles available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="odometer">Odometer Reading</Label>
                <Input
                  id="odometer"
                  type="number"
                  placeholder="123456"
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value)}
                  data-testid="input-odometer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel">Fuel Level</Label>
                <Select value={fuelLevel} onValueChange={setFuelLevel}>
                  <SelectTrigger data-testid="select-fuel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPTY">Empty</SelectItem>
                    <SelectItem value="QUARTER">1/4 Tank</SelectItem>
                    <SelectItem value="HALF">1/2 Tank</SelectItem>
                    <SelectItem value="THREE_QUARTER">3/4 Tank</SelectItem>
                    <SelectItem value="FULL">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Inspection Items * (Check all that apply)</Label>
              <div className="space-y-2 p-3 border rounded-md">
                {CHECKLIST_ITEMS.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={item.id}
                      checked={checkItems[item.id] || false}
                      onCheckedChange={() => toggleCheckItem(item.id)}
                      data-testid={`checkbox-${item.id}`}
                    />
                    <Label htmlFor={item.id} className="cursor-pointer">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issues">Issues (If any problems found)</Label>
              <Textarea
                id="issues"
                placeholder="Describe any issues or concerns found during inspection..."
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={3}
                data-testid="textarea-issues"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                resetForm();
              }}
              data-testid="button-cancel-checklist"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit-checklist"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Checklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
