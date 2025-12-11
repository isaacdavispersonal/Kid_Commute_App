import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Car, Users, Star, ChevronUp, ChevronDown, MoreVertical } from "lucide-react";
import type { User as UserType } from "@shared/schema";

type SortField = "name" | "email" | "role" | "joined";
type SortDirection = "asc" | "desc";

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "driver" | "parent">("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    userId: string;
    newRole: "admin" | "driver" | "parent";
    userName: string;
  } | null>(null);

  const [sortField, setSortField] = useState<SortField>("role");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/users/${userId}/role`,
        { role }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to update user role. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const toggleLeadDriverMutation = useMutation({
    mutationFn: async ({ userId, isLeadDriver }: { userId: string; isLeadDriver: boolean }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/users/${userId}/lead-driver`,
        { isLeadDriver }
      );
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: variables.isLeadDriver ? "Lead Driver Enabled" : "Lead Driver Disabled",
        description: variables.isLeadDriver 
          ? "Driver now has access to Routes, Schedule, and Driver Assignments."
          : "Lead driver access has been removed.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to update lead driver status.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: "admin" | "driver" | "parent", userName: string) => {
    setConfirmDialog({ userId, newRole, userName });
  };

  const confirmRoleChange = () => {
    if (confirmDialog) {
      updateRoleMutation.mutate({
        userId: confirmDialog.userId,
        role: confirmDialog.newRole,
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "driver":
        return "secondary";
      case "parent":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-3 w-3" />;
      case "driver":
        return <Car className="h-3 w-3" />;
      case "parent":
        return <Users className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getRoleSortValue = (user: UserType): number => {
    if (user.role === "admin") return 1;
    if (user.role === "driver" && user.isLeadDriver) return 2;
    if (user.role === "driver") return 3;
    if (user.role === "parent") return 4;
    return 5;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-xs font-medium"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ChevronUp className="h-3 w-3 ml-1" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-1" />
        )
      ) : (
        <ChevronDown className="h-3 w-3 ml-1 opacity-30" />
      )}
    </Button>
  );

  const sortUsers = (userList: UserType[]): UserType[] => {
    return [...userList].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
          const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case "email":
          comparison = (a.email || "").toLowerCase().localeCompare((b.email || "").toLowerCase());
          break;
        case "role":
          comparison = getRoleSortValue(a) - getRoleSortValue(b);
          break;
        case "joined":
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const filteredUsers = useMemo(() => {
    const filtered = users?.filter((user) => {
      if (activeTab === "all") return true;
      return user.role === activeTab;
    }) || [];
    return sortUsers(filtered);
  }, [users, activeTab, sortField, sortDirection]);

  const renderUserActions = (user: UserType) => {
    if (user.id === currentUser?.id) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground px-2">You</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>You cannot change your own role</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${user.id}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.role === "driver" && (
            <>
              <DropdownMenuItem
                onClick={() =>
                  toggleLeadDriverMutation.mutate({
                    userId: user.id,
                    isLeadDriver: !user.isLeadDriver,
                  })
                }
                data-testid={`menu-toggle-lead-${user.id}`}
              >
                <Star className={`h-4 w-4 mr-2 ${user.isLeadDriver ? "text-yellow-500 fill-yellow-500" : ""}`} />
                {user.isLeadDriver ? "Remove Lead Driver" : "Make Lead Driver"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {user.role !== "admin" && (
            <DropdownMenuItem
              onClick={() =>
                handleRoleChange(
                  user.id,
                  "admin",
                  `${user.firstName} ${user.lastName}` || user.email || "this user"
                )
              }
              data-testid={`menu-make-admin-${user.id}`}
            >
              <Shield className="h-4 w-4 mr-2" />
              Make Admin
            </DropdownMenuItem>
          )}
          {user.role !== "driver" && (
            <DropdownMenuItem
              onClick={() =>
                handleRoleChange(
                  user.id,
                  "driver",
                  `${user.firstName} ${user.lastName}` || user.email || "this user"
                )
              }
              data-testid={`menu-make-driver-${user.id}`}
            >
              <Car className="h-4 w-4 mr-2" />
              Make Driver
            </DropdownMenuItem>
          )}
          {user.role !== "parent" && (
            <DropdownMenuItem
              onClick={() =>
                handleRoleChange(
                  user.id,
                  "parent",
                  `${user.firstName} ${user.lastName}` || user.email || "this user"
                )
              }
              data-testid={`menu-make-parent-${user.id}`}
            >
              <Users className="h-4 w-4 mr-2" />
              Make Parent
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderUserList = (userList: UserType[]) => {
    if (isLoading) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Loading users...
        </div>
      );
    }
    
    if (userList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No users found
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {userList.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between py-3 px-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
            data-testid={`row-user-${user.id}`}
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : "N/A"}
                </span>
                <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1 shrink-0" data-testid={`badge-role-${user.id}`}>
                  {getRoleIcon(user.role)}
                  <span className="text-xs">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </Badge>
                {user.role === "driver" && user.isLeadDriver && (
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate" data-testid={`text-email-${user.id}`}>
                {user.email}
              </p>
            </div>
            <div className="shrink-0 ml-2">
              {renderUserActions(user)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const adminUsers = useMemo(() => 
    sortUsers(users?.filter((u) => u.role === "admin") || []),
    [users, sortField, sortDirection]
  );
  const driverUsers = useMemo(() => 
    sortUsers(users?.filter((u) => u.role === "driver") || []),
    [users, sortField, sortDirection]
  );
  const parentUsers = useMemo(() => 
    sortUsers(users?.filter((u) => u.role === "parent") || []),
    [users, sortField, sortDirection]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage user roles and permissions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} data-testid="tabs-users">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="all" className="text-xs py-2" data-testid="tab-all">
            All ({users?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="admin" className="text-xs py-2" data-testid="tab-admins">
            <Shield className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Admins</span> ({adminUsers.length})
          </TabsTrigger>
          <TabsTrigger value="driver" className="text-xs py-2" data-testid="tab-drivers">
            <Car className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Drivers</span> ({driverUsers.length})
          </TabsTrigger>
          <TabsTrigger value="parent" className="text-xs py-2" data-testid="tab-parents">
            <Users className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Parents</span> ({parentUsers.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-1 mt-4 mb-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Sort:</span>
          <SortButton field="name">Name</SortButton>
          <SortButton field="email">Email</SortButton>
          <SortButton field="role">Role</SortButton>
          <SortButton field="joined">Joined</SortButton>
        </div>

        <TabsContent value="all" className="mt-2">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-base">All Users</CardTitle>
              <CardDescription className="text-xs">
                Tap the menu to change roles
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderUserList(filteredUsers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="mt-2">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-base">Administrators</CardTitle>
              <CardDescription className="text-xs">
                Full system access
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderUserList(adminUsers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="driver" className="mt-2">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-base">Drivers</CardTitle>
              <CardDescription className="text-xs">
                Lead drivers (star) have extra access
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderUserList(driverUsers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parent" className="mt-2">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-base">Parents</CardTitle>
              <CardDescription className="text-xs">
                View routes and communicate with drivers
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderUserList(parentUsers)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change {confirmDialog?.userName}'s role to{" "}
              <span className="font-semibold">
                {confirmDialog?.newRole ? confirmDialog.newRole.charAt(0).toUpperCase() + confirmDialog.newRole.slice(1) : ""}
              </span>
              ? This will change their access permissions immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRoleChange}
              data-testid="button-confirm-role-change"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
