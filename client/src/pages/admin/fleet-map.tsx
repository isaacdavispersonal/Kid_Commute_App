import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, Clock, Truck, Compass, Gauge, Radio, ChevronRight, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    L: any;
  }
}

interface VehicleLocation {
  id: string;
  name: string;
  nickname: string | null;
  plateNumber: string | null;
  status: string;
  currentLat: string | null;
  currentLng: string | null;
  currentSpeedMph: string | null;
  currentHeadingDeg: string | null;
  lastLocationUpdate: string | null;
  samsaraVehicleId: string | null;
  samsaraLastSync: string | null;
}

// Helper function to get display name for vehicles (nickname if available, otherwise name)
function getVehicleDisplayName(vehicle: VehicleLocation): string {
  return vehicle.nickname || vehicle.name;
}

function getHeadingLabel(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

function formatTimeSince(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function AdminFleetMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const hasInitializedBoundsRef = useRef(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const { data: vehicles, isLoading } = useQuery<VehicleLocation[]>({
    queryKey: ["/api/admin/vehicles"],
    refetchInterval: 15000,
  });

  const trackedVehicles = vehicles?.filter(v => v.currentLat && v.currentLng) || [];
  const untrackedVehicles = vehicles?.filter(v => !v.currentLat || !v.currentLng) || [];
  const selectedVehicleData = vehicles?.find(v => v.id === selectedVehicle);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    if (vehicle?.currentLat && vehicle?.currentLng && mapInstanceRef.current) {
      const lat = parseFloat(vehicle.currentLat);
      const lng = parseFloat(vehicle.currentLng);
      
      mapInstanceRef.current.flyTo([lat, lng], 16, {
        duration: 1,
      });
      
      const marker = markersRef.current.get(vehicleId);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapRef.current).setView([37.7749, -122.4194], 12);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    markersRef.current.forEach(marker => {
      marker.remove();
    });
    markersRef.current.clear();

    if (trackedVehicles.length > 0) {
      const bounds: any[] = [];

      trackedVehicles.forEach(vehicle => {
        const lat = parseFloat(vehicle.currentLat!);
        const lng = parseFloat(vehicle.currentLng!);
        bounds.push([lat, lng]);

        const lastUpdate = vehicle.lastLocationUpdate
          ? new Date(vehicle.lastLocationUpdate).toLocaleString()
          : "Never";
        const speed = vehicle.currentSpeedMph ? `${parseFloat(vehicle.currentSpeedMph).toFixed(1)} mph` : "N/A";
        const heading = vehicle.currentHeadingDeg 
          ? `${parseFloat(vehicle.currentHeadingDeg).toFixed(0)}° ${getHeadingLabel(parseFloat(vehicle.currentHeadingDeg))}`
          : "N/A";

        const isActive = vehicle.status === "active";
        const iconColor = isActive ? "green" : vehicle.status === "maintenance" ? "orange" : "gray";

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

        const displayName = getVehicleDisplayName(vehicle);
        const marker = window.L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(
            `<div style="min-width: 220px;">
              <strong style="font-size: 16px;">${displayName}</strong><br>
              ${vehicle.nickname ? `<span style="color: #666;">Unit: ${vehicle.name}</span><br>` : ''}
              <span style="color: #666;">Plate: ${vehicle.plateNumber || "N/A"}</span><br>
              <span style="color: #666;">Status: ${vehicle.status}</span><br>
              <span style="color: #666;">Speed: ${speed}</span><br>
              <span style="color: #666;">Heading: ${heading}</span><br>
              <span style="color: #666; font-size: 12px;">Updated: ${lastUpdate}</span>
            </div>`
          );

        marker.on("click", () => {
          setSelectedVehicle(vehicle.id);
        });

        markersRef.current.set(vehicle.id, marker);
      });

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
        <div className="flex gap-4">
          <Skeleton className="h-[600px] flex-1" />
          <Skeleton className="h-[600px] w-80" />
        </div>
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
            <p className="text-xs text-muted-foreground mt-1">Fleet size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPS Tracking</CardTitle>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{trackedVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Vehicles with live GPS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No GPS</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{untrackedVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Vehicles offline</p>
          </CardContent>
        </Card>
      </div>

      {/* Map and Vehicle List */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Map */}
        <Card className="flex-1">
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
                className="w-full h-[500px] lg:h-[600px] rounded-b-lg relative z-0"
                style={{ isolation: 'isolate' }}
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

        {/* Vehicle List Sidebar */}
        <Card className="w-full lg:w-80 shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vehicles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] lg:h-[540px]">
              <div className="space-y-1 p-3 pt-0">
                {/* Tracked Vehicles */}
                {trackedVehicles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                      GPS Active ({trackedVehicles.length})
                    </p>
                    {trackedVehicles.map(vehicle => (
                      <Button
                        key={vehicle.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-auto py-2 px-2",
                          selectedVehicle === vehicle.id && "bg-accent"
                        )}
                        onClick={() => handleVehicleSelect(vehicle.id)}
                        data-testid={`button-vehicle-${vehicle.id}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium text-sm truncate">{getVehicleDisplayName(vehicle)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {vehicle.nickname ? `${vehicle.name} • ` : ''}{vehicle.plateNumber || "No plate"} • {formatTimeSince(vehicle.lastLocationUpdate)}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {/* Untracked Vehicles */}
                {untrackedVehicles.length > 0 && (
                  <div className="space-y-1 mt-4">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                      Offline ({untrackedVehicles.length})
                    </p>
                    {untrackedVehicles.map(vehicle => (
                      <div
                        key={vehicle.id}
                        className="flex items-center gap-2 px-2 py-2 rounded-md"
                      >
                        <div className="w-3 h-3 rounded-full bg-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-muted-foreground truncate">{getVehicleDisplayName(vehicle)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {vehicle.nickname ? `${vehicle.name} • ` : ''}{vehicle.plateNumber || "No plate"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {vehicles?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No vehicles found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Selected Vehicle Details */}
      {selectedVehicleData && selectedVehicleData.currentLat && (
        <Card data-testid="card-vehicle-details">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {getVehicleDisplayName(selectedVehicleData)}
                {selectedVehicleData.nickname && (
                  <span className="text-sm font-normal text-muted-foreground">({selectedVehicleData.name})</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedVehicleData.status as any} />
                {selectedVehicleData.samsaraVehicleId && (
                  <Badge variant="outline" className="text-xs">
                    <Radio className="h-3 w-3 mr-1" />
                    Samsara
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Coordinates
                </p>
                <p className="text-sm font-medium" data-testid="text-coordinates">
                  {parseFloat(selectedVehicleData.currentLat).toFixed(6)}, {parseFloat(selectedVehicleData.currentLng!).toFixed(6)}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  Speed
                </p>
                <p className="text-sm font-medium" data-testid="text-speed">
                  {selectedVehicleData.currentSpeedMph 
                    ? `${parseFloat(selectedVehicleData.currentSpeedMph).toFixed(1)} mph`
                    : "N/A"}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Compass className="h-3 w-3" />
                  Heading
                </p>
                <p className="text-sm font-medium" data-testid="text-heading">
                  {selectedVehicleData.currentHeadingDeg 
                    ? `${parseFloat(selectedVehicleData.currentHeadingDeg).toFixed(0)}° ${getHeadingLabel(parseFloat(selectedVehicleData.currentHeadingDeg))}`
                    : "N/A"}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last Update
                </p>
                <p className="text-sm font-medium" data-testid="text-last-update">
                  {selectedVehicleData.lastLocationUpdate 
                    ? new Date(selectedVehicleData.lastLocationUpdate).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </div>

            {selectedVehicleData.samsaraVehicleId && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Samsara Integration</p>
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="text-muted-foreground">Vehicle ID:</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs" data-testid="text-samsara-id">
                    {selectedVehicleData.samsaraVehicleId}
                  </code>
                  {selectedVehicleData.samsaraLastSync && (
                    <>
                      <span className="text-muted-foreground">Last Sync:</span>
                      <span>{formatTimeSince(selectedVehicleData.samsaraLastSync)}</span>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const samsaraId = selectedVehicleData.samsaraVehicleId;
                      // Open Samsara cloud dashboard for this vehicle
                      // On mobile, this may redirect to Samsara Fleet app if installed
                      const samsaraUrl = `https://cloud.samsara.com/fleet#/vehicles/${samsaraId}/tracking`;
                      window.open(samsaraUrl, '_blank');
                    }}
                    data-testid="button-open-samsara"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in Samsara
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
