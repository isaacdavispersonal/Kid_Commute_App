// Reusable statistics card component for dashboard
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  iconColor = "text-primary",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("hover-elevate", className)} data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-3xl font-bold" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
          {trend && (
            <span
              className={cn(
                "text-sm font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
