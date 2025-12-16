import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, CheckCircle, XCircle, Users, AlertTriangle, Calendar, Clock, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";

type PayPeriodPreset = "current" | "previous" | "custom";

function getPayPeriodDates(preset: PayPeriodPreset, today: Date = new Date()): { start: string; end: string } {
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const isSecondWeek = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 1;
  
  let periodStart: Date;
  let periodEnd: Date;
  
  if (preset === "current") {
    if (isSecondWeek) {
      periodStart = subWeeks(currentWeekStart, 1);
      periodEnd = addWeeks(currentWeekStart, 1);
    } else {
      periodStart = currentWeekStart;
      periodEnd = addWeeks(currentWeekStart, 2);
    }
    periodEnd = new Date(periodEnd.getTime() - 1);
  } else if (preset === "previous") {
    if (isSecondWeek) {
      periodStart = subWeeks(currentWeekStart, 3);
      periodEnd = subWeeks(currentWeekStart, 1);
    } else {
      periodStart = subWeeks(currentWeekStart, 2);
      periodEnd = currentWeekStart;
    }
    periodEnd = new Date(periodEnd.getTime() - 1);
  } else {
    return { start: "", end: "" };
  }
  
  return {
    start: format(periodStart, "yyyy-MM-dd"),
    end: format(periodEnd, "yyyy-MM-dd"),
  };
}

function validatePayrollResponse(data: unknown): data is PayrollCalculation[] {
  if (!Array.isArray(data)) return false;
  return data.every(item => 
    typeof item === "object" &&
    item !== null &&
    "driverId" in item &&
    "driverName" in item &&
    typeof item.regularHours === "number" &&
    typeof item.overtimeHours === "number" &&
    typeof item.totalHours === "number"
  );
}

const formatDate = (dateString: string | undefined | null, formatStr: string): string => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    return format(date, formatStr);
  } catch {
    return "Invalid date";
  }
};

interface Driver {
  id: string;
  name: string;
  bambooEmployeeId: string | null;
}

interface PayrollCalculation {
  driverId: string;
  driverName: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
  bambooEmployeeId: string | null;
}

interface PayrollExport {
  id: string;
  exportDate: string;
  startDate: string;
  endDate: string;
  driverCount: number;
  totalHours: number;
  status: "success" | "partial" | "failed";
  successfulEntries: number;
  failedEntries: number;
}

interface PayrollExportResponse {
  exportId: string;
  status: "completed" | "failed";
  totalEntries: number;
  successfulEntries: number;
  failedEntries: number;
  results: Array<{
    driverId: string;
    driverName: string;
    regularHours: number;
    overtimeHours: number;
    doubleTimeHours: number;
    totalHours: number;
    status: "success" | "failed";
    errorMessage?: string;
  }>;
}

interface PayrollExportDetail extends PayrollExport {
  entries: Array<{
    driverId: string;
    driverName: string;
    regularHours: number;
    overtimeHours: number;
    doubleTimeHours: number;
    totalHours: number;
    status: "success" | "failed";
    errorMessage?: string;
  }>;
}

