import { ROUTE_COLORS, type RouteColor } from "@shared/schema";

interface RouteColorBadgeProps {
  routeName: string;
  color?: RouteColor | null;
  groupColor?: RouteColor | null;
  className?: string;
}

export function RouteColorBadge({ routeName, color, groupColor, className = "" }: RouteColorBadgeProps) {
  // Color fallback strategy: route color takes precedence over group color
  const effectiveColor = color || groupColor || "gray";
  const colorConfig = ROUTE_COLORS[effectiveColor];

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      data-testid={`route-badge-${routeName.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <span className={`w-1 h-4 ${colorConfig.bgColor}`} aria-hidden="true" />
      <span className="font-medium">{routeName}</span>
    </span>
  );
}
