import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, BookOpen, GraduationCap, Upload, Loader2 } from "lucide-react";
import { getAdminSession, clearAdminSession } from "@/integrations/supabase/auth";

// Lazy load tab components to reduce initial bundle size
const StudentsTab = lazy(() => import("@/components/admin/StudentsTab").then(module => ({ default: module.StudentsTab })));
const CoursesTab = lazy(() => import("@/components/admin/CoursesTab").then(module => ({ default: module.CoursesTab })));
const GradesTab = lazy(() => import("@/components/admin/GradesTab").then(module => ({ default: module.GradesTab })));
const BulkUploadTab = lazy(() => import("@/components/admin/BulkUploadTab")); // Default export

const TabLoading = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const AdminDashboard = () => {
  const [adminName, setAdminName] = useState("");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentTab = searchParams.get("tab") || "students";

  useEffect(() => {
    const session = getAdminSession();

    if (!session) {
      navigate("/admin/login?error=session_expired");
      return;
    }

    setAdminName(session.adminName);
  }, [navigate]);

  const handleLogout = () => {
    clearAdminSession();
    navigate("/");
  };

  return (
    <div 
      className="min-h-screen p-4 md:p-8"
      style={{ background: 'var(--gradient-primary)' }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="relative overflow-hidden bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl p-8 rounded-2xl group space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo & Subtitle Section */}
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative">
                <img 
                  src="/logo.png" 
                  alt="Institute Logo" 
                  className="relative w-20 h-20 md:w-36 md:h-36 object-contain drop-shadow-2xl"
                />
                <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full -z-10" />
              </div>
              
              <div className="text-center md:text-right space-y-2">
                <h2 className="text-lg md:text-2xl font-semibold text-foreground/90">
                  كنتــرول المــســتــوي الثانــي
                </h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm text-muted-foreground font-mono bg-secondary/50 px-3 py-1 rounded-full border border-white/5">
                    {adminName}
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full md:w-auto min-w-[140px] gap-2 shadow-lg"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={(value) => setSearchParams({ tab: value })} className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-card/95 backdrop-blur-sm border-border p-2">
            <TabsTrigger value="students" className="gap-2">
              <Users className="w-4 h-4" />
              الطلاب
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-2">
              <BookOpen className="w-4 h-4" />
              المواد
            </TabsTrigger>
            <TabsTrigger value="grades" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              الدرجات
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="w-4 h-4" />
              رفع البيانات
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <Suspense fallback={<TabLoading />}>
              <TabsContent value="students" className="data-[state=inactive]:hidden">
                <StudentsTab />
              </TabsContent>
              
              <TabsContent value="courses" className="data-[state=inactive]:hidden">
                <CoursesTab />
              </TabsContent>
              
              <TabsContent value="grades" className="data-[state=inactive]:hidden">
                <GradesTab />
              </TabsContent>
              
              <TabsContent value="upload" className="data-[state=inactive]:hidden">
                <BulkUploadTab />
              </TabsContent>
            </Suspense>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
