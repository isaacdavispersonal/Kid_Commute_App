import { Heart, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MedicalBadgeProps {
  allergies?: string | null;
  medicalNotes?: string | null;
  size?: "sm" | "md";
  showTooltip?: boolean;
}

export function MedicalBadge({ 
  allergies, 
  medicalNotes, 
  size = "sm",
  showTooltip = true 
}: MedicalBadgeProps) {
  const hasMedicalInfo = !!(allergies?.trim() || medicalNotes?.trim());
  
  if (!hasMedicalInfo) return null;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const badgeSize = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  const badge = (
    <Badge 
      variant="destructive" 
      className={`gap-1 ${badgeSize}`}
      data-testid="badge-medical"
    >
      <Heart className={iconSize} />
      Medical
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent className="max-w-[250px]">
        <div className="space-y-2">
          {allergies?.trim() && (
            <div>
              <div className="flex items-center gap-1 text-destructive font-medium">
                <AlertTriangle className="h-3 w-3" />
                Allergies
              </div>
              <p className="text-sm text-muted-foreground">{allergies}</p>
            </div>
          )}
          {medicalNotes?.trim() && (
            <div>
              <div className="flex items-center gap-1 font-medium">
                <Heart className="h-3 w-3" />
                Medical Notes
              </div>
              <p className="text-sm text-muted-foreground">{medicalNotes}</p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function hasMedicalInfo(student: { allergies?: string | null; medicalNotes?: string | null }): boolean {
  return !!(student.allergies?.trim() || student.medicalNotes?.trim());
}
