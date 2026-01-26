// Parent vehicle tracking page with map
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useCallback } from "react";
import { useRegisterRefresh } from "@/contexts/RefreshContext";
import { clientConfig } from "@/lib/config";

export default function ParentTracking() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const { data: vehicleLocation, isLoading, refetch } = useQuery({
    queryKey: ["/api/parent/vehicle-location"],
    refetchInterval: clientConfig.polling.standard,
  });

  // Pull-to-refresh support
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  
  useRegisterRefresh("parent-tracking", handleRefresh);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapRef.current).setView([37.7749, -122.4194], 13);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    if (vehicleLocation && vehicleLocation.latitude && vehicleLocation.longitude) {
      const lat = parseFloat(vehicleLocation.latitude);
      const lng = parseFloat(vehicleLocation.longitude);

      mapInstanceRef.current.setView([lat, lng], 15);

      window.L.marker([lat, lng])
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${vehicleLocation.vehicleName}</b><br>Current Location`)
        .openPopup();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [vehicleLocation]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Live Vehicle Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Real-time location of your child's vehicle
        </p>
      </div>

      {vehicleLocation ? (
        <>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Navigation className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{vehicleLocation.vehicleName}</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicleLocation.routeName}
                    </p>
                  </div>
                </div>
                <StatusBadge status="active" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div
                ref={mapRef}
                className="w-full h-[600px] rounded-md"
                data-testid="map-container"
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-16">
            <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No Active Route</p>
            <p className="text-sm text-muted-foreground">
              Vehicle tracking will be available when your child's route is active
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    
  );
}
