import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, CheckCircle, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function validatePassword(password: string) {
  return {
    hasMinLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(password),
  };
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  
  useEffect(() => {
    // Get token from URL using window.location for reliability
    const urlParams = new URLSearchParams(window.location.search);
    setToken(urlParams.get("token"));
    setTokenChecked(true);
  }, []);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordValid = passwordValidation.hasMinLength && 
    passwordValidation.hasLetter && 
    passwordValidation.hasNumber && 
    passwordValidation.hasSpecial;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      toast({
        title: "Invalid password",
        description: "Please make sure your password meets all requirements.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setIsSuccess(true);
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!tokenChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Invalid Reset Link</h2>
                <p className="text-muted-foreground mb-6">
                  This password reset link is invalid or has expired.
                </p>
                <Link href="/forgot-password">
                  <Button className="w-full" data-testid="button-request-new">
                    Request a new reset link
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-2">
              <img src="/creator-catalyst-logo.png" alt="Creator Catalyst" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Lilita One', cursive", color: 'hsl(199 89% 60%)' }}>Creator Catalyst</h1>
            </div>
            <p className="text-muted-foreground text-sm">Creator Dashboard</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Password Reset Successful</h2>
                <p className="text-muted-foreground mb-6">
                  Your password has been updated. You can now log in with your new password.
                </p>
                <Link href="/login">
                  <Button className="w-full" data-testid="button-go-to-login">
                    Go to login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <img src="/creator-catalyst-logo.png" alt="Creator Catalyst" className="w-10 h-10 object-contain" />
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Lilita One', cursive", color: 'hsl(199 89% 60%)' }}>Creator Catalyst</h1>
          </div>
          <p className="text-muted-foreground text-sm">Creator Dashboard</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Create new password</CardTitle>
            <CardDescription>
              Enter your new password below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
                {password.length > 0 && (
                  <div className="space-y-1 text-xs mt-2">
                    <div className={`flex items-center gap-1.5 ${passwordValidation.hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {passwordValidation.hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordValidation.hasLetter ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {passwordValidation.hasLetter ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>At least one letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {passwordValidation.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>At least one number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordValidation.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {passwordValidation.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>At least one special character</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1.5 text-xs ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {passwordsMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    <span>{passwordsMatch ? "Passwords match" : "Passwords don't match"}</span>
                  </div>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !isPasswordValid || !passwordsMatch}
                data-testid="button-reset-password"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset password
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              <Link href="/login" className="text-primary font-medium hover:underline inline-flex items-center" data-testid="link-back-to-login">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
