import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Store, AlertCircle, Mail, Lock, User } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (user) {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setError("Please enter your full name.");
          setIsLoading(false);
          return;
        }
        const { error: signUpError } = await signUp(email, password, fullName);
        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("This email is already registered. Please sign in instead.");
          } else {
            setError(signUpError.message);
          }
        } else {
          setSuccess("Account created successfully! You can now sign in.");
          setIsSignUp(false);
          setPassword("");
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
            setError("Invalid email or password. Please try again.");
          } else {
            setError(signInError.message);
          }
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/30 via-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-secondary/30 via-secondary/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl gradient-primary shadow-lg glow-primary">
              <Store className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gradient">Om Galaxy</CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            {isSignUp ? "Create your account to get started" : "Stock Taker Management System"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-success/50 bg-success/10 text-success">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12 bg-muted/50 border-border/50 focus:border-primary transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-muted/50 border-border/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 bg-muted/50 border-border/50 focus:border-primary transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold gradient-primary hover:opacity-90 transition-all shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {isSignUp ? "Already have an account?" : "New to Om Galaxy?"}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setSuccess("");
            }}
            className="w-full h-12 text-base border-border/50 hover:bg-muted/50"
          >
            {isSignUp ? "Sign in instead" : "Create an account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}