import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { User, Mail, Phone, MapPin, Save, CreditCard, Trash2, AlertTriangle, Users } from "lucide-react";
import type { User as UserType, UpdateProfile } from "@shared/schema";
import { formatPhoneNumber } from "@/lib/phoneFormat";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [newPhone, setNewPhone] = useState("");
  
  const { data: profile, isLoading } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const [formData, setFormData] = useState<UpdateProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    address: "",
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phoneNumber: profile.phone ? formatPhoneNumber(profile.phone) : "",
        address: profile.address || "",
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfile) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: async (data: { newPhoneNumber: string; syncToChildren: boolean }) => {
      const res = await apiRequest("POST", "/api/parent/update-phone", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      toast({
        title: "Phone Number Updated",
        description: "Your phone number and children's records have been updated successfully.",
      });
      setShowPhoneDialog(false);
      setNewPhone("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update phone number",
        variant: "destructive",
      });
    },
  });

  const handlePhoneUpdate = () => {
    if (!newPhone.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }
    // Always sync to children to maintain household links
    updatePhoneMutation.mutate({ newPhoneNumber: newPhone, syncToChildren: true });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/profile/delete-account");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted. Logging out...",
      });
      setTimeout(() => {
        window.location.href = "/api/auth/logout";
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirmText.trim().toLowerCase() !== "delete my account") {
      toast({
        title: "Error",
        description: 'Please type "DELETE MY ACCOUNT" to confirm',
        variant: "destructive",
      });
      return;
    }
    deleteAccountMutation.mutate();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phoneNumber: profile.phone ? formatPhoneNumber(profile.phone) : "",
        address: profile.address || "",
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComplete = profile?.firstName && profile?.lastName && profile?.email && profile?.phone && profile?.address;

  return (
    <div className="container max-w-3xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Management
            </CardTitle>
            <CardDescription>
              Manage your personal information and contact details
            </CardDescription>
          </div>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-profile"
            >
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!isComplete && !isEditing && (
            <div className="bg-warning/10 border border-warning text-warning-foreground rounded-md p-4 mb-6" data-testid="banner-incomplete-profile">
              <p className="text-sm font-medium">
                Your profile is incomplete. Please update your information to ensure smooth communication.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    value={formData.firstName || ""}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    disabled={!isEditing}
                    className="pl-10"
                    required
                    minLength={2}
                    data-testid="input-firstName"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lastName"
                    value={formData.lastName || ""}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    disabled={!isEditing}
                    className="pl-10"
                    required
                    minLength={2}
                    data-testid="input-lastName"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                  className="pl-10"
                  required
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                {profile?.role === "parent" && !isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewPhone(formData.phoneNumber || "");
                      setShowPhoneDialog(true);
                    }}
                    data-testid="button-change-phone"
                  >
                    Change Phone
                  </Button>
                )}
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber || ""}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setFormData({ ...formData, phoneNumber: formatted });
                  }}
                  disabled={!isEditing}
                  className="pl-10"
                  placeholder="(123) 456-7890"
                  required
                  maxLength={14}
                  data-testid="input-phoneNumber"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!isEditing}
                  className="pl-10 resize-none"
                  rows={3}
                  placeholder="123 Main St, City, State ZIP"
                  required
                  minLength={10}
                  data-testid="input-address"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Payment & Billing Section - Parents Only */}
      {profile?.role === "parent" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment & Billing
            </CardTitle>
            <CardDescription>
              Manage your transportation service billing and payment methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Billing Portal</AlertTitle>
              <AlertDescription>
                For account billing, payment history, and invoices, please contact your administrator or visit your organization's billing portal.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('mailto:billing@kidcommute.com?subject=Billing%20Inquiry', '_blank')}
                data-testid="button-contact-billing"
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Billing Support
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Household Management - Parents Only */}
      {profile?.role === "parent" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Household Management
            </CardTitle>
            <CardDescription>
              Manage your household and children's information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your household is automatically linked via your phone number. All children with matching guardian phone numbers are connected to your account.
            </p>
            <Button 
              asChild
              variant="outline" 
              className="w-full"
              data-testid="button-view-children"
            >
              <a href="/parent/children">
                <Users className="h-4 w-4 mr-2" />
                View & Manage Children
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Deletion */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Account Deletion
          </CardTitle>
          <CardDescription>
            Permanent account actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Deleting your account is permanent and cannot be undone. All your data will be permanently removed.
            </AlertDescription>
          </Alert>
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={() => setShowDeleteDialog(true)}
            data-testid="button-delete-account"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Phone Update Dialog for Parents */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent data-testid="dialog-change-phone">
          <DialogHeader>
            <DialogTitle>Update Phone Number</DialogTitle>
            <DialogDescription>
              Change your phone number. Your children's records will be updated automatically to keep you connected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPhone">New Phone Number</Label>
              <Input
                id="newPhone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))}
                placeholder="(123) 456-7890"
                maxLength={14}
                data-testid="input-new-phone"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Your children's guardian phone records will be automatically updated to maintain access to their profiles.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPhoneDialog(false)}
              disabled={updatePhoneMutation.isPending}
              data-testid="button-cancel-phone"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePhoneUpdate}
              disabled={updatePhoneMutation.isPending}
              data-testid="button-confirm-phone"
            >
              {updatePhoneMutation.isPending ? "Updating..." : "Update Phone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-testid="dialog-delete-account">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Final Warning</AlertTitle>
              <AlertDescription>
                You will lose access to all transportation services, messages, and your children's information.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">
                Type <span className="font-bold">DELETE MY ACCOUNT</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                data-testid="input-delete-confirm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
              disabled={deleteAccountMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending || deleteConfirmText.trim().toLowerCase() !== "delete my account"}
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
