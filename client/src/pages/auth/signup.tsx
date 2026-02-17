import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";

function validatePassword(password: string) {
  return {
    hasMinLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(password),
  };
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordValid = passwordValidation.hasMinLength && 
    passwordValidation.hasLetter && 
    passwordValidation.hasNumber && 
    passwordValidation.hasSpecial;

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
    
    setIsLoading(true);

    try {
      const result = await signup(email, password);
      
      // Check if verification is required
      if (result && result.requiresVerification) {
        toast({
          title: "Verification required",
          description: "Please check your email for a verification code.",
        });
        setLocation(`/verify-email?email=${encodeURIComponent(result.email)}`);
        return;
      }
      
      toast({
        title: "Account created!",
        description: "Welcome to Creator Catalyst Dashboard.",
      });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <CardTitle className="text-xl">Create an account</CardTitle>
            <CardDescription>
              Enter your details to get started with Creator Catalyst
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
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
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !isPasswordValid}
                data-testid="button-signup"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
