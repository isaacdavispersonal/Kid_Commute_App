import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";

export function IncompleteProfileBanner() {
  const { user, isLoading } = useAuth();

  // Don't show banner while loading or if user is not available
  if (isLoading || !user) {
    return null;
  }

  // Check if profile is incomplete
  const isProfileIncomplete = 
    !user.firstName || 
    !user.lastName || 
    !user.email || 
    !user.phoneNumber || 
    !user.address;

  if (!isProfileIncomplete) {
    return null;
  }

  return (
    <Alert className="mb-6 border-warning bg-warning/10" data-testid="banner-incomplete-profile">
      <AlertCircle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm text-warning-foreground">
          Your profile is incomplete. Please update your contact information to continue.
        </span>
        <Button asChild variant="outline" size="sm" data-testid="button-complete-profile">
          <Link href="/profile">
            Complete Profile
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
