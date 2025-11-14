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
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border} ${className}`}
      data-testid={`route-badge-${routeName.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <span className="font-medium">{routeName}</span>
    </span>
  );
}
