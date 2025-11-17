import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, Clock, Truck } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface VehicleLocation {
  id: string;
  name: string;
  plateNumber: string | null;
  status: string;
  currentLat: string | null;
  currentLng: string | null;
  lastLocationUpdate: string | null;
  samsaraVehicleId: string | null;
}

export default function AdminFleetMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const hasInitializedBoundsRef = useRef(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const { data: vehicles, isLoading } = useQuery<VehicleLocation[]>({
    queryKey: ["/api/admin/vehicles"],
    refetchInterval: 15000, // Refresh every 15 seconds for live tracking
  });

  // Filter vehicles with GPS data
  const trackedVehicles = vehicles?.filter(v => v.currentLat && v.currentLng) || [];
  const untrackedVehicles = vehicles?.filter(v => !v.currentLat || !v.currentLng) || [];

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize map if not already created
    if (!mapInstanceRef.current) {
      const map = window.L.map(mapRef.current).setView([37.7749, -122.4194], 12);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    // Clear old markers
    markersRef.current.forEach(marker => {
      marker.remove();
    });
    markersRef.current.clear();

    // Add markers for vehicles with location data
    if (trackedVehicles.length > 0) {
      const bounds: any[] = [];

      trackedVehicles.forEach(vehicle => {
        const lat = parseFloat(vehicle.currentLat!);
        const lng = parseFloat(vehicle.currentLng!);
        bounds.push([lat, lng]);

        const lastUpdate = vehicle.lastLocationUpdate
          ? new Date(vehicle.lastLocationUpdate).toLocaleString()
          : "Never";

        const isActive = vehicle.status === "active";
        const iconColor = isActive ? "green" : vehicle.status === "maintenance" ? "orange" : "gray";

        // Create custom icon
        const icon = window.L.divIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: ${iconColor}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                  </svg>
                </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = window.L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(
            `<div style="min-width: 200px;">
              <strong style="font-size: 16px;">${vehicle.name}</strong><br>
              <span style="color: #666;">Plate: ${vehicle.plateNumber || "N/A"}</span><br>
              <span style="color: #666;">Status: ${vehicle.status}</span><br>
              <span style="color: #666; font-size: 12px;">Updated: ${lastUpdate}</span>
            </div>`
          );

        marker.on("click", () => {
          setSelectedVehicle(vehicle.id);
        });

        markersRef.current.set(vehicle.id, marker);
      });

      // Only fit bounds on initial load, not on subsequent refreshes
      // This preserves the user's zoom level and pan position
      if (bounds.length > 0 && !hasInitializedBoundsRef.current) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        hasInitializedBoundsRef.current = true;
      }
    }

    return () => {
      markersRef.current.forEach(marker => {
        marker.remove();
      });
      markersRef.current.clear();
    };
  }, [trackedVehicles]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[700px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Live Fleet Map</h1>
        <p className="text-sm text-muted-foreground">
          Real-time location tracking for all vehicles
        </p>
      </div>

      {/* Fleet Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fleet size
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPS Tracking</CardTitle>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{trackedVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Vehicles with live GPS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No GPS</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{untrackedVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Vehicles offline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>Fleet Locations</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Auto-refreshes every 15 seconds</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {trackedVehicles.length > 0 ? (
            <div
              ref={mapRef}
              className="w-full h-[600px] rounded-b-lg"
              data-testid="map-container"
            />
          ) : (
            <div className="text-center py-16">
              <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No GPS Data Available</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Vehicles will appear on the map once they start sending GPS data via Samsara webhook or navigation app.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle List */}
      {untrackedVehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicles Without GPS Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {untrackedVehicles.map(vehicle => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between gap-4 p-3 border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{vehicle.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {vehicle.plateNumber || "No plate number"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={vehicle.status as any} />
                    {vehicle.samsaraVehicleId && (
                      <Badge variant="outline" className="text-xs">
                        Samsara Connected
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
