import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Phone, ShieldAlert, Stethoscope, Bus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent } from "@/components/ui/card";

type EmergencyType = "behavior" | "medical" | "vehicle" | "other";

interface EmergencyOption {
  type: EmergencyType;
  label: string;
  icon: typeof AlertTriangle;
  description: string;
}

const emergencyOptions: EmergencyOption[] = [
  {
    type: "behavior",
    label: "Behavior Issue",
    icon: AlertTriangle,
    description: "Student behavior requiring immediate attention",
  },
  {
    type: "medical",
    label: "Medical Emergency",
    icon: Stethoscope,
    description: "Health or medical situation",
  },
  {
    type: "vehicle",
    label: "Vehicle Issue",
    icon: Bus,
    description: "Vehicle breakdown or accident",
  },
  {
    type: "other",
    label: "Other",
    icon: HelpCircle,
    description: "Other emergency situation",
  },
];

export function EmergencyButton() {
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<EmergencyType | null>(null);

  const { data: emergencyPhoneSetting } = useQuery<{ settingValue: string } | null>({
    queryKey: ["/api/settings/emergency-phone"],
  });

  const adminPhoneNumber = emergencyPhoneSetting?.settingValue || "";

  const handleTypeSelect = (type: EmergencyType) => {
    setSelectedType(type);
    setShowTypeDialog(false);
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    setShowContactDialog(true);
  };

  const handleContactAdmin = () => {
    if (adminPhoneNumber) {
      window.location.href = `tel:${adminPhoneNumber}`;
    }
    setShowContactDialog(false);
    resetDialogs();
  };

  const handleContact911 = () => {
    window.location.href = "tel:911";
    setShowContactDialog(false);
    resetDialogs();
  };

  const resetDialogs = () => {
    setSelectedType(null);
  };

  const selectedOption = emergencyOptions.find(o => o.type === selectedType);

  return (
    <>
      <Button
        variant="destructive"
        size="lg"
        className="w-full gap-2"
        onClick={() => setShowTypeDialog(true)}
        data-testid="button-emergency"
      >
        <ShieldAlert className="h-5 w-5" />
        Emergency
      </Button>

      {/* Step 1: Select Emergency Type */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent className="max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              What type of emergency?
            </DialogTitle>
            <DialogDescription>
              Select the type of emergency you are experiencing
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {emergencyOptions.map((option) => (
              <Card
                key={option.type}
                className="cursor-pointer hover-elevate"
                onClick={() => handleTypeSelect(option.type)}
                data-testid={`button-emergency-type-${option.type}`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-full bg-destructive/10 p-2">
                    <option.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Confirmation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[350px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Emergency
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedOption && (
                <>
                  You selected: <strong>{selectedOption.label}</strong>
                  <br /><br />
                  Are you sure you want to trigger an emergency notification?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction 
              onClick={handleConfirm}
              className="w-full bg-destructive hover:bg-destructive/90"
              data-testid="button-emergency-confirm"
            >
              Yes, Continue
            </AlertDialogAction>
            <AlertDialogCancel 
              className="w-full"
              data-testid="button-emergency-cancel"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 3: Contact Options */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Who would you like to contact?
            </DialogTitle>
            <DialogDescription>
              Select who you need to call for assistance
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {adminPhoneNumber && (
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={handleContactAdmin}
                data-testid="button-contact-admin"
              >
                <div className="rounded-full bg-primary/10 p-2">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Contact Admin</p>
                  <p className="text-sm text-muted-foreground">{adminPhoneNumber}</p>
                </div>
              </Button>
            )}
            <Button
              variant="destructive"
              size="lg"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={handleContact911}
              data-testid="button-contact-911"
            >
              <div className="rounded-full bg-white/20 p-2">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">Call 911</p>
                <p className="text-sm opacity-90">Emergency Services</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
