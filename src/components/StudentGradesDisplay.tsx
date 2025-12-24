import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut } from "lucide-react";

interface CourseGrade {
  courseName: string;
  grade: number;
  status: string;
  level: number | null;
}

interface GradeItem {
  courses: { 
    course_name: string;
    level: number | null;
  };
  grade: number;
  status: string;
}

export const StudentGradesDisplay = () => {
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [studentStatus, setStudentStatus] = useState<string>("");
  const [grades, setGrades] = useState<CourseGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchGrades = useCallback(async (studentId: string) => {
    try {
      // Fetch student status first
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("status")
        .eq("id", studentId)
        .maybeSingle();

      if (studentData) {
        setStudentStatus((studentData as unknown as { status: string }).status);
      }

      const { data, error } = await supabase
        .from("grades")
        .select(`
          grade,
          status,
          courses (
            course_name,
            level
          )
        `)
        .eq("student_id", studentId);

      if (error) throw error;

      // supabase may return unknown-typed data; assert to the expected shape and guard for null
      const rows = data as unknown as GradeItem[] | null;

      const formattedGrades: CourseGrade[] = (rows || []).map((item: GradeItem) => ({
        courseName: item?.courses?.course_name ?? "—",
        grade: Number(item?.grade ?? 0),
        status: item?.status ?? "",
        level: item?.courses?.level ?? null,
      }));

      setGrades(formattedGrades);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الدرجات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId");
    const name = sessionStorage.getItem("studentName");
    const code = sessionStorage.getItem("studentCode");

    if (!studentId) {
      navigate("/");
      return;
    }

    setStudentName(name || "");
    setStudentCode(code || "");
    fetchGrades(studentId);
  }, [navigate, fetchGrades]);

  const handleLogout = () => {
    sessionStorage.removeItem("studentId");
    sessionStorage.removeItem("studentName");
    navigate("/student/login");
  };

  const totalGrades = grades.reduce((sum, item) => {
    if (item.status === 'banned' || item.status === 'absent') return sum;
    return sum + item.grade;
  }, 0);
  const maxTotal = grades.length * 30;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8"
      style={{ background: 'var(--gradient-primary)' }}
    >
      <div className="flex flex-col items-center gap-6 md:gap-8 w-full max-w-4xl">
        <div className="flex flex-col items-center gap-4 w-full">
          <h1 className="text-xl md:text-2xl font-bold text-foreground text-center">
          المعهد العالى للعلوم الادارية المتقدمة والحاسبات
          </h1>
          <img 
            src="/logo.png" 
            alt="institute Logo"
            width={128}
            height={128}
            className="w-24 h-24 md:w-32 md:h-32 object-contain rounded-full shadow-[var(--shadow-glow)]"
          />
          <div className="flex flex-col justify-start items-center flex-nowrap gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-foreground text-center">
            درجات الطالب - الطالبة
          </h1>
            <div className="flex flex-col md:flex-row text-center items-center gap-2 md:gap-6">
            <p className="text-base md:text-lg text-muted-foreground font-semibold">
              {studentName}
            </p>
            <p className="text-base md:text-lg font-semibold text-muted-foreground">  الكود الأكاديمي : {studentCode}
            </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2 border-border bg-secondary/50 hover:bg-secondary text-foreground"
          >
            <LogOut className="w-4 h-4" />
            الرجوع
          </Button>
        </div>

        {loading ? (
          <Card className="w-full bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)]">
            <div className="p-6 space-y-6">
              <div className="flex justify-between border-b pb-4">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between py-4 border-b last:border-0">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </Card>
        ) : studentStatus !== 'active' ? (
          <Card className="w-full bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-destructive/10 text-destructive">
                <LogOut className="w-8 h-8 rotate-180" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-destructive">عذراً، النتيجة محجوبة</h3>
                <p className="text-lg text-foreground">يرجى مراجعة شؤون الطلاب</p>
              </div>
            </div>
          </Card>
        ) : grades.length === 0 ? (
          <Card className="w-full bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] p-8">
            <p className="text-center text-foreground">لا توجد درجات مسجلة</p>
          </Card>
        ) : (
          <>
            <Card className="w-full bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-right text-foreground font-semibold">#</TableHead>
                      <TableHead className="text-right text-foreground font-semibold">اسم المادة</TableHead>
                      <TableHead className="text-right text-foreground font-semibold">الدرجة (من 30)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((item, index) => (
                      <TableRow 
                        key={index}
                        className={`border-border ${
                          item.grade < 15 
                            ? 'bg-destructive/10 hover:bg-destructive/20' 
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        <TableCell className="text-foreground">{index + 1}</TableCell>
                        <TableCell className="text-foreground font-medium">
                          {item.courseName}
                          {item.level && <span className="text-xs text-muted-foreground mr-2">({`المستوى ${item.level}`})</span>}
                        </TableCell>
                        <TableCell 
                          className={`text-lg font-bold ${
                            item.status === 'banned' || item.status === 'absent' || item.grade < 15 
                              ? 'text-destructive' 
                              : 'text-primary'
                          }`}
                        >
                          {item.status === 'banned' ? 'محروم' : item.status === 'absent' ? 'غائب' : item.grade}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="w-full bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)] p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-muted-foreground text-sm">المجموع الكلي</p>
                  <p className="text-2xl font-bold text-primary">{totalGrades} / {maxTotal}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">عدد المواد</p>
                  <p className="text-2xl font-bold text-primary">{grades.length}</p>
                </div>
              </div>
            </Card>
          </>
        )}

        <div className="text-center text-sm text-muted-foreground mt-4">
          <p>الدرجات التي تقل عن 15 يتم تمييزها باللون الأحمر</p>
        </div>
      </div>
    </div>
  );
};
