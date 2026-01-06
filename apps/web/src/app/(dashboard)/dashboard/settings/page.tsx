"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { authApi, type Session } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Key,
  Smartphone,
  Monitor,
  Bell,
  Volume2,
  TrendingUp,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Save,
  LogOut,
} from "lucide-react";

// Toggle Switch Component
function Toggle({ 
  checked, 
  onChange, 
  disabled = false 
}: { 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
        checked ? "bg-primary" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// Slider Component
function Slider({
  value,
  onChange,
  min = 1,
  max = 20,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <span className="w-12 text-center font-mono font-semibold">{value}x</span>
    </div>
  );
}

// Parse user agent for display
function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown Device";
  
  if (ua.includes("Chrome")) {
    if (ua.includes("Mac")) return "Chrome on MacOS";
    if (ua.includes("Windows")) return "Chrome on Windows";
    if (ua.includes("Linux")) return "Chrome on Linux";
    return "Chrome";
  }
  if (ua.includes("Safari") && !ua.includes("Chrome")) {
    if (ua.includes("iPhone")) return "Safari on iPhone";
    if (ua.includes("iPad")) return "Safari on iPad";
    if (ua.includes("Mac")) return "Safari on MacOS";
    return "Safari";
  }
  if (ua.includes("Firefox")) {
    if (ua.includes("Mac")) return "Firefox on MacOS";
    if (ua.includes("Windows")) return "Firefox on Windows";
    return "Firefox";
  }
  return "Unknown Browser";
}

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  
  // Profile state
  const [displayName, setDisplayName] = useState(user?.fullName || user?.username || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  // Trading preferences (stored locally for now - could be extended to API)
  const [defaultLeverage, setDefaultLeverage] = useState(5);
  const [defaultOrderType, setDefaultOrderType] = useState<"market" | "limit">("market");
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [tradeConfirmations, setTradeConfirmations] = useState(true);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    const response = await authApi.getSessions();
    if (response.success && response.data) {
      setSessions(response.data.sessions);
    }
    setLoadingSessions(false);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileError("");
    setProfileSaved(false);

    const response = await authApi.updateProfile({ fullName: displayName });
    
    if (response.success) {
      setProfileSaved(true);
      if (refreshUser) {
        await refreshUser();
      }
      setTimeout(() => setProfileSaved(false), 3000);
    } else {
      setProfileError(response.error || "Failed to update profile");
    }
    
    setIsSavingProfile(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    
    const response = await authApi.changePassword(currentPassword, newPassword);
    
    if (response.success) {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } else {
      setPasswordError(response.error || "Failed to change password");
    }
    
    setIsChangingPassword(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    // In production, call API to delete account
    console.log("Deleting account...");
    logout();
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    
    const response = await authApi.revokeSession(sessionId);
    
    if (response.success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
    
    setRevokingSession(null);
  };

  const joinedDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      })
    : "January 2026";

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="pr-10"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  value={user?.username || ""}
                  disabled
                  className="pr-10"
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Joined</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{joinedDate}</span>
              </div>
            </div>
          </div>
          {profileError && (
            <p className="text-sm text-loss">{profileError}</p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : profileSaved ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {profileSaved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your password and security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Change Password */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Change Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            {passwordError && (
              <p className="text-sm text-loss">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-profit">Password changed successfully!</p>
            )}
            <Button 
              onClick={handleChangePassword} 
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              variant="secondary"
            >
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Update Password
            </Button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={is2FAEnabled ? "success" : "secondary"}>
                {is2FAEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Toggle checked={is2FAEnabled} onChange={setIs2FAEnabled} />
            </div>
          </div>

          {/* Active Sessions */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Active Sessions
            </h3>
            <div className="space-y-2">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No active sessions found</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          {parseUserAgent(session.userAgent)}
                          {session.isCurrent && (
                            <Badge variant="success" className="text-xs">Current</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.ipAddress || "Unknown IP"} · {formatLastActive(session.lastActiveAt)}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revokingSession === session.id}
                        className="text-loss hover:text-loss hover:bg-loss/10"
                      >
                        {revokingSession === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trading Preferences
          </CardTitle>
          <CardDescription>Customize your trading experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Leverage */}
          <div className="space-y-3">
            <Label>Default Leverage</Label>
            <Slider
              value={defaultLeverage}
              onChange={setDefaultLeverage}
              min={1}
              max={20}
            />
            <p className="text-xs text-muted-foreground">
              This will be the default leverage for new orders
            </p>
          </div>

          {/* Default Order Type */}
          <div className="space-y-3">
            <Label>Default Order Type</Label>
            <div className="flex gap-2">
              <Button
                variant={defaultOrderType === "market" ? "default" : "outline"}
                onClick={() => setDefaultOrderType("market")}
                className="flex-1"
              >
                Market
              </Button>
              <Button
                variant={defaultOrderType === "limit" ? "default" : "outline"}
                onClick={() => setDefaultOrderType("limit")}
                className="flex-1"
              >
                Limit
              </Button>
            </div>
          </div>

          {/* Notification Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Sound Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Play sounds for order fills and alerts
                  </p>
                </div>
              </div>
              <Toggle checked={soundNotifications} onChange={setSoundNotifications} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive emails for important account updates
                  </p>
                </div>
              </div>
              <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Trade Confirmations</p>
                  <p className="text-sm text-muted-foreground">
                    Show confirmation dialog before placing orders
                  </p>
                </div>
              </div>
              <Toggle checked={tradeConfirmations} onChange={setTradeConfirmations} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-loss/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-loss">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between p-4 rounded-lg border border-loss/30 bg-loss/5">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-loss/30 bg-loss/5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-loss mt-0.5" />
                <div>
                  <p className="font-medium text-loss">Are you absolutely sure?</p>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. This will permanently delete your account,
                    all trading accounts, trade history, and remove all associated data.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deleteConfirm">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </Label>
                <Input
                  id="deleteConfirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="max-w-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE"}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
