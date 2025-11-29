import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, UserCog } from "lucide-react";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'var(--gradient-primary)' }}
    >
      <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
        <div className="flex flex-col items-center gap-4">
          <img 
            src="/logo.png" 
            alt="Institute Logo" 
            className="w-36 h-36 object-contain rounded-full shadow-[var(--shadow-glow)]"
          />
          <h1 className="text-4xl font-bold text-foreground text-center">
            نظام إدارة درجات الطلاب
          </h1>
          <p className="text-muted-foreground text-center text-lg">
            مرحباً بك في نظام إدارة الدرجات
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full">
          <Card 
            className="p-8 bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] cursor-pointer hover:bg-card/100 transition-all"
            onClick={() => navigate("/student/login")}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                دخول الطلاب
              </h2>
              <p className="text-muted-foreground">
                عرض درجاتك ونتائجك الدراسية
              </p>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2">
                الدخول كطالب
              </Button>
            </div>
          </Card>

          <Card 
            className="p-8 bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] cursor-pointer hover:bg-card/100 transition-all"
            onClick={() => navigate("/admin/login")}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <UserCog className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                لوحة الإدارة
              </h2>
              <p className="text-muted-foreground">
                إدارة الطلاب والدرجات والمواد
              </p>
              <Button 
                variant="outline" 
                className="w-full border-border bg-secondary/50 hover:bg-secondary text-foreground mt-2"
              >
                الدخول كمدير
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
