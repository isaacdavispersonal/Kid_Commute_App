import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, X, MapPin, MessageSquare, UserCircle } from "lucide-react";

const TUTORIAL_DISMISSED_KEY = "parent-tutorial-dismissed";

export function ParentTutorialBanner() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY);
    if (!dismissed) {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Alert className="border-primary/50 bg-primary/5" data-testid="alert-tutorial">
      <Info className="h-4 w-4 text-primary" />
      <div className="flex-1">
        <AlertTitle className="text-primary font-semibold flex items-center gap-2">
          Welcome to FleetTrack!
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 ml-auto"
            onClick={handleDismiss}
            data-testid="button-dismiss-tutorial"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p className="text-sm">
            Here's how to use the parent portal:
          </p>
          <ul className="text-sm space-y-1.5 ml-4">
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>
                <strong>Track Vehicle:</strong> View real-time location of your child's bus
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>
                <strong>Messages:</strong> Communicate directly with your child's driver
              </span>
            </li>
            <li className="flex items-start gap-2">
              <UserCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>
                <strong>My Children:</strong> View and update your children's information and mark attendance
              </span>
            </li>
          </ul>
        </AlertDescription>
      </div>
    </Alert>
  );
}
