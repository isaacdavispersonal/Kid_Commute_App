import { useState, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle,
  Edit,
  Users,
  AlertTriangle,
  Download,
  Play,
  RotateCcw,
  Eye,
  XCircle,
  FileDown,
  Filter,
  UserX,
  Zap,
  ClockIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const PHOENIX_TZ = "America/Phoenix";

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "LOCKED" | "APPROVED" | "EXPORTED";
  lockedAt: string | null;
  lockedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
}

interface TimesheetEntry {
  id: string;
  driverId: string;
  payPeriodId: string | null;
  startAtUtc: string;
  endAtUtc: string | null;
  breakMinutes: number;
  status: "DRAFT" | "READY" | "APPROVED" | "EXPORTED";
  source: "CLOCK" | "ADMIN_EDIT" | "IMPORT";
  shiftId: string | null;
  notes: string | null;
  regularHours: string | null;
  overtimeHours: string | null;
  doubleTimeHours: string | null;
  totalHours: string | null;
  driver?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    bambooEmployeeId: string | null;
  };
}

interface DriverSummary {
  driverId: string;
  driverName: string;
  bambooEmployeeId: string | null;
  entries: TimesheetEntry[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  entryCount: number;
  needsReviewCount: number;
}

interface ExportJob {
  id: string;
  payPeriodId: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  mode: string;
  requestedByUserId: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalEntries: number;
  successfulEntries: number;
  failedEntries: number;
  errorSummary: string | null;
  createdAt: string;
  payPeriod?: {
    startDate: string;
    endDate: string;
  };
}

interface ExportJobEntry {
  id: string;
  jobId: string;
  timesheetEntryId: string | null;
  driverId: string;
  bambooEmployeeId: string;
  date: string;
  regularHours: string;
  overtimeHours: string;
  doubleTimeHours: string;
  totalHours: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  errorMessage: string | null;
  driver?: {
    firstName: string | null;
    lastName: string | null;
  };
}

interface ExportJobWithEntries extends ExportJob {
  entries: ExportJobEntry[];
}

interface ExportPreviewEntry {
  driverId: string;
  driverName: string;
  bambooEmployeeId: string | null;
  date: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
  timesheetEntryIds: string[];
}

interface ExportPreview {
  payPeriodId: string;
  payPeriodStatus: string;
  startDate: string;
  endDate: string;
  canExport: boolean;
  summary: {
    totalDrivers: number;
    totalDays: number;
    totalHours: number;
    driversWithMapping: number;
    driversWithoutMapping: number;
  };
  warnings: string[];
  entries: ExportPreviewEntry[];
}

function formatPayPeriodLabel(pp: PayPeriod): string {
  const start = parseISO(pp.startDate);
  const end = parseISO(pp.endDate);
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "OPEN":
      return "default";
    case "LOCKED":
      return "secondary";
    case "APPROVED":
      return "outline";
    case "EXPORTED":
      return "outline";
    default:
      return "default";
  }
}

function getEntryStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "DRAFT":
      return "destructive";
    case "READY":
      return "default";
    case "APPROVED":
      return "secondary";
    case "EXPORTED":
      return "outline";
    default:
      return "default";
  }
}

function getJobStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "QUEUED":
      return "secondary";
    case "RUNNING":
      return "default";
    case "SUCCESS":
      return "outline";
    case "PARTIAL":
      return "destructive";
    case "FAILED":
      return "destructive";
    default:
      return "default";
  }
}

function formatPhoenixTime(utcDate: string | null): string {
  if (!utcDate) return "—";
  try {
    return formatInTimeZone(new Date(utcDate), PHOENIX_TZ, "h:mm a");
  } catch {
    return "Invalid";
  }
}

function formatPhoenixDate(utcDate: string): string {
  try {
    return formatInTimeZone(new Date(utcDate), PHOENIX_TZ, "EEE, MMM d");
  } catch {
    return "Invalid";
  }
}

function formatDateTime(utcDate: string | null): string {
  if (!utcDate) return "—";
  try {
    return formatInTimeZone(new Date(utcDate), PHOENIX_TZ, "MMM d, yyyy h:mm a");
  } catch {
    return "Invalid";
  }
}

type EntryFilter = "all" | "draft" | "ready" | "approved" | "exported" | "suspicious" | "unmapped";

