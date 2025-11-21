import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  Edit,
  Search,
  Clock,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  userId: string;
  userRole: "driver" | "parent";
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  changes: any;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export default function AuditLogSection() {
  const [roleFilter, setRoleFilter] = useState<"all" | "driver" | "parent">("all");
  const [actionFilter, setActionFilter] = useState<"all" | string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "time_exceptions" | "attendance" | "messages">("all");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    // Quick filters
    if (quickFilter === "time_exceptions") {
      const timeRelated = log.entityType === "shift" || log.entityType === "clock_event" || 
                          log.action === "clocked_in" || log.action === "clocked_out" ||
                          log.description.toLowerCase().includes("clock") ||
                          log.description.toLowerCase().includes("shift") ||
                          log.description.toLowerCase().includes("time");
      if (!timeRelated) return false;
    } else if (quickFilter === "attendance") {
      const attendanceRelated = log.action === "marked_attendance" ||
                                log.entityType === "attendance" ||
                                log.description.toLowerCase().includes("attendance");
      if (!attendanceRelated) return false;
    } else if (quickFilter === "messages") {
      const messageRelated = log.entityType === "message" ||
                             log.action === "sent_message" ||
                             log.description.toLowerCase().includes("message");
      if (!messageRelated) return false;
    }
    
    if (roleFilter !== "all" && log.userRole !== roleFilter) return false;
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesDescription = log.description.toLowerCase().includes(query);
      const matchesUser = `${log.user.firstName} ${log.user.lastName}`.toLowerCase().includes(query);
      const matchesEntity = log.entityType.toLowerCase().includes(query);
      if (!matchesDescription && !matchesUser && !matchesEntity) return false;
    }
    
    // Date range filter
    if (startDate) {
      const logDate = new Date(log.createdAt);
      const start = new Date(startDate);
      if (logDate < start) return false;
    }
    if (endDate) {
      const logDate = new Date(log.createdAt);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      if (logDate > end) return false;
    }
    
    return true;
  });

  const uniqueActions = logs
    ? Array.from(new Set(logs.map((log) => log.action)))
    : [];

  const getActionBadge = (action: string) => {
    switch (action) {
      case "created":
        return <Badge variant="outline" className="bg-success/10 text-success border-success"><CheckCircle className="w-3 h-3 mr-1" />Created</Badge>;
      case "updated":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary"><Edit className="w-3 h-3 mr-1" />Updated</Badge>;
      case "deleted":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive"><AlertCircle className="w-3 h-3 mr-1" />Deleted</Badge>;
      case "marked_attendance":
        return <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary"><CheckCircle className="w-3 h-3 mr-1" />Attendance</Badge>;
      case "reported_incident":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning"><AlertCircle className="w-3 h-3 mr-1" />Incident</Badge>;
      case "updated_profile":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary"><User className="w-3 h-3 mr-1" />Profile</Badge>;
      case "changed_phone":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary"><User className="w-3 h-3 mr-1" />Phone</Badge>;
      case "updated_student":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary"><Edit className="w-3 h-3 mr-1" />Student</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "driver":
        return <Badge variant="secondary">Driver</Badge>;
      case "parent":
        return <Badge variant="outline">Parent</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (isLoading) {
    return <AuditLogSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1" data-testid="heading-audit-log">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Track all changes made by drivers and parents across the system
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Activity Log ({filteredLogs?.length || 0})
              </CardTitle>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={quickFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuickFilter("all")}
                data-testid="button-filter-all"
              >
                All Logs
              </Button>
              <Button
                variant={quickFilter === "time_exceptions" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuickFilter("time_exceptions")}
                data-testid="button-filter-time"
              >
                <Clock className="w-4 h-4 mr-1" />
                Time Exceptions
              </Button>
              <Button
                variant={quickFilter === "attendance" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuickFilter("attendance")}
                data-testid="button-filter-attendance"
              >
                <UserCheck className="w-4 h-4 mr-1" />
                Attendance Updates
              </Button>
              <Button
                variant={quickFilter === "messages" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuickFilter("messages")}
                data-testid="button-filter-messages"
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Route Messages
              </Button>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger className="w-[140px]" data-testid="select-role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="driver">Drivers</SelectItem>
                  <SelectItem value="parent">Parents</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-action-filter">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="From"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-start-date"
              />
              <Input
                type="date"
                placeholder="To"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs && filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No audit logs found</p>
              <p className="text-sm">Changes made by drivers and parents will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs?.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {log.user?.firstName} {log.user?.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {log.user?.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(log.userRole)}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm">{log.description}</p>
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View details
                              </summary>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(log.createdAt), "MMM d, yyyy")}
                          <span className="text-xs">
                            {format(new Date(log.createdAt), "h:mm a")}
                          </span>
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
    </div>
  );
}

function AuditLogSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
