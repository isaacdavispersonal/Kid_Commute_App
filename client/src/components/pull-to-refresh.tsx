import { useCallback } from "react";
import { IonContent, IonRefresher, IonRefresherContent, RefresherEventDetail } from "@ionic/react";
import { queryClient } from "@/lib/queryClient";

type PullToRefreshProps = {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  queryKeys?: (string | string[])[];
  disabled?: boolean;
  className?: string;
};

export function PullToRefresh({
  children,
  onRefresh,
  queryKeys,
  disabled = false,
  className = "",
}: PullToRefreshProps) {
  const handleRefresh = useCallback(async (event: CustomEvent<RefresherEventDetail>) => {
    try {
      if (onRefresh) {
        await onRefresh();
      } else if (queryKeys && queryKeys.length > 0) {
        await Promise.all(
          queryKeys.map((key) => 
            queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
          )
        );
      }
    } catch (error) {
      console.error("Pull to refresh error:", error);
    } finally {
      event.detail.complete();
    }
  }, [onRefresh, queryKeys]);

  return (
    <IonContent 
      className={`ion-content-scroll-host ${className}`}
      scrollY={true}
      fullscreen
    >
      {!disabled && (
        <IonRefresher 
          slot="fixed" 
          onIonRefresh={handleRefresh}
          pullFactor={0.5}
          pullMin={60}
          pullMax={120}
        >
          <IonRefresherContent
            pullingText="Pull to refresh"
            refreshingSpinner="crescent"
            refreshingText="Refreshing..."
          />
        </IonRefresher>
      )}
      <div className="min-h-full">
        {children}
      </div>
    </IonContent>
  );
}
