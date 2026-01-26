import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Undo2, Loader2, CheckCircle2 } from "lucide-react";

interface UndoSnackbarProps {
  message: string;
  duration?: number;
  onUndo: () => Promise<void> | void;
  onDismiss?: () => void;
  onComplete?: () => void;
  actionLabel?: string;
}

export function useUndoSnackbar() {
  const [snackbar, setSnackbar] = useState<{
    id: string;
    message: string;
    onUndo: () => Promise<void> | void;
    onDismiss?: () => void;
    onComplete?: () => void;
    duration: number;
    actionLabel?: string;
  } | null>(null);

  const show = useCallback(
    ({
      message,
      onUndo,
      onDismiss,
      onComplete,
      duration = 5000,
      actionLabel = "Undo",
    }: Omit<UndoSnackbarProps, "duration"> & { duration?: number }) => {
      const id = Math.random().toString(36).substr(2, 9);
      setSnackbar({
        id,
        message,
        onUndo,
        onDismiss,
        onComplete,
        duration,
        actionLabel,
      });
    },
    []
  );

  const dismiss = useCallback(() => {
    if (snackbar?.onDismiss) {
      snackbar.onDismiss();
    }
    setSnackbar(null);
  }, [snackbar]);

  const complete = useCallback(() => {
    if (snackbar?.onComplete) {
      snackbar.onComplete();
    }
    setSnackbar(null);
  }, [snackbar]);

  return {
    snackbar,
    show,
    dismiss,
    complete,
  };
}

export function UndoSnackbar({
  message,
  duration = 5000,
  onUndo,
  onDismiss,
  onComplete,
  actionLabel = "Undo",
}: UndoSnackbarProps) {
  const [progress, setProgress] = useState(100);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (isUndoing || isDone) return;

    const interval = 50;
    const step = (100 * interval) / duration;
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timer);
          onComplete?.();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, onComplete, isUndoing, isDone]);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await onUndo();
      setIsDone(true);
      setTimeout(() => {
        onDismiss?.();
      }, 1000);
    } catch (error) {
      setIsUndoing(false);
    }
  };

  const handleDismiss = () => {
    onComplete?.();
  };

  return (
    <div 
      className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-5"
      role="alert"
      data-testid="undo-snackbar"
    >
      <div className="bg-foreground text-background rounded-lg shadow-lg overflow-hidden">
        <div className="relative">
          <div
            className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          
          <div className="flex items-center justify-between p-4 gap-3">
            <p className="text-sm flex-1" data-testid="text-snackbar-message">
              {isDone ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Action undone
                </span>
              ) : (
                message
              )}
            </p>
            
            {!isDone && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={isUndoing}
                  className="text-primary-foreground hover:bg-muted/20 h-8"
                  data-testid="button-undo"
                >
                  {isUndoing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-1" />
                      {actionLabel}
                    </>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:bg-muted/20 h-8 w-8"
                  data-testid="button-dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface UndoableAction<T> {
  execute: () => Promise<T>;
  undo: () => Promise<void>;
  message: string;
  duration?: number;
  actionLabel?: string;
}

export function UndoSnackbarContainer({
  snackbar,
  onDismiss,
  onComplete,
}: {
  snackbar: {
    id: string;
    message: string;
    onUndo: () => Promise<void> | void;
    duration: number;
    actionLabel?: string;
  } | null;
  onDismiss: () => void;
  onComplete: () => void;
}) {
  if (!snackbar) return null;

  return (
    <UndoSnackbar
      key={snackbar.id}
      message={snackbar.message}
      duration={snackbar.duration}
      onUndo={snackbar.onUndo}
      onDismiss={onDismiss}
      onComplete={onComplete}
      actionLabel={snackbar.actionLabel}
    />
  );
}
