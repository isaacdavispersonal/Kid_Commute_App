import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Car, Users } from "lucide-react";
import type { User as UserType } from "@shared/schema";

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "driver" | "parent">("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    userId: string;
    newRole: "admin" | "driver" | "parent";
    userName: string;
  } | null>(null);

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

  // Filter users by active tab
  const filteredUsers = users?.filter((user) => {
    if (activeTab === "all") return true;
    return user.role === activeTab;
  }) || [];

  // Helper function to render user table
  const renderUserTable = (userList: UserType[]) => {
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Current Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userList.map((user) => (
            <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
              <TableCell className="font-medium">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : "N/A"}
              </TableCell>
              <TableCell data-testid={`text-email-${user.id}`}>
                {user.email}
              </TableCell>
              <TableCell>
                <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1" data-testid={`badge-role-${user.id}`}>
                  {getRoleIcon(user.role)}
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "N/A"}
              </TableCell>
              <TableCell className="text-right">
                {user.id === currentUser?.id ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          data-testid={`button-self-disabled-${user.id}`}
                        >
                          Your Account
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>You cannot change your own role</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="flex justify-end gap-2">
                    {user.role !== "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRoleChange(
                            user.id,
                            "admin",
                            `${user.firstName} ${user.lastName}` || user.email || "this user"
                          )
                        }
                        data-testid={`button-promote-admin-${user.id}`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        Make Admin
                      </Button>
                    )}
                    {user.role !== "driver" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRoleChange(
                            user.id,
                            "driver",
                            `${user.firstName} ${user.lastName}` || user.email || "this user"
                          )
                        }
                        data-testid={`button-promote-driver-${user.id}`}
                      >
                        <Car className="h-3 w-3 mr-1" />
                        Make Driver
                      </Button>
                    )}
                    {user.role !== "parent" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRoleChange(
                            user.id,
                            "parent",
                            `${user.firstName} ${user.lastName}` || user.email || "this user"
                          )
                        }
                        data-testid={`button-demote-parent-${user.id}`}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Make Parent
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const adminUsers = users?.filter((u) => u.role === "admin") || [];
  const driverUsers = users?.filter((u) => u.role === "driver") || [];
  const parentUsers = users?.filter((u) => u.role === "parent") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage user roles and permissions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} data-testid="tabs-users">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({users?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="admin" data-testid="tab-admins">
            <Shield className="h-3 w-3 mr-1" />
            Admins ({adminUsers.length})
          </TabsTrigger>
          <TabsTrigger value="driver" data-testid="tab-drivers">
            <Car className="h-3 w-3 mr-1" />
            Drivers ({driverUsers.length})
          </TabsTrigger>
          <TabsTrigger value="parent" data-testid="tab-parents">
            <Users className="h-3 w-3 mr-1" />
            Parents ({parentUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                View and manage user roles. Promote users to driver or admin as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserTable(filteredUsers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Administrators</CardTitle>
              <CardDescription>
                Users with full system access and administrative privileges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserTable(adminUsers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="driver" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Drivers</CardTitle>
              <CardDescription>
                Users who can manage shifts, report incidents, and clock in/out.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserTable(driverUsers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parent" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Parents</CardTitle>
              <CardDescription>
                Users who can view their children's routes and communicate with drivers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserTable(parentUsers)}
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
                {confirmDialog?.newRole.charAt(0).toUpperCase() + confirmDialog?.newRole.slice(1)}
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
