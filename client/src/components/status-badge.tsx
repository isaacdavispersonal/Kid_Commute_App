// Reusable status badge component
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "completed" | "delayed" | "maintenance" | "offline" | "low" | "medium" | "high" | "critical" | "reviewed" | "resolved";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getVariant = () => {
    switch (status) {
      case "active":
      case "completed":
      case "resolved":
        return "bg-success/10 text-success hover:bg-success/20 border-success/20";
      case "pending":
      case "delayed":
        return "bg-warning/10 text-warning hover:bg-warning/20 border-warning/20";
      case "inactive":
      case "offline":
      case "high":
      case "critical":
        return "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20";
      case "maintenance":
      case "medium":
      case "reviewed":
        return "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20";
      case "low":
        return "bg-muted text-muted-foreground hover:bg-muted/80 border-muted";
      default:
        return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    }
  };

  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge className={cn("text-xs border", getVariant(), className)} data-testid={`badge-${status}`}>
      {label}
    </Badge>
  );
}