export default function AdminPayrollExports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("mapping");
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [calculatedData, setCalculatedData] = useState<PayrollCalculation[] | null>(null);
  const [payPeriodPreset, setPayPeriodPreset] = useState<PayPeriodPreset>("current");
  const [calculationError, setCalculationError] = useState<string | null>(null);
  
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [bambooIdInput, setBambooIdInput] = useState("");
  
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showExportResult, setShowExportResult] = useState(false);
  const [exportResult, setExportResult] = useState<PayrollExportResponse | null>(null);
  
  const [selectedExportId, setSelectedExportId] = useState<string | null>(null);
  const [showExportDetails, setShowExportDetails] = useState(false);
  
  const [isDuplicateConfirmed, setIsDuplicateConfirmed] = useState(false);
  const [duplicateExport, setDuplicateExport] = useState<PayrollExport | null>(null);

  useEffect(() => {
    const { start, end } = getPayPeriodDates("current");
    setStartDate(start);
    setEndDate(end);
  }, []);

  const { data: drivers, isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ["/api/admin/payroll/drivers"],
    enabled: activeTab === "mapping",
  });

  const { data: exportHistory, isLoading: historyLoading } = useQuery<PayrollExport[]>({
    queryKey: ["/api/admin/payroll/exports"],
    enabled: activeTab === "history" || activeTab === "export",
  });

  const { data: exportDetails, isLoading: detailsLoading } = useQuery<PayrollExportDetail>({
    queryKey: ["/api/admin/payroll/exports", selectedExportId],
    enabled: !!selectedExportId && showExportDetails,
  });

  const updateBambooIdMutation = useMutation({
    mutationFn: async ({ driverId, bambooEmployeeId }: { driverId: string; bambooEmployeeId: string }) => {
      return await apiRequest("PUT", `/api/admin/payroll/drivers/${driverId}/bamboo-id`, { bambooEmployeeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/drivers"] });
      toast({
        title: "Success",
        description: "BambooHR Employee ID updated successfully",
      });
      setEditingDriverId(null);
      setBambooIdInput("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update BambooHR Employee ID",
        variant: "destructive",
      });
    },
  });

  const calculatePayrollMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string; includeOvertime: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/payroll/calculate", data);
      if (!validatePayrollResponse(response)) {
        throw new Error("Invalid response format from server");
      }
      return response;
    },
    onSuccess: (data: PayrollCalculation[]) => {
      setCalculatedData(data);
      setCalculationError(null);
      if (data.length === 0) {
        toast({
          title: "No Data",
          description: "No clock events found for this pay period. Make sure drivers have clocked in/out during this time.",
        });
      } else {
        toast({
          title: "Success",
          description: `Payroll calculated for ${data.length} driver(s)`,
        });
      }
    },
    onError: (error: any) => {
      setCalculatedData(null);
      const errorMessage = error?.message || "Failed to calculate payroll. Please try again.";
      setCalculationError(errorMessage);
      toast({
        title: "Calculation Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const exportPayrollMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string; includeOvertime: boolean }) => {
      return await apiRequest("POST", "/api/admin/payroll/exports", data) as unknown as PayrollExportResponse;
    },
    onSuccess: (data: PayrollExportResponse) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/exports"] });
      setExportResult(data);
      setShowExportResult(true);
      setShowExportConfirm(false);
      setCalculatedData(null);
      setIsDuplicateConfirmed(false);
      setDuplicateExport(null);
      toast({
        title: "Export Complete",
        description: `Successfully exported payroll data for ${data.successfulEntries} drivers`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to export payroll",
        variant: "destructive",
      });
      setShowExportConfirm(false);
    },
  });

  const handleEditBambooId = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setBambooIdInput(driver.bambooEmployeeId || "");
  };

  const handleSaveBambooId = (driverId: string) => {
    if (!bambooIdInput.trim()) {
      toast({
        title: "Error",
        description: "BambooHR Employee ID cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    const bambooIdRegex = /^[a-zA-Z0-9_-]+$/;
    if (!bambooIdRegex.test(bambooIdInput.trim())) {
      toast({
        title: "Error",
        description: "BambooHR Employee ID must contain only letters, numbers, dashes, and underscores",
        variant: "destructive",
      });
      return;
    }
    
    updateBambooIdMutation.mutate({ driverId, bambooEmployeeId: bambooIdInput });
  };

  const handleCancelEdit = () => {
    setEditingDriverId(null);
    setBambooIdInput("");
  };

  const handleCalculatePreview = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    
    calculatePayrollMutation.mutate({ startDate, endDate, includeOvertime });
  };

  const handleExportClick = () => {
    if (!calculatedData) return;
    
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    
    const unmappedDrivers = calculatedData.filter(d => !d.bambooEmployeeId);
    if (unmappedDrivers.length > 0) {
      toast({
        title: "Error",
        description: "All drivers must have BambooHR Employee IDs mapped before exporting",
        variant: "destructive",
      });
      return;
    }
    
    const duplicate = exportHistory?.find(exp => {
      const expStart = exp.startDate.split('T')[0];
      const expEnd = exp.endDate.split('T')[0];
      return expStart === startDate && expEnd === endDate;
    });
    
    if (duplicate && duplicate.status === "success") {
      setDuplicateExport(duplicate);
      toast({
        title: "Warning",
        description: "This pay period has already been exported successfully. Are you sure you want to re-export?",
        variant: "destructive",
      });
    } else if (duplicate) {
      setDuplicateExport(duplicate);
    } else {
      setDuplicateExport(null);
      setIsDuplicateConfirmed(false);
    }
    
    setShowExportConfirm(true);
  };

  const handleConfirmExport = () => {
    exportPayrollMutation.mutate({ startDate, endDate, includeOvertime });
  };

  const handleViewExportDetails = (exportId: string) => {
    setSelectedExportId(exportId);
    setShowExportDetails(true);
  };

  const unmappedCount = drivers?.filter(d => !d.bambooEmployeeId).length || 0;
  const hasUnmappedDrivers = calculatedData?.some(d => !d.bambooEmployeeId) || false;

  const handlePresetChange = (preset: PayPeriodPreset) => {
    setPayPeriodPreset(preset);
    setCalculatedData(null);
    setCalculationError(null);
    if (preset !== "custom") {
      const { start, end } = getPayPeriodDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const lastExportForPeriod = useMemo(() => {
    if (!startDate || !endDate || !exportHistory) return null;
    return exportHistory.find(exp => {
      const expStart = exp.startDate.split('T')[0];
      const expEnd = exp.endDate.split('T')[0];
      return expStart === startDate && expEnd === endDate;
    });
  }, [startDate, endDate, exportHistory]);

  const selectedPeriodLabel = useMemo(() => {
    if (!startDate || !endDate) return "No period selected";
    return `${formatDate(startDate, "MMM dd")} - ${formatDate(endDate, "MMM dd, yyyy")}`;
  }, [startDate, endDate]);

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">Payroll Exports</h1>
        <p className="text-xs sm:text-base text-muted-foreground">Export driver hours to BambooHR</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Scrollable tabs for mobile */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto sm:w-auto min-w-max">
            <TabsTrigger value="mapping" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-employee-mapping">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Employee Mapping</span>
              <span className="sm:hidden">Map</span>
              {unmappedCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 sm:h-5 min-w-4 px-1 text-[10px] sm:text-xs">
                  {unmappedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-export-payroll">
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Export Payroll</span>
              <span className="sm:hidden">Export</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-export-history">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Export History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Driver to BambooHR Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              {driversLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : drivers && drivers.length > 0 ? (
                <>
                  {/* Mobile: Card layout */}
                  <div className="sm:hidden space-y-3">
                    {drivers.map((driver) => (
                      <div 
                        key={driver.id} 
                        className="p-3 border rounded-md space-y-2"
                        data-testid={`card-driver-${driver.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{driver.name}</span>
                          {!driver.bambooEmployeeId && (
                            <Badge variant="destructive" className="flex-shrink-0 text-[10px] h-5">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Unmapped
                            </Badge>
                          )}
                        </div>
                        
                        {editingDriverId === driver.id ? (
                          <div className="space-y-2">
                            <Input
                              value={bambooIdInput}
                              onChange={(e) => setBambooIdInput(e.target.value)}
                              placeholder="Enter BambooHR ID"
                              data-testid={`input-bamboo-id-${driver.id}`}
                              className="h-9"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handleSaveBambooId(driver.id)}
                                disabled={updateBambooIdMutation.isPending}
                                data-testid={`button-save-bamboo-id-${driver.id}`}
                              >
                                {updateBambooIdMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={handleCancelEdit}
                                data-testid={`button-cancel-bamboo-id-${driver.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              ID: {driver.bambooEmployeeId || "Not mapped"}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditBambooId(driver)}
                              data-testid={`button-edit-bamboo-id-${driver.id}`}
                            >
                              {driver.bambooEmployeeId ? "Update" : "Map"}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Table layout */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver Name</TableHead>
                          <TableHead>BambooHR Employee ID</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drivers.map((driver) => (
                          <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
                            <TableCell className="font-medium">
                              {driver.name}
                              {!driver.bambooEmployeeId && (
                                <Badge variant="destructive" className="ml-2">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Unmapped
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingDriverId === driver.id ? (
                                <Input
                                  value={bambooIdInput}
                                  onChange={(e) => setBambooIdInput(e.target.value)}
                                  placeholder="Enter BambooHR ID"
                                  data-testid={`input-bamboo-id-${driver.id}`}
                                  className="max-w-xs"
                                />
                              ) : (
                                <span className="text-muted-foreground">
                                  {driver.bambooEmployeeId || "Not mapped"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingDriverId === driver.id ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveBambooId(driver.id)}
                                    disabled={updateBambooIdMutation.isPending}
                                    data-testid={`button-save-bamboo-id-${driver.id}`}
                                  >
                                    {updateBambooIdMutation.isPending ? "Saving..." : "Save"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    data-testid={`button-cancel-bamboo-id-${driver.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditBambooId(driver)}
                                  data-testid={`button-edit-bamboo-id-${driver.id}`}
                                >
                                  {driver.bambooEmployeeId ? "Update" : "Map"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No drivers found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          {lastExportForPeriod && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm" data-testid="text-last-export-info">
                      This period was already exported on {formatDate(lastExportForPeriod.exportDate, "MMM dd, yyyy 'at' h:mm a")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lastExportForPeriod.status === "success" ? (
                        <span className="text-green-600 dark:text-green-400">
                          Successfully exported {lastExportForPeriod.driverCount} drivers ({lastExportForPeriod.totalHours.toFixed(1)} total hours)
                        </span>
                      ) : lastExportForPeriod.status === "partial" ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          Partial export: {lastExportForPeriod.successfulEntries} of {lastExportForPeriod.driverCount} drivers succeeded
                        </span>
                      ) : (
                        <span className="text-destructive">
                          Export failed - you may want to retry
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pay Period Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={payPeriodPreset === "previous" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("previous")}
                    data-testid="button-previous-period"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous Period
                  </Button>
                  <Button
                    variant={payPeriodPreset === "current" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("current")}
                    data-testid="button-current-period"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Current Period
                  </Button>
                  <Button
                    variant={payPeriodPreset === "custom" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("custom")}
                    data-testid="button-custom-period"
                  >
                    Custom Range
                  </Button>
                </div>
              </div>

              {startDate && endDate && payPeriodPreset !== "custom" && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Selected Period:</span>{" "}
                    <span data-testid="text-selected-period">{selectedPeriodLabel}</span>
                  </p>
                </div>
              )}

              {payPeriodPreset === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="start-date" className="text-sm font-medium">
                      Start Date
                    </label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="end-date" className="text-sm font-medium">
                      End Date
                    </label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-overtime"
                  checked={includeOvertime}
                  onCheckedChange={(checked) => setIncludeOvertime(checked as boolean)}
                  data-testid="checkbox-include-overtime"
                />
                <label
                  htmlFor="include-overtime"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include Overtime
                </label>
              </div>

              {calculationError && (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Calculation Error</p>
                      <p className="text-sm">{calculationError}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCalculatePreview}
                disabled={calculatePayrollMutation.isPending || !startDate || !endDate}
                data-testid="button-calculate-preview"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {calculatePayrollMutation.isPending ? "Calculating..." : "Calculate Preview"}
              </Button>
            </CardContent>
          </Card>

          {calculatedData && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <CardTitle>Payroll Preview</CardTitle>
                <Button
                  onClick={handleExportClick}
                  disabled={hasUnmappedDrivers || exportPayrollMutation.isPending}
                  data-testid="button-export-to-bamboo"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to BambooHR
                </Button>
              </CardHeader>
              <CardContent>
                {hasUnmappedDrivers && (
                  <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-md">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">
                        Some drivers are not mapped to BambooHR. Please map all drivers before exporting.
                      </span>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Regular Hours</TableHead>
                      <TableHead className="text-right">Overtime Hours</TableHead>
                      <TableHead className="text-right">Double-Time Hours</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead>Bamboo Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculatedData.map((calc) => (
                      <TableRow key={calc.driverId} data-testid={`row-calculation-${calc.driverId}`}>
                        <TableCell className="font-medium">{calc.driverName}</TableCell>
                        <TableCell className="text-right">{calc.regularHours.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{calc.overtimeHours.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{calc.doubleTimeHours.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{calc.totalHours.toFixed(2)}</TableCell>
                        <TableCell>
                          {calc.bambooEmployeeId ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Mapped
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Unmapped
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : exportHistory && exportHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Export Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Drivers</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportHistory.map((exp) => (
                      <TableRow key={exp.id} data-testid={`row-export-${exp.id}`}>
                        <TableCell>
                          {formatDate(exp.exportDate, "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {formatDate(exp.startDate, "MMM dd")} - {formatDate(exp.endDate, "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">{exp.driverCount}</TableCell>
                        <TableCell className="text-right">{exp.totalHours.toFixed(2)}</TableCell>
                        <TableCell>
                          {exp.status === "success" ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : exp.status === "partial" ? (
                            <Badge variant="secondary">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Partial ({exp.successfulEntries}/{exp.driverCount})
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewExportDetails(exp.id)}
                            data-testid={`button-view-export-${exp.id}`}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No export history found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showExportConfirm} onOpenChange={setShowExportConfirm}>
        <AlertDialogContent data-testid="dialog-confirm-export">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payroll Export</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Please review the export details before confirming:</p>
                <div className="space-y-2 rounded-md bg-muted p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium" data-testid="text-pay-period-label">Pay Period:</span>
                    <span data-testid="text-pay-period-value">{formatDate(startDate, "MMM dd, yyyy")} to {formatDate(endDate, "MMM dd, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium" data-testid="text-overtime-label">Overtime Included:</span>
                    <span data-testid="text-overtime-value">{includeOvertime ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium" data-testid="text-drivers-count-label">Drivers to Export:</span>
                    <span data-testid="text-drivers-count-value">{calculatedData?.length || 0}</span>
                  </div>
                  {calculatedData && calculatedData.filter(d => !d.bambooEmployeeId).length > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span className="font-medium" data-testid="text-unmapped-label">Unmapped Drivers:</span>
                      <span data-testid="text-unmapped-value">{calculatedData.filter(d => !d.bambooEmployeeId).length}</span>
                    </div>
                  )}
                </div>
                
                {duplicateExport && duplicateExport.status === "success" && (
                  <div className="rounded-md bg-destructive/10 border border-destructive p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <p className="font-medium text-destructive" data-testid="text-duplicate-warning">
                          Warning: This pay period was already exported
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Previous export on {formatDate(duplicateExport.exportDate, "MMM dd, yyyy HH:mm")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Status: <Badge variant="default" className="ml-1">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="duplicate-confirm"
                        checked={isDuplicateConfirmed}
                        onCheckedChange={(checked) => setIsDuplicateConfirmed(checked as boolean)}
                        data-testid="checkbox-duplicate-confirm"
                      />
                      <label
                        htmlFor="duplicate-confirm"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I understand this is a duplicate export
                      </label>
                    </div>
                  </div>
                )}
                
                {duplicateExport && duplicateExport.status === "failed" && (
                  <div className="rounded-md bg-muted border p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <p className="font-medium" data-testid="text-retry-info">
                          Retrying previous failed export
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Previous export on {formatDate(duplicateExport.exportDate, "MMM dd, yyyy HH:mm")} failed
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-muted-foreground">This will send payroll data to BambooHR. This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-export">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExport}
              disabled={exportPayrollMutation.isPending || (duplicateExport?.status === "success" && !isDuplicateConfirmed)}
              data-testid="button-confirm-export"
            >
              {exportPayrollMutation.isPending ? "Exporting..." : "Export"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showExportResult} onOpenChange={setShowExportResult}>
        <DialogContent data-testid="dialog-export-result">
          <DialogHeader>
            <DialogTitle>Export Results</DialogTitle>
            <DialogDescription>
              Payroll export completed
            </DialogDescription>
          </DialogHeader>
          {exportResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{exportResult.successfulEntries}</div>
                      <div className="text-sm text-muted-foreground">Successful</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <div className="text-2xl font-bold">{exportResult.failedEntries}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowExportResult(false)} data-testid="button-close-result">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportDetails} onOpenChange={setShowExportDetails}>
        <DialogContent className="max-w-4xl" data-testid="dialog-export-details">
          <DialogHeader>
            <DialogTitle>Export Details</DialogTitle>
            {exportDetails && (
              <DialogDescription>
                Exported on {formatDate(exportDetails.exportDate, "MMM dd, yyyy HH:mm")} for period {formatDate(exportDetails.startDate, "MMM dd")} - {formatDate(exportDetails.endDate, "MMM dd, yyyy")}
              </DialogDescription>
            )}
          </DialogHeader>
          {detailsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : exportDetails ? (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Regular</TableHead>
                    <TableHead className="text-right">Overtime</TableHead>
                    <TableHead className="text-right">Double-Time</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportDetails.entries.map((entry, idx) => (
                    <TableRow key={idx} data-testid={`row-export-detail-${idx}`}>
                      <TableCell className="font-medium">{entry.driverName}</TableCell>
                      <TableCell className="text-right">{entry.regularHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.overtimeHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.doubleTimeHours.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{entry.totalHours.toFixed(2)}</TableCell>
                      <TableCell>
                        {entry.status === "success" ? (
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                            {entry.errorMessage && (
                              <div className="text-xs text-destructive">{entry.errorMessage}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setShowExportDetails(false)} data-testid="button-close-details">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
