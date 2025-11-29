import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";


export const StudentLogin = () => {
  const [studentCode, setStudentCode] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentCode.trim() || !nationalId.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال الكود الاكاديمي والرقم القومي",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Dynamically import supabase client
      const { supabase } = await import("@/integrations/supabase/client");

      // Verify student code and national ID exist
      const { data: student, error } = await supabase
        .from("students")
        .select("*")
        .eq("student_code", studentCode.trim())
        .eq("national_id", nationalId.trim())
        .single();

      if (error || !student) {
        toast({
          title: "خطأ",
          description: "الكود الاكاديمي أو الرقم القومي غير صحيح",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Store student info in sessionStorage
      sessionStorage.setItem("studentId", student.id);
      sessionStorage.setItem("studentName", student.student_name);
      sessionStorage.setItem("studentCode", student.student_code);
      
      toast({
        title: "  نتائجك الدراسية",
        description: `مرحباً ${student.student_name}`,
      });

      navigate("/grades");
    } catch (error) {
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
                    {/* Centered Title */}
          <h1 className="text-sm md:text-xl font-semibold text-center bg-clip-text  bg-gradient-to-r from-primary to-primary/60 pb-4 border-b border-white/5 leading-relaxed">
            المعهد العالى للعلوم الادارية المتقدمة والحاسبات
          </h1>
          <img
            src="/logo.pngp" 
            alt="Institute Logo"
            width={144}
            height={144}
            className="w-28 h-28 md:w-36 md:h-36 object-contain rounded-full shadow-[var(--shadow-glow)]"
          />
          
          <div className="text-center space-y-2">
            <h1 className="text-lg md:text-2xl font-bold text-foreground">
              نتيجة درجات - الميد ترم
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              الرجاء إدخال الكود الاكاديمي والرقم القومي
            </p>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="الكود الاكاديمي"
                value={studentCode}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value) && value.length <= 6) {
                    setStudentCode(value);
                  }
                }}
                className="h-12 text-center bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground font-bold text-lg"
                dir="ltr"
              />
              
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={14}
                placeholder="الرقم القومي"
                value={nationalId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value) && value.length <= 14) {
                    setNationalId(value);
                  }
                }}
                className="h-12 text-center bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground font-bold text-lg"
                dir="ltr"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "جاري التحميل..." : "الاستعلام عن النتيجة"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
