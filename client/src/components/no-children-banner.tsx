import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { Link } from "wouter";

export function NoChildrenBanner() {
  return (
    <Alert className="border-primary/50 bg-primary/5" data-testid="alert-no-children">
      <Link2 className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary font-semibold">
        No Children Connected
      </AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3">
        <p className="text-sm">
          Connect your children by matching your phone number with their guardian contact information.
          Make sure your profile has your phone number set up first.
        </p>
        <div>
          <Button asChild size="sm" data-testid="button-connect-children-banner">
            <Link href="/parent/children">
              <Link2 className="h-4 w-4 mr-2" />
              Connect Children
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
