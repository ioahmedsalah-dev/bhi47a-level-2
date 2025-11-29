import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'var(--gradient-primary)' }}
    >
      <Card className="w-full max-w-md bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            src="/logo.png" 
            alt="Institute Logo" 
            className="w-32 h-32 object-contain rounded-full shadow-[var(--shadow-glow)]"
          />
          
          <div>
            <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
            <p className="text-2xl font-semibold text-foreground mb-2">
              الصفحة غير موجودة
            </p>
            <p className="text-muted-foreground">
              الصفحة التي تحاول الوصول إليها غير متاحة
            </p>
          </div>

          <Button 
            onClick={() => navigate("/")}
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Home className="w-4 h-4" />
            الرجوع إلى الصفحة الرئيسية
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;
