import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Calendar, Camera, Trash2, Save, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBrand } from "@/components/lifeos/TopBrand";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { BASE_URL } from "@/constants/config";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  const handleSaveUsername = async () => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
    
    setIsSavingUsername(true);
    try {
      await api.updateProfile({ username });
      await refreshUser();
      setIsEditingUsername(false);
      toast.success("Username updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update username");
    } finally {
      setIsSavingUsername(false);
    }
  };
  
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }
    
    try {
      await api.deleteAccount();
      toast.success("Account deleted successfully");
      logout();
      navigate("/auth");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete account");
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };
  
  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBrand />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-serif font-medium text-foreground">Profile</h1>
        </div>
        
        {/* Avatar Section */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {user?.avatar_path ? (
                  <img 
                    src={`${BASE_URL}${user.avatar_path}`}
                    alt="Avatar" 
                    className="w-20 h-20 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <User className="w-10 h-10 text-primary" />
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-0 right-0 rounded-full w-7 h-7"
                onClick={() => document.getElementById("avatar-upload")?.click()}
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1">
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  try {
                    const result = await api.uploadAvatar(file);
                    toast.success("Avatar uploaded successfully");
                    await refreshUser();
                  } catch (error: any) {
                    toast.error(error?.message || "Failed to upload avatar");
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("avatar-upload")?.click()}
                className="text-xs"
              >
                Change Avatar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await api.deleteAvatar();
                    toast.success("Avatar removed");
                    await refreshUser();
                  } catch (error: any) {
                    toast.error(error?.message || "Failed to remove avatar");
                  }
                }}
                className="text-xs text-muted-foreground ml-2"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
        
        {/* Profile Information */}
        <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50 mb-6">
          {/* Username */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Username</Label>
                {isEditingUsername ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1"
                      disabled={isSavingUsername}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveUsername}
                      disabled={isSavingUsername}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setUsername(user?.username || "");
                        setIsEditingUsername(false);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-sans text-sm text-foreground">{user?.username || "Not set"}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingUsername(true)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Email (read-only) */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                <p className="font-sans text-sm text-foreground mt-1">{user?.email}</p>
              </div>
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          
          {/* Account Created */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Account Created</Label>
                <p className="font-sans text-sm text-foreground mt-1">
                  {user?.created_at ? formatDate(user.created_at) : "Unknown"}
                </p>
              </div>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        
        {/* Account Actions */}
        <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50">
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => {
                logout();
                navigate("/auth");
              }}
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </Button>
          </div>
          
          <div className="p-4">
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and all associated data.
                    <div className="mt-4 space-y-2">
                      <Label>Type "DELETE" to confirm:</Label>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="font-mono"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "DELETE"}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

