"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { signup } = useAuth();
  const router = useRouter();

  // Password strength checks
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptTerms) {
      setError("Please accept the terms and conditions");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isPasswordStrong) {
      setError("Please use a stronger password");
      return;
    }

    setIsLoading(true);

    const result = await signup({ email, username, password });

    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || "Signup failed");
    }

    setIsLoading(false);
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Start your trading journey today"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="trader123"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="h-12"
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
          />
          <p className="text-xs text-muted-foreground">
            3-20 characters, letters, numbers, and underscores only
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-12 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Password strength indicator */}
          {password && (
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-4 gap-1">
                {Object.values(passwordChecks).map((check, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      check ? "bg-profit" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={cn("flex items-center gap-1", passwordChecks.length ? "text-profit" : "text-muted-foreground")}>
                  <Check className="h-3 w-3" /> 8+ characters
                </div>
                <div className={cn("flex items-center gap-1", passwordChecks.uppercase ? "text-profit" : "text-muted-foreground")}>
                  <Check className="h-3 w-3" /> Uppercase
                </div>
                <div className={cn("flex items-center gap-1", passwordChecks.lowercase ? "text-profit" : "text-muted-foreground")}>
                  <Check className="h-3 w-3" /> Lowercase
                </div>
                <div className={cn("flex items-center gap-1", passwordChecks.number ? "text-profit" : "text-muted-foreground")}>
                  <Check className="h-3 w-3" /> Number
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={cn(
              "h-12",
              confirmPassword && password !== confirmPassword && "border-loss"
            )}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-loss">Passwords do not match</p>
          )}
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setAcceptTerms(!acceptTerms)}
            className={cn(
              "mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-colors",
              acceptTerms
                ? "bg-primary border-primary"
                : "border-input bg-background"
            )}
          >
            {acceptTerms && <Check className="h-3 w-3 text-primary-foreground" />}
          </button>
          <label className="text-sm text-muted-foreground">
            I agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button
          type="submit"
          variant="glow"
          className="w-full h-12"
          disabled={isLoading || !acceptTerms || !isPasswordStrong}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