export default function AdminTimesheets({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("timesheets");
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState<string | null>(null);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editBreakMinutes, setEditBreakMinutes] = useState("0");
  const [editReason, setEditReason] = useState("");

  const [showExportPreviewDialog, setShowExportPreviewDialog] = useState(false);
  const [showJobDetailsDialog, setShowJobDetailsDialog] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [showBulkResolveDialog, setShowBulkResolveDialog] = useState(false);
  const [bulkResolveMethod, setBulkResolveMethod] = useState<"scheduled" | "manual">("scheduled");
  const [bulkManualEndTime, setBulkManualEndTime] = useState("");
  const [bulkResolveReason, setBulkResolveReason] = useState("");
  const [selectedDraftEntries, setSelectedDraftEntries] = useState<Set<string>>(new Set());

  const { data: payPeriods, isLoading: payPeriodsLoading } = useQuery<PayPeriod[]>({
    queryKey: ["/api/admin/pay-periods"],
  });

  const selectedPayPeriod = useMemo(() => {
    if (!payPeriods || payPeriods.length === 0) return null;
    if (selectedPayPeriodId) {
      return payPeriods.find(pp => pp.id === selectedPayPeriodId) || payPeriods[0];
    }
    return payPeriods[0];
  }, [payPeriods, selectedPayPeriodId]);

  const { data: entries, isLoading: entriesLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/admin/timesheet-entries", { payPeriodId: selectedPayPeriod?.id }],
    queryFn: async () => {
      if (!selectedPayPeriod?.id) return [];
      const response = await fetch(`/api/admin/timesheet-entries?payPeriodId=${selectedPayPeriod.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch entries");
      return response.json();
    },
    enabled: !!selectedPayPeriod?.id,
  });

  const { data: exportJobs, isLoading: exportJobsLoading } = useQuery<ExportJob[]>({
    queryKey: ["/api/admin/export-jobs"],
    enabled: activeTab === "export-jobs",
  });

  const { data: exportPreview, isLoading: previewLoading, refetch: refetchPreview } = useQuery<ExportPreview>({
    queryKey: ["/api/admin/pay-periods", selectedPayPeriod?.id, "export-preview"],
    queryFn: async () => {
      if (!selectedPayPeriod?.id) return null;
      const response = await fetch(`/api/admin/pay-periods/${selectedPayPeriod.id}/export-preview`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch export preview");
      return response.json();
    },
    enabled: false,
  });

  const { data: jobDetails, isLoading: jobDetailsLoading } = useQuery<ExportJobWithEntries>({
    queryKey: ["/api/admin/export-jobs", selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return null;
      const response = await fetch(`/api/admin/export-jobs/${selectedJobId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch job details");
      return response.json();
    },
    enabled: !!selectedJobId,
  });

  const issuesQueue = useMemo(() => {
    if (!entries || entries.length === 0) return { draftCount: 0, suspiciousCount: 0, unmappedDrivers: 0, draftEntries: [] as TimesheetEntry[] };
    
    const draftEntries = entries.filter(e => e.status === "DRAFT" || !e.endAtUtc);
    const suspiciousEntries = entries.filter(e => {
      const hours = parseFloat(e.totalHours || "0");
      return hours > 14;
    });
    const unmappedDriverIds = new Set(
      entries.filter(e => !e.driver?.bambooEmployeeId).map(e => e.driverId)
    );
    
    return {
      draftCount: draftEntries.length,
      suspiciousCount: suspiciousEntries.length,
      unmappedDrivers: unmappedDriverIds.size,
      draftEntries,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    
    switch (entryFilter) {
      case "draft":
        return entries.filter(e => e.status === "DRAFT" || !e.endAtUtc);
      case "ready":
        return entries.filter(e => e.status === "READY");
      case "approved":
        return entries.filter(e => e.status === "APPROVED");
      case "exported":
        return entries.filter(e => e.status === "EXPORTED");
      case "suspicious":
        return entries.filter(e => parseFloat(e.totalHours || "0") > 14);
      case "unmapped":
        return entries.filter(e => !e.driver?.bambooEmployeeId);
      default:
        return entries;
    }
  }, [entries, entryFilter]);

  const driverSummaries = useMemo<DriverSummary[]>(() => {
    if (!filteredEntries || filteredEntries.length === 0) return [];
    
    const grouped = filteredEntries.reduce((acc, entry) => {
      const driverId = entry.driverId;
      if (!acc[driverId]) {
        const driverName = entry.driver 
          ? `${entry.driver.firstName || ""} ${entry.driver.lastName || ""}`.trim() || "Unknown"
          : "Unknown";
        acc[driverId] = {
          driverId,
          driverName,
          bambooEmployeeId: entry.driver?.bambooEmployeeId || null,
          entries: [],
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          doubleTimeHours: 0,
          entryCount: 0,
          needsReviewCount: 0,
        };
      }
      acc[driverId].entries.push(entry);
      acc[driverId].entryCount++;
      acc[driverId].totalHours += parseFloat(entry.totalHours || "0");
      acc[driverId].regularHours += parseFloat(entry.regularHours || "0");
      acc[driverId].overtimeHours += parseFloat(entry.overtimeHours || "0");
      acc[driverId].doubleTimeHours += parseFloat(entry.doubleTimeHours || "0");
      if (entry.status === "DRAFT" || !entry.endAtUtc) {
        acc[driverId].needsReviewCount++;
      }
      return acc;
    }, {} as Record<string, DriverSummary>);
    
    return Object.values(grouped).sort((a, b) => a.driverName.localeCompare(b.driverName));
  }, [filteredEntries]);

  const createPayPeriodMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string }) => {
      return await apiRequest("POST", "/api/admin/pay-periods", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pay-periods"] });
      toast({ title: "Success", description: "Pay period created successfully" });
      setShowCreateDialog(false);
      setCreateStartDate("");
      setCreateEndDate("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create pay period", variant: "destructive" });
    },
  });

  const syncEntriesMutation = useMutation({
    mutationFn: async (payPeriodId: string) => {
      return await apiRequest("POST", "/api/admin/timesheet-entries/sync", { payPeriodId });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheet-entries"] });
      toast({ 
        title: "Sync Complete", 
        description: `Created ${result.created || 0} entries, skipped ${result.skipped || 0}` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to sync entries", variant: "destructive" });
    },
  });

  const lockPayPeriodMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/pay-periods/${id}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pay-periods"] });
      toast({ title: "Success", description: "Pay period locked" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to lock pay period", variant: "destructive" });
    },
  });

  const approvePayPeriodMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/pay-periods/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pay-periods"] });
      toast({ title: "Success", description: "Pay period approved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve pay period", variant: "destructive" });
    },
  });

  const unlockPayPeriodMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/pay-periods/${id}/unlock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pay-periods"] });
      toast({ title: "Success", description: "Pay period unlocked" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to unlock pay period", variant: "destructive" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async (data: { id: string; startAtUtc: string; endAtUtc: string | null; breakMinutes: number; reason: string }) => {
      return await apiRequest("PATCH", `/api/admin/timesheet-entries/${data.id}`, {
        startAtUtc: data.startAtUtc,
        endAtUtc: data.endAtUtc,
        breakMinutes: data.breakMinutes,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheet-entries"] });
      toast({ title: "Success", description: "Entry updated successfully" });
      setShowEditDialog(false);
      setEditingEntry(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update entry", variant: "destructive" });
    },
  });

  const createExportJobMutation = useMutation({
    mutationFn: async (payPeriodId: string) => {
      return await apiRequest("POST", "/api/admin/export-jobs", { payPeriodId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/export-jobs"] });
      toast({ title: "Success", description: "Export job created successfully" });
      setShowExportPreviewDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create export job", variant: "destructive" });
    },
  });

  const executeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest("POST", `/api/admin/export-jobs/${jobId}/execute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/export-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheet-entries"] });
      toast({ title: "Success", description: "Export job executed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to execute export job", variant: "destructive" });
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest("POST", `/api/admin/export-jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/export-jobs"] });
      toast({ title: "Success", description: "Retry initiated for failed entries" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to retry export", variant: "destructive" });
    },
  });

  const bulkResolveClockOutsMutation = useMutation({
    mutationFn: async (data: { entryIds: string[]; method: "scheduled" | "manual"; manualEndTime?: string; reason: string }) => {
      return await apiRequest("POST", "/api/admin/timesheet-entries/bulk-resolve-clockouts", data);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheet-entries"] });
      toast({ 
        title: "Success", 
        description: `Resolved ${result.resolved || 0} entries, ${result.failed || 0} failed` 
      });
      setShowBulkResolveDialog(false);
      setSelectedDraftEntries(new Set());
      setBulkResolveReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to resolve clock-outs", variant: "destructive" });
    },
  });

  const handleCreatePayPeriod = () => {
    if (!createStartDate || !createEndDate) {
      toast({ title: "Error", description: "Please select both start and end dates", variant: "destructive" });
      return;
    }
    createPayPeriodMutation.mutate({ startDate: createStartDate, endDate: createEndDate });
  };

  const handleStartDateChange = (value: string) => {
    setCreateStartDate(value);
    if (value) {
      const endDate = addDays(parseISO(value), 13);
      setCreateEndDate(format(endDate, "yyyy-MM-dd"));
    }
  };

  const handleEditEntry = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setEditStartTime(entry.startAtUtc ? format(new Date(entry.startAtUtc), "yyyy-MM-dd'T'HH:mm") : "");
    setEditEndTime(entry.endAtUtc ? format(new Date(entry.endAtUtc), "yyyy-MM-dd'T'HH:mm") : "");
    setEditBreakMinutes(String(entry.breakMinutes || 0));
    setEditReason("");
    setShowEditDialog(true);
  };

  const handleSaveEntry = () => {
    if (!editingEntry || !editReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason for the edit", variant: "destructive" });
      return;
    }
    updateEntryMutation.mutate({
      id: editingEntry.id,
      startAtUtc: new Date(editStartTime).toISOString(),
      endAtUtc: editEndTime ? new Date(editEndTime).toISOString() : null,
      breakMinutes: parseInt(editBreakMinutes) || 0,
      reason: editReason,
    });
  };

  const toggleDriverExpanded = (driverId: string) => {
    const newSet = new Set(expandedDrivers);
    if (newSet.has(driverId)) {
      newSet.delete(driverId);
    } else {
      newSet.add(driverId);
    }
    setExpandedDrivers(newSet);
  };

  const toggleJobExpanded = (jobId: string) => {
    const newSet = new Set(expandedJobs);
    if (newSet.has(jobId)) {
      newSet.delete(jobId);
    } else {
      newSet.add(jobId);
    }
    setExpandedJobs(newSet);
  };

  const handlePreviewExport = async () => {
    if (!selectedPayPeriod) return;
    await refetchPreview();
    setShowExportPreviewDialog(true);
  };

  const handleViewJobDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowJobDetailsDialog(true);
  };

  const handleOpenBulkResolve = () => {
    const draftIds = new Set(issuesQueue.draftEntries.map(e => e.id));
    setSelectedDraftEntries(draftIds);
    setShowBulkResolveDialog(true);
  };

  const handleBulkResolve = () => {
    if (!bulkResolveReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason for bulk resolution", variant: "destructive" });
      return;
    }
    if (bulkResolveMethod === "manual" && !bulkManualEndTime) {
      toast({ title: "Error", description: "Please enter an end time", variant: "destructive" });
      return;
    }
    if (selectedDraftEntries.size === 0) {
      toast({ title: "Error", description: "No entries selected", variant: "destructive" });
      return;
    }
    
    bulkResolveClockOutsMutation.mutate({
      entryIds: Array.from(selectedDraftEntries),
      method: bulkResolveMethod,
      manualEndTime: bulkResolveMethod === "manual" ? new Date(bulkManualEndTime).toISOString() : undefined,
      reason: bulkResolveReason,
    });
  };

  const toggleDraftEntrySelection = (entryId: string) => {
    const newSet = new Set(selectedDraftEntries);
    if (newSet.has(entryId)) {
      newSet.delete(entryId);
    } else {
      newSet.add(entryId);
    }
    setSelectedDraftEntries(newSet);
  };

  const selectAllDraftEntries = (select: boolean) => {
    if (select) {
      setSelectedDraftEntries(new Set(issuesQueue.draftEntries.map(e => e.id)));
    } else {
      setSelectedDraftEntries(new Set());
    }
  };

  const filteredExportJobs = useMemo(() => {
    if (!exportJobs) return [];
    if (!selectedPayPeriod) return exportJobs;
    return exportJobs.filter(job => job.payPeriodId === selectedPayPeriod.id);
  }, [exportJobs, selectedPayPeriod]);

  const tabsContent = (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="timesheets" className="flex items-center gap-2 py-2" data-testid="tab-timesheets">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Timesheets</span>
            <span className="sm:hidden">Time</span>
          </TabsTrigger>
          <TabsTrigger value="pay-periods" className="flex items-center gap-2 py-2" data-testid="tab-pay-periods">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Pay Periods</span>
            <span className="sm:hidden">Periods</span>
          </TabsTrigger>
          <TabsTrigger value="export-jobs" className="flex items-center gap-2 py-2" data-testid="tab-export-jobs">
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Export Jobs</span>
            <span className="sm:hidden">Export</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="mt-4 sm:mt-6 space-y-4">
          {(issuesQueue.draftCount > 0 || issuesQueue.suspiciousCount > 0 || issuesQueue.unmappedDrivers > 0) && (
            <Card data-testid="card-issues-queue">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Issues Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 items-center">
                  {issuesQueue.draftCount > 0 && (
                    <Button
                      variant={entryFilter === "draft" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEntryFilter(entryFilter === "draft" ? "all" : "draft")}
                      className="gap-2"
                      data-testid="button-filter-draft"
                    >
                      <ClockIcon className="w-4 h-4" />
                      {issuesQueue.draftCount} Missing Clock-out
                    </Button>
                  )}
                  {issuesQueue.suspiciousCount > 0 && (
                    <Button
                      variant={entryFilter === "suspicious" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEntryFilter(entryFilter === "suspicious" ? "all" : "suspicious")}
                      className="gap-2"
                      data-testid="button-filter-suspicious"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      {issuesQueue.suspiciousCount} Suspicious Duration
                    </Button>
                  )}
                  {issuesQueue.unmappedDrivers > 0 && (
                    <Button
                      variant={entryFilter === "unmapped" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEntryFilter(entryFilter === "unmapped" ? "all" : "unmapped")}
                      className="gap-2"
                      data-testid="button-filter-unmapped"
                    >
                      <UserX className="w-4 h-4" />
                      {issuesQueue.unmappedDrivers} Unmapped Drivers
                    </Button>
                  )}
                  <div className="ml-auto">
                    {issuesQueue.draftCount > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleOpenBulkResolve}
                        className="gap-2"
                        data-testid="button-bulk-resolve"
                      >
                        <Zap className="w-4 h-4" />
                        Auto-resolve Clock-outs
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 space-y-0 pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-sm font-medium">Pay Period:</Label>
                {payPeriodsLoading ? (
                  <Skeleton className="h-9 w-48" />
                ) : (
                  <Select 
                    value={selectedPayPeriod?.id || ""} 
                    onValueChange={setSelectedPayPeriodId}
                    data-testid="select-pay-period"
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select pay period" />
                    </SelectTrigger>
                    <SelectContent>
                      {payPeriods?.map(pp => (
                        <SelectItem key={pp.id} value={pp.id}>
                          <div className="flex items-center gap-2">
                            <span>{formatPayPeriodLabel(pp)}</span>
                            <Badge variant={getStatusBadgeVariant(pp.status)} className="text-xs">
                              {pp.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select 
                  value={entryFilter} 
                  onValueChange={(val) => setEntryFilter(val as EntryFilter)}
                  data-testid="select-entry-filter"
                >
                  <SelectTrigger className="w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entries</SelectItem>
                    <SelectItem value="draft">Needs Review (DRAFT)</SelectItem>
                    <SelectItem value="ready">Ready for Export</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="exported">Exported</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateDialog(true)}
                  data-testid="button-create-pay-period"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Pay Period
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedPayPeriod && syncEntriesMutation.mutate(selectedPayPeriod.id)}
                  disabled={!selectedPayPeriod || syncEntriesMutation.isPending}
                  data-testid="button-sync-entries"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${syncEntriesMutation.isPending ? "animate-spin" : ""}`} />
                  Sync Clock Events
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : driverSummaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No timesheet entries for this pay period.</p>
                  <p className="text-sm mt-1">Click "Sync Clock Events" to import entries from clock events.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {driverSummaries.map(summary => (
                    <Collapsible
                      key={summary.driverId}
                      open={expandedDrivers.has(summary.driverId)}
                      onOpenChange={() => toggleDriverExpanded(summary.driverId)}
                    >
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <button
                            className="w-full p-4 text-left hover-elevate flex items-center justify-between gap-4"
                            data-testid={`button-expand-driver-${summary.driverId}`}
                          >
                            <div className="flex items-center gap-3">
                              {expandedDrivers.has(summary.driverId) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              <div>
                                <div className="font-medium">{summary.driverName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap justify-end">
                              {summary.needsReviewCount > 0 && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {summary.needsReviewCount} Needs Review
                                </Badge>
                              )}
                              {summary.bambooEmployeeId ? (
                                <Badge variant="outline" className="text-xs">Mapped</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Unmapped</Badge>
                              )}
                              <div className="text-right min-w-24">
                                <div className="font-semibold">{summary.totalHours.toFixed(2)} hrs</div>
                                <div className="text-xs text-muted-foreground">
                                  {summary.regularHours.toFixed(1)} reg
                                  {summary.overtimeHours > 0 && ` / ${summary.overtimeHours.toFixed(1)} OT`}
                                  {summary.doubleTimeHours > 0 && ` / ${summary.doubleTimeHours.toFixed(1)} DT`}
                                </div>
                              </div>
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Clock In</TableHead>
                                  <TableHead>Clock Out</TableHead>
                                  <TableHead>Break</TableHead>
                                  <TableHead>Hours</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Source</TableHead>
                                  <TableHead className="w-12"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {summary.entries.map(entry => (
                                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                                    <TableCell className="font-medium">
                                      {formatPhoenixDate(entry.startAtUtc)}
                                    </TableCell>
                                    <TableCell>{formatPhoenixTime(entry.startAtUtc)}</TableCell>
                                    <TableCell>
                                      {entry.endAtUtc ? formatPhoenixTime(entry.endAtUtc) : (
                                        <span className="text-destructive">Missing</span>
                                      )}
                                    </TableCell>
                                    <TableCell>{entry.breakMinutes || 0} min</TableCell>
                                    <TableCell>
                                      {entry.totalHours ? parseFloat(entry.totalHours).toFixed(2) : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={getEntryStatusBadgeVariant(entry.status)}>
                                        {entry.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {entry.source}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditEntry(entry);
                                        }}
                                        data-testid={`button-edit-entry-${entry.id}`}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pay-periods" className="mt-4 sm:mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <CardTitle>Pay Periods</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                data-testid="button-create-pay-period-tab"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Pay Period
              </Button>
            </CardHeader>
            <CardContent>
              {payPeriodsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !payPeriods || payPeriods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pay periods found.</p>
                  <p className="text-sm mt-1">Create a pay period to start tracking timesheets.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payPeriods.map(pp => (
                      <TableRow key={pp.id} data-testid={`row-pay-period-${pp.id}`}>
                        <TableCell className="font-medium">
                          {formatPayPeriodLabel(pp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(pp.status)}>
                            {pp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                          {pp.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {pp.status === "OPEN" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => lockPayPeriodMutation.mutate(pp.id)}
                                disabled={lockPayPeriodMutation.isPending}
                                data-testid={`button-lock-${pp.id}`}
                              >
                                <Lock className="w-4 h-4 mr-1" />
                                Lock
                              </Button>
                            )}
                            {pp.status === "LOCKED" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => unlockPayPeriodMutation.mutate(pp.id)}
                                  disabled={unlockPayPeriodMutation.isPending}
                                  data-testid={`button-unlock-${pp.id}`}
                                >
                                  <Unlock className="w-4 h-4 mr-1" />
                                  Unlock
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => approvePayPeriodMutation.mutate(pp.id)}
                                  disabled={approvePayPeriodMutation.isPending}
                                  data-testid={`button-approve-${pp.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              </>
                            )}
                            {pp.status === "APPROVED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => unlockPayPeriodMutation.mutate(pp.id)}
                                disabled={unlockPayPeriodMutation.isPending}
                                data-testid={`button-unlock-approved-${pp.id}`}
                              >
                                <Unlock className="w-4 h-4 mr-1" />
                                Unlock
                              </Button>
                            )}
                            {pp.status === "EXPORTED" && (
                              <span className="text-sm text-muted-foreground">Exported</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export-jobs" className="mt-4 sm:mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 space-y-0 pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-sm font-medium">Pay Period:</Label>
                {payPeriodsLoading ? (
                  <Skeleton className="h-9 w-48" />
                ) : (
                  <Select 
                    value={selectedPayPeriod?.id || ""} 
                    onValueChange={setSelectedPayPeriodId}
                    data-testid="select-pay-period-export"
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select pay period" />
                    </SelectTrigger>
                    <SelectContent>
                      {payPeriods?.map(pp => (
                        <SelectItem key={pp.id} value={pp.id}>
                          <div className="flex items-center gap-2">
                            <span>{formatPayPeriodLabel(pp)}</span>
                            <Badge variant={getStatusBadgeVariant(pp.status)} className="text-xs">
                              {pp.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewExport}
                  disabled={!selectedPayPeriod || previewLoading}
                  data-testid="button-preview-export"
                >
                  {previewLoading ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-1" />
                  )}
                  Preview Export
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => selectedPayPeriod && createExportJobMutation.mutate(selectedPayPeriod.id)}
                  disabled={!selectedPayPeriod || createExportJobMutation.isPending}
                  data-testid="button-create-export-job"
                >
                  {createExportJobMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  Create Export Job
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {exportJobsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !filteredExportJobs || filteredExportJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No export jobs for this pay period.</p>
                  <p className="text-sm mt-1">Click "Preview Export" to review data, then "Create Export Job" to start.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Pay Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Entries</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExportJobs.map(job => (
                        <TableRow 
                          key={job.id} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => toggleJobExpanded(job.id)}
                          data-testid={`row-export-job-${job.id}`}
                        >
                          <TableCell>
                            {expandedJobs.has(job.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDateTime(job.createdAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {job.payPeriod ? (
                              `${format(parseISO(job.payPeriod.startDate), "MMM d")} - ${format(parseISO(job.payPeriod.endDate), "MMM d")}`
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getJobStatusBadgeVariant(job.status)} data-testid={`badge-job-status-${job.id}`}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {job.mode}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              {job.successfulEntries > 0 && (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {job.successfulEntries}
                                </span>
                              )}
                              {job.failedEntries > 0 && (
                                <span className="text-destructive flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  {job.failedEntries}
                                </span>
                              )}
                              <span className="text-muted-foreground">/ {job.totalEntries}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewJobDetails(job.id)}
                                data-testid={`button-view-job-${job.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {job.status === "QUEUED" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => executeJobMutation.mutate(job.id)}
                                  disabled={executeJobMutation.isPending}
                                  data-testid={`button-execute-job-${job.id}`}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Execute
                                </Button>
                              )}
                              {(job.status === "PARTIAL" || job.status === "FAILED") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => retryJobMutation.mutate(job.id)}
                                  disabled={retryJobMutation.isPending}
                                  data-testid={`button-retry-job-${job.id}`}
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Retry
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
  );

  const dialogs = (
    <>
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-pay-period">
          <DialogHeader>
            <DialogTitle>Create Pay Period</DialogTitle>
            <DialogDescription>
              Create a new pay period for timesheet tracking. Default is a 14-day period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={createStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={createEndDate}
                onChange={(e) => setCreateEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePayPeriod} 
              disabled={createPayPeriodMutation.isPending}
              data-testid="button-submit-create-pay-period"
            >
              {createPayPeriodMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent data-testid="dialog-edit-entry">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update the clock in/out times for this entry. A reason is required for all edits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start">Clock In</Label>
              <Input
                id="edit-start"
                type="datetime-local"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                data-testid="input-edit-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">Clock Out</Label>
              <Input
                id="edit-end"
                type="datetime-local"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
                data-testid="input-edit-end"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-break">Break Minutes</Label>
              <Input
                id="edit-break"
                type="number"
                min="0"
                value={editBreakMinutes}
                onChange={(e) => setEditBreakMinutes(e.target.value)}
                data-testid="input-edit-break"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason for Edit *</Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this entry is being modified..."
                data-testid="input-edit-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEntry} 
              disabled={updateEntryMutation.isPending || !editReason.trim()}
              data-testid="button-submit-edit-entry"
            >
              {updateEntryMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportPreviewDialog} onOpenChange={setShowExportPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-export-preview">
          <DialogHeader>
            <DialogTitle>Export Preview</DialogTitle>
            <DialogDescription>
              Review the data that will be exported to BambooHR for this pay period.
            </DialogDescription>
          </DialogHeader>
          
          {previewLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : exportPreview ? (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Total Drivers</div>
                  <div className="text-2xl font-bold" data-testid="text-preview-drivers">
                    {exportPreview.summary.totalDrivers}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Total Days</div>
                  <div className="text-2xl font-bold" data-testid="text-preview-days">
                    {exportPreview.summary.totalDays}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Total Hours</div>
                  <div className="text-2xl font-bold" data-testid="text-preview-hours">
                    {exportPreview.summary.totalHours.toFixed(1)}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Can Export</div>
                  <div className="text-2xl font-bold" data-testid="text-preview-can-export">
                    {exportPreview.canExport ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-destructive" />
                    )}
                  </div>
                </Card>
              </div>

              {exportPreview.warnings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Warnings</Label>
                  <div className="space-y-2">
                    {exportPreview.warnings.map((warning, i) => (
                      <div 
                        key={i} 
                        className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm"
                        data-testid={`warning-${i}`}
                      >
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="font-medium">{warning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                <Label className="text-sm font-medium">Entries ({exportPreview.entries.length})</Label>
                <ScrollArea className="h-64 mt-2 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Reg</TableHead>
                        <TableHead>OT</TableHead>
                        <TableHead>DT</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportPreview.entries.map((entry, i) => (
                        <TableRow key={i} data-testid={`row-preview-entry-${i}`}>
                          <TableCell className="font-medium">{entry.driverName}</TableCell>
                          <TableCell>{format(parseISO(entry.date), "MMM d")}</TableCell>
                          <TableCell>{entry.regularHours.toFixed(1)}</TableCell>
                          <TableCell>{entry.overtimeHours.toFixed(1)}</TableCell>
                          <TableCell>{entry.doubleTimeHours.toFixed(1)}</TableCell>
                          <TableCell className="font-semibold">{entry.totalHours.toFixed(1)}</TableCell>
                          <TableCell>
                            {entry.bambooEmployeeId ? (
                              <Badge variant="default" className="text-xs">Ready</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Unmapped</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No preview data available
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportPreviewDialog(false)}>
              Close
            </Button>
            {exportPreview?.canExport && (
              <Button
                onClick={() => {
                  if (selectedPayPeriod) {
                    createExportJobMutation.mutate(selectedPayPeriod.id);
                  }
                }}
                disabled={createExportJobMutation.isPending}
                data-testid="button-proceed-export"
              >
                {createExportJobMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Proceed to Export
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showJobDetailsDialog} onOpenChange={setShowJobDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-job-details">
          <DialogHeader>
            <DialogTitle>Export Job Details</DialogTitle>
            <DialogDescription>
              View the status and results of each entry in this export job.
            </DialogDescription>
          </DialogHeader>
          
          {jobDetailsLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : jobDetails ? (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={getJobStatusBadgeVariant(jobDetails.status)} className="mt-1" data-testid="text-job-status">
                    {jobDetails.status}
                  </Badge>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Mode</div>
                  <div className="text-lg font-bold" data-testid="text-job-mode">{jobDetails.mode}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-lg font-bold" data-testid="text-job-total">{jobDetails.totalEntries}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Success</div>
                  <div className="text-lg font-bold text-green-600" data-testid="text-job-success">{jobDetails.successfulEntries}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-sm text-muted-foreground">Failed</div>
                  <div className="text-lg font-bold text-destructive" data-testid="text-job-failed">{jobDetails.failedEntries}</div>
                </Card>
              </div>

              {jobDetails.errorSummary && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <div className="font-medium mb-1">Error Summary</div>
                  <div data-testid="text-job-error-summary">{jobDetails.errorSummary}</div>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                <Label className="text-sm font-medium">Entry Results ({jobDetails.entries?.length || 0})</Label>
                <ScrollArea className="h-64 mt-2 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>BambooHR ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobDetails.entries?.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-job-entry-${entry.id}`}>
                          <TableCell className="font-medium">
                            {entry.driver 
                              ? `${entry.driver.firstName || ""} ${entry.driver.lastName || ""}`.trim() 
                              : "Unknown"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.bambooEmployeeId}
                          </TableCell>
                          <TableCell>{format(parseISO(entry.date), "MMM d")}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{parseFloat(entry.totalHours).toFixed(1)}</span>
                              <span className="text-muted-foreground ml-1">
                                ({parseFloat(entry.regularHours).toFixed(1)} reg
                                {parseFloat(entry.overtimeHours) > 0 && ` + ${parseFloat(entry.overtimeHours).toFixed(1)} OT`}
                                {parseFloat(entry.doubleTimeHours) > 0 && ` + ${parseFloat(entry.doubleTimeHours).toFixed(1)} DT`})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getJobStatusBadgeVariant(entry.status)} className="text-xs">
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {entry.errorMessage ? (
                              <span className="text-destructive text-xs truncate block" title={entry.errorMessage}>
                                {entry.errorMessage}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No job details available
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDetailsDialog(false)}>
              Close
            </Button>
            {jobDetails && (jobDetails.status === "PARTIAL" || jobDetails.status === "FAILED") && (
              <Button
                onClick={() => retryJobMutation.mutate(jobDetails.id)}
                disabled={retryJobMutation.isPending}
                data-testid="button-retry-job-dialog"
              >
                {retryJobMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-1" />
                )}
                Retry Failed Entries
              </Button>
            )}
            {jobDetails && jobDetails.status === "QUEUED" && (
              <Button
                onClick={() => executeJobMutation.mutate(jobDetails.id)}
                disabled={executeJobMutation.isPending}
                data-testid="button-execute-job-dialog"
              >
                {executeJobMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                Execute Job
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkResolveDialog} onOpenChange={setShowBulkResolveDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-bulk-resolve">
          <DialogHeader>
            <DialogTitle>Auto-resolve Missing Clock-outs</DialogTitle>
            <DialogDescription>
              Select entries with missing clock-outs and choose how to resolve them. A reason is required for all changes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Resolution Method</Label>
                <Select 
                  value={bulkResolveMethod} 
                  onValueChange={(val) => setBulkResolveMethod(val as "scheduled" | "manual")}
                  data-testid="select-bulk-resolve-method"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Use Scheduled End Time</SelectItem>
                    <SelectItem value="manual">Set Manual End Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {bulkResolveMethod === "manual" && (
                <div className="space-y-2">
                  <Label htmlFor="bulk-end-time">End Time</Label>
                  <Input
                    id="bulk-end-time"
                    type="datetime-local"
                    value={bulkManualEndTime}
                    onChange={(e) => setBulkManualEndTime(e.target.value)}
                    data-testid="input-bulk-end-time"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="bulk-reason">Reason for Resolution *</Label>
                <Textarea
                  id="bulk-reason"
                  value={bulkResolveReason}
                  onChange={(e) => setBulkResolveReason(e.target.value)}
                  placeholder="Explain why these entries are being resolved..."
                  data-testid="input-bulk-reason"
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">
                  Entries to Resolve ({selectedDraftEntries.size} of {issuesQueue.draftEntries.length} selected)
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedDraftEntries.size === issuesQueue.draftEntries.length && issuesQueue.draftEntries.length > 0}
                    onCheckedChange={(checked) => selectAllDraftEntries(!!checked)}
                    data-testid="checkbox-select-all"
                  />
                  <Label htmlFor="select-all" className="text-sm">Select All</Label>
                </div>
              </div>
              <ScrollArea className="h-48 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issuesQueue.draftEntries.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-draft-entry-${entry.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDraftEntries.has(entry.id)}
                            onCheckedChange={() => toggleDraftEntrySelection(entry.id)}
                            data-testid={`checkbox-entry-${entry.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.driver 
                            ? `${entry.driver.firstName || ""} ${entry.driver.lastName || ""}`.trim() 
                            : "Unknown"}
                        </TableCell>
                        <TableCell>{formatPhoenixDate(entry.startAtUtc)}</TableCell>
                        <TableCell>{formatPhoenixTime(entry.startAtUtc)}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">Missing Clock-out</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkResolveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkResolve}
              disabled={bulkResolveClockOutsMutation.isPending || selectedDraftEntries.size === 0 || !bulkResolveReason.trim()}
              data-testid="button-submit-bulk-resolve"
            >
              {bulkResolveClockOutsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-1" />
              )}
              Resolve {selectedDraftEntries.size} Entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return <>{tabsContent}{dialogs}</>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1" data-testid="heading-admin-timesheets">
          Timesheets
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage employee time entries and pay periods
        </p>
      </div>
      {tabsContent}
      {dialogs}
    </div>
  );
}
