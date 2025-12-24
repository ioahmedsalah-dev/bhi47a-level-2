import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { sanitizeInput, validateGrade, logAdminAction, getAdminSession } from "@/integrations/supabase/auth";

interface Grade {
  id: string;
  grade: number;
  status: string;
  students: { student_name: string; student_code: string };
  courses: { course_name: string };
  student_id: string;
  course_id: string;
}

interface Student {
  id: string;
  student_code: string;
  student_name: string;
}

interface Course {
  id: string;
  course_name: string;
}

export const GradesTab = () => {
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [newGrade, setNewGrade] = useState({ studentId: "", courseId: "", grade: "", status: "present" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created_at" | "grade" | "student_code">("student_code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Students Query (Cached heavily)
  const { data: students = [] } = useQuery({
    queryKey: ["students_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("student_code");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // 2. Courses Query (Cached heavily)
  const { data: courses = [] } = useQuery({
    queryKey: ["courses_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("course_name");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // 3. Grades Query (Paginated)
  const { data: gradesData, isLoading } = useQuery<{ grades: Grade[]; count: number }>({
    queryKey: ["grades", currentPage, searchCode, sortBy, sortOrder, statusFilter, courseFilter],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from("grades")
        .select(`
          *,
          students!inner (student_name, student_code),
          courses (course_name)
        `, { count: "exact" });

      // Apply filters
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (courseFilter && courseFilter !== "all") {
        query = query.eq("course_id", courseFilter);
      }

      // Apply sorting
      if (sortBy === 'student_code') {
        query = query.order('student_code', { foreignTable: 'students', ascending: sortOrder === 'asc' });
      } else {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      }

      // Apply pagination
      query = query.range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (searchCode) {
        query = query.ilike("students.student_code", `%${searchCode}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { grades: data as unknown as Grade[], count: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });

  const grades = gradesData?.grades || [];
  const totalCount = gradesData?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleAddGrade = async () => {
    // Check session first
    const session = getAdminSession();
    if (!session) {
      toast({
        title: "خطأ",
        description: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    if (!newGrade.studentId || !newGrade.courseId || !newGrade.grade) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    const gradeNum = parseInt(sanitizeInput(newGrade.grade));
    if (!validateGrade(gradeNum)) {
      toast({
        title: "خطأ",
        description: "الدرجة يجب أن تكون رقماً صحيحاً بين 0 و 30",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("grades").insert([{
        student_id: newGrade.studentId,
        course_id: newGrade.courseId,
        grade: gradeNum,
        status: newGrade.status
      }]);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "grades", "insert", {
        student_id: newGrade.studentId,
        course_id: newGrade.courseId,
        grade: gradeNum,
        status: newGrade.status
      });

      toast({ title: "نجح", description: "تم إضافة الدرجة بنجاح" });
      setNewGrade({ studentId: "", courseId: "", grade: "", status: "present" });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error) {
      const errorObj = error as { message?: string };
      const isConflict = errorObj.message?.includes("duplicate");
      const description = isConflict ? "الدرجة موجودة مسبقاً لهذا الطالب في هذه المادة" : "فشل إضافة الدرجة";
      toast({
        title: "خطأ",
        description: description,
        variant: "destructive",
      });
    }
  };

  const handleUpdateGrade = async () => {
    if (!editingGrade) return;

    // Check session first
    const session = getAdminSession();
    if (!session) {
      toast({
        title: "خطأ",
        description: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    const gradeNum = editingGrade.grade;
    if (!validateGrade(gradeNum)) {
      toast({
        title: "خطأ",
        description: "الدرجة يجب أن تكون رقماً صحيحاً بين 0 و 30",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("grades")
        .update({ grade: gradeNum, status: editingGrade.status })
        .eq("id", editingGrade.id);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "grades", "update", {
        grade_id: editingGrade.id,
        new_grade: gradeNum,
        new_status: editingGrade.status
      });

      toast({ title: "نجح", description: "تم تحديث الدرجة بنجاح" });
      setEditingGrade(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تحديث الدرجة",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGrade = async (id: string) => {
    // Check session first
    const session = getAdminSession();
    if (!session) {
      toast({
        title: "خطأ",
        description: "جلسة العمل انتهت، يرجى تسجيل الدخول مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "grades", "delete", { id });

      toast({ title: "نجح", description: "تم حذف الدرجة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف الدرجة",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card className="bg-card/95 backdrop-blur-sm border-border">
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">إدارة الدرجات</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingGrade(null);
                setNewGrade({ studentId: "", courseId: "", grade: "", status: "present" });
              }}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              إضافة درجة
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground text-right mt-4">
                {editingGrade ? "تعديل درجة" : "إضافة درجة جديدة"}
              </DialogTitle>
              {/* Accessibility: Description is required */}
              <DialogDescription className="sr-only">
                {editingGrade ? "نموذج تعديل درجة الطالب" : "نموذج إضافة درجة جديدة للطالب"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!editingGrade && (
                <>
                  <Select value={newGrade.studentId} onValueChange={(v) => setNewGrade({ ...newGrade, studentId: v })}>
                    <SelectTrigger className="text-right bg-secondary/50 border-border">
                      <SelectValue placeholder="اختر الطالب" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.student_name} ({s.student_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newGrade.courseId} onValueChange={(v) => setNewGrade({ ...newGrade, courseId: v })}>
                    <SelectTrigger className="text-right bg-secondary/50 border-border">
                      <SelectValue placeholder="اختر المادة" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.course_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="الدرجة (0-30)"
                value={editingGrade ? (editingGrade.grade ?? "") : newGrade.grade}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) {
                    if (editingGrade) {
                      setEditingGrade({ ...editingGrade, grade: val === "" ? 0 : parseInt(val) });
                    } else {
                      setNewGrade({ ...newGrade, grade: val });
                    }
                  }
                }}
                className="text-right bg-secondary/50 border-border"
              />
              
              <Select 
                value={editingGrade ? editingGrade.status : newGrade.status} 
                onValueChange={(v) => {
                  if (editingGrade) {
                    setEditingGrade({ ...editingGrade, status: v });
                  } else {
                    setNewGrade({ ...newGrade, status: v });
                  }
                }}
              >
                <SelectTrigger className="text-right bg-secondary/50 border-border" dir="rtl">
                  <SelectValue placeholder="حالة الطالب في المادة" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="banned">محروم</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={editingGrade ? handleUpdateGrade : handleAddGrade}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {editingGrade ? "تحديث" : "إضافة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="ابحث برقم الطالب..."
            value={searchCode}
            maxLength={6}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) {
                setSearchCode(val);
              }
            }}
            className="flex-1 bg-secondary/50 border-border"
          />
          {searchCode && (
            <Button
              variant="outline"
              onClick={() => setSearchCode("")}
              className="border-border"
            >
              مسح
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-[180px] bg-secondary/50 border-border text-right" dir="rtl">
              <SelectValue placeholder="تصفية حسب المادة" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border" dir="rtl">
              <SelectItem value="all">جميع المواد</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.course_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-secondary/50 border-border text-right" dir="rtl">
              <SelectValue placeholder="تصفية حسب الحالة" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border" dir="rtl">
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="present">حاضر</SelectItem>
              <SelectItem value="absent">غائب</SelectItem>
              <SelectItem value="banned">محروم</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-card/95 backdrop-blur-sm border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-right text-foreground">الطالب</TableHead>
              <TableHead className="text-right text-foreground">المادة</TableHead>
              <TableHead className="text-right text-foreground">الدرجة</TableHead>
              <TableHead className="text-right text-foreground">الحالة</TableHead>
              <TableHead className="text-right text-foreground">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grades.length > 0 ? (
              grades.map((grade) => (
                <TableRow 
                  key={grade.id} 
                  className={`border-border ${grade.grade < 15 ? 'bg-destructive/10' : ''}`}
                >
                  <TableCell className="text-foreground">
                    {grade.students.student_name} ({grade.students.student_code})
                  </TableCell>
                  <TableCell className="text-foreground">{grade.courses.course_name}</TableCell>
                  <TableCell className={`font-bold ${grade.grade < 15 ? 'text-destructive' : 'text-primary'}`}>
                    {grade.grade}
                  </TableCell>
                  <TableCell>
                    {grade.status === 'present' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        حاضر
                      </span>
                    ) : grade.status === 'absent' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                        غائب
                      </span>
                    ) : grade.status === 'banned' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                        محروم
                      </span>
                    ) : (
                      <span className="text-foreground text-xs">{grade.status}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingGrade(grade);
                          setDialogOpen(true);
                        }}
                        className="gap-1 border-border"
                      >
                        <Pencil className="w-3 h-3" />
                        تعديل
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-destructive text-destructive hover:bg-red-500 hover:text-white"
                          >
                            <Trash2 className="w-3 h-3" />
                            حذف
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-right">حذف الدرجة؟</AlertDialogTitle>
                            <AlertDialogDescription className="text-right">
                              هل أنت متأكد من حذف درجة الطالب <span className="font-bold text-foreground">{grade.students.student_name}</span> في مادة <span className="font-bold text-foreground">{grade.courses.course_name}</span>؟
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="justify-end gap-2">
                            <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteGrade(grade.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="text-center t ext-muted-foreground py-8">
                  {searchCode ? "لم يتم العثور على درجات للطالب" : "لا توجد درجات"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-card/95 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground">
            الصفحة {currentPage} من {totalPages} ({totalCount} نتيجة)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="border-border"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="border-border"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
