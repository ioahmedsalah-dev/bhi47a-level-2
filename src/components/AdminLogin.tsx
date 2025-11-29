import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  getAdminSession,
  sanitizeInput,
  setAdminSession,
  generateSessionToken,
} from "@/integrations/supabase/auth-utils";

export const AdminLogin = () => {
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const toastShownRef = useRef(false);

  const maxAttempts = 5;
  const lockoutDuration = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    const session = getAdminSession();
    if (session) {
      navigate("/admin/dashboard");
      return;
    }

    if (searchParams.get("error") === "session_expired" && !toastShownRef.current) {
      toastShownRef.current = true;
      
      // Show toast immediately
      toast({
        title: "انتهت الجلسة",
        description: "لقد انتهت صلاحية جلستك. الرجاء تسجيل الدخول مرة أخرى.",
        variant: "destructive",
        duration: 5000,
      });
      
      // Clear the query param after a short delay to ensure toast is seen
      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 500);
    }
  }, [navigate, searchParams, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      toast({
        title: "محظور",
        description: "تم قفل الحساب مؤقتاً لأسباب أمنية. حاول لاحقاً.",
        variant: "destructive",
      });
      return;
    }

    // Sanitize inputs to prevent injection attacks
    const sanitizedCode = sanitizeInput(adminCode);
    const sanitizedPassword = sanitizeInput(password, 255);

    if (!sanitizedCode || !sanitizedPassword) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال كود المدير و كلمة المرور",
        variant: "destructive",
      });
      if (sanitizedCode && !sanitizedPassword) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال كلمة المرور",
        variant: "destructive",
      });
      return;
    }
    }

    if (!/^ADMIN\d{3}$/.test(sanitizedCode)) {
      toast({
        title: "خطأ",
        description: "ادخل كود المدير",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Dynamically import heavy auth functions
      const { authenticateAdmin, logAdminAction } = await import("@/integrations/supabase/auth");

      const result = await authenticateAdmin(sanitizedCode, sanitizedPassword);

      if (!result.success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= maxAttempts) {
          setIsLocked(true);
          toast({
            title: "تحذير أمني",
            description: "تم قفل الحساب بعد محاولات دخول فاشلة متعددة",
            variant: "destructive",
          });

          // Auto unlock after lockout duration
          setTimeout(() => {
            setIsLocked(false);
            setAttempts(0);
          }, lockoutDuration);
        } else {
          // Show specific error message from backend
          const errorMessage = result.error === "Admin code or password is incorrect" 
            ? "كلمة المرور غير صحيحة" 
            : result.error || "كود المدير أو كلمة المرور غير صحيحة";
          
          toast({
            title: "خطأ",
            description: `${errorMessage} (محاولة ${newAttempts}/${maxAttempts})`,
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      // Reset attempts on successful login
      setAttempts(0);

      // Save to LocalStorage (for Frontend) using the token from DB
      setAdminSession(result.adminId!, result.adminName!, result.sessionToken!, sanitizedCode);

      // Log successful login for audit trail
      await logAdminAction(sanitizedCode, "auth", "admin_login", {
        timestamp: new Date().toISOString(),
        success: true,
      });

      toast({
        title: "نجح تسجيل الدخول",
        description: `مرحباً ${result.adminName}`,
      });

      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تسجيل الدخول",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8"
      style={{ background: 'var(--gradient-primary)' }}
    >
      <Card className="w-full max-w-md bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] p-6 md:p-8">
        <div className="flex flex-col items-center gap-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="self-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="w-4 h-4" />
            الرجوع
          </Button>

          <img 
            src="/logo.png" 
            alt="Institute Logo" 
            className="w-24 h-24 md:w-36 md:h-36 object-contain rounded-full shadow-[var(--shadow-glow)]"
            fetchPriority="high"
            loading="eager"
            width={144}
            height={144}
          />
          
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              لوحة الإدارة
            </h1>
            <p className="text-muted-foreground">
              الرجاء إدخال كود المدير للدخول
            </p>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <Input
                type="text"
                placeholder="كود المدير"
                value={adminCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  if (/^(A(D(M(I(N(\d{0,3})?)?)?)?)?)?$/.test(val)) {
                    setAdminCode(val);
                  }
                }}
                className="h-12 text-right bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground pr-5 pb-1 font-bold"
                dir="ltr"
                disabled={isLocked}
              />
            </div>

            <div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="كلمة المرور"
                  value={password}
                  maxLength={20}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[a-zA-Z0-9]*$/.test(val)) {
                      setPassword(val);
                    }
                  }}
                  className="h-12 text-right bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground pr-5 pb-1 font-bold"
                  disabled={isLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  disabled={isLocked}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
                >
                  {showPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              {attempts > 0 && !isLocked && (
                <p className="text-xs text-amber-600 mt-2 text-right">
                  محاولات متبقية: {maxAttempts - attempts}
                </p>
              )}
              {isLocked && (
                <p className="text-xs text-destructive mt-2 text-right">
                  ⛔ الحساب مقفول مؤقتاً لأسباب أمنية
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-bold"
              disabled={loading || isLocked}
            >
              {loading ? "جاري التحميل..." : isLocked ? "الحساب مقفول" : "الدخول"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
