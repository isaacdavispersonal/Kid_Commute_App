import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Link2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Edit,
  Upload,
  Calendar,
  Clock,
} from "lucide-react";

interface BambooHRStatus {
  isConfigured: boolean;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
}

interface Driver {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  bambooEmployeeId: string | null;
}

export default function BambooHRSettings({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editBambooId, setEditBambooId] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<BambooHRStatus>({
    queryKey: ["/api/admin/bamboohr/status"],
  });

  const { data: drivers, isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ["/api/admin/drivers"],
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/bamboohr/test-connection");
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bamboohr/status"] });
      if (result.success) {
        toast({ title: "Success", description: "BambooHR connection successful" });
      } else {
        toast({ title: "Connection Failed", description: result.error || "Failed to connect to BambooHR", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to test connection", variant: "destructive" });
    },
  });

  const updateDriverMutation = useMutation({
    mutationFn: async (data: { driverId: string; bambooEmployeeId: string | null }) => {
      return await apiRequest("PATCH", `/api/admin/users/${data.driverId}`, {
        bambooEmployeeId: data.bambooEmployeeId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drivers"] });
      toast({ title: "Success", description: "Driver mapping updated" });
      setShowEditDialog(false);
      setEditingDriver(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update driver", variant: "destructive" });
    },
  });

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setEditBambooId(driver.bambooEmployeeId || "");
    setShowEditDialog(true);
  };

  const handleSaveDriver = () => {
    if (!editingDriver) return;
    updateDriverMutation.mutate({
      driverId: editingDriver.id,
      bambooEmployeeId: editBambooId.trim() || null,
    });
  };

  const unmappedCount = drivers?.filter(d => !d.bambooEmployeeId).length || 0;
  const mappedCount = drivers?.filter(d => d.bambooEmployeeId).length || 0;

  const mainContent = (
    <div className="space-y-4 sm:space-y-6">
      <Card data-testid="card-connection-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Connection Settings
          </CardTitle>
          <CardDescription>
            BambooHR API credentials are managed via environment variables for security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-4 p-4 rounded-lg border">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Connection Status:</span>
                    {status?.isConfigured ? (
                      status.lastTestSuccess ? (
                        <Badge variant="default" className="gap-1" data-testid="badge-connection-status">
                          <CheckCircle className="w-3 h-3" />
                          Connected
                        </Badge>
                      ) : status.lastTestSuccess === false ? (
                        <Badge variant="destructive" className="gap-1" data-testid="badge-connection-status">
                          <XCircle className="w-3 h-3" />
                          Connection Error
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1" data-testid="badge-connection-status">
                          <AlertTriangle className="w-3 h-3" />
                          Configured (Not Tested)
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="gap-1" data-testid="badge-connection-status">
                        <XCircle className="w-3 h-3" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  {status?.lastTestedAt && (
                    <p className="text-sm text-muted-foreground" data-testid="text-last-tested">
                      Last tested: {new Date(status.lastTestedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={!status?.isConfigured || testConnectionMutation.isPending}
                  data-testid="button-test-connection"
                >
                  {testConnectionMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Label className="font-medium min-w-32">API Key:</Label>
                  <Input 
                    type="password" 
                    value={status?.isConfigured ? "••••••••••••••••" : ""} 
                    disabled 
                    className="max-w-xs"
                    data-testid="input-api-key"
                  />
                  <span className="text-xs text-muted-foreground">Set via BAMBOOHR_API_KEY env var</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Label className="font-medium min-w-32">Subdomain:</Label>
                  <Input 
                    type="text" 
                    value={status?.isConfigured ? "••••••••" : ""} 
                    disabled 
                    className="max-w-xs"
                    data-testid="input-subdomain"
                  />
                  <span className="text-xs text-muted-foreground">Set via BAMBOOHR_SUBDOMAIN env var</span>
                </div>
              </div>

              {!status?.isConfigured && (
                <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Configuration Required</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        To enable BambooHR integration, set the following environment variables:
                      </p>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside">
                        <li>BAMBOOHR_API_KEY - Your BambooHR API key</li>
                        <li>BAMBOOHR_SUBDOMAIN - Your BambooHR company subdomain</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-employee-mapping">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Employee Mapping</CardTitle>
              <CardDescription>
                Map drivers to their BambooHR Employee IDs for timesheet export
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled data-testid="button-import-csv">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {driversLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !drivers || drivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No drivers found.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <Badge variant="default" className="text-sm" data-testid="badge-mapped-count">
                  {mappedCount} Mapped
                </Badge>
                {unmappedCount > 0 && (
                  <Badge variant="destructive" className="text-sm" data-testid="badge-unmapped-count">
                    {unmappedCount} Unmapped
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>BambooHR Employee ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map(driver => (
                      <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
                        <TableCell className="font-medium">
                          {`${driver.firstName || ""} ${driver.lastName || ""}`.trim() || "Unknown"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {driver.email || "—"}
                        </TableCell>
                        <TableCell>
                          {driver.bambooEmployeeId || "—"}
                        </TableCell>
                        <TableCell>
                          {driver.bambooEmployeeId ? (
                            <Badge variant="default" className="text-xs">Mapped</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Unmapped</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDriver(driver)}
                            data-testid={`button-edit-driver-${driver.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-export-schedule">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Export Schedule
          </CardTitle>
          <CardDescription>
            Configure automatic timesheet exports to BambooHR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label className="font-medium">Enable Scheduled Exports</Label>
              <p className="text-sm text-muted-foreground">
                Automatically export timesheets at the end of each pay period
              </p>
            </div>
            <Switch disabled data-testid="switch-scheduled-exports" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-50">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select disabled defaultValue="biweekly" data-testid="select-frequency">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select disabled defaultValue="friday" data-testid="select-day">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cutoff Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input type="time" disabled defaultValue="17:00" data-testid="input-cutoff-time" />
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground italic">
            Scheduled exports feature coming soon
          </p>
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent data-testid="dialog-edit-driver">
          <DialogHeader>
            <DialogTitle>Edit BambooHR Mapping</DialogTitle>
            <DialogDescription>
              Update the BambooHR Employee ID for {editingDriver?.firstName} {editingDriver?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bamboo-id">BambooHR Employee ID</Label>
              <Input
                id="bamboo-id"
                value={editBambooId}
                onChange={(e) => setEditBambooId(e.target.value)}
                placeholder="Enter employee ID"
                data-testid="input-bamboo-id"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to remove the mapping
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDriver}
              disabled={updateDriverMutation.isPending}
              data-testid="button-save-driver"
            >
              {updateDriverMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) {
    return mainContent;
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1" data-testid="heading-bamboohr-settings">
          BambooHR Integration
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Configure BambooHR integration for timesheet exports
        </p>
      </div>
      {mainContent}
    </div>
  );
}
