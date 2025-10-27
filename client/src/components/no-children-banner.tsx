import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Link } from "wouter";

export function NoChildrenBanner() {
  return (
    <Alert className="border-primary/50 bg-primary/5" data-testid="alert-no-children">
      <UserPlus className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary font-semibold">
        No Children Registered
      </AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3">
        <p className="text-sm">
          You haven't registered any children yet. Please add your child's information
          to track their transportation and communicate with drivers.
        </p>
        <div>
          <Button asChild size="sm" data-testid="button-add-children-banner">
            <Link href="/parent/children">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Children
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
