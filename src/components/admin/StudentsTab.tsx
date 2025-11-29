import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { sanitizeInput, validateStudentCode, logAdminAction, getAdminSession } from "@/integrations/supabase/auth";

interface Student {
  id: string;
  student_code: string;
  student_name: string;
  national_id: string | null;
  status: string;
}

export const StudentsTab = () => {
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState({ code: "", name: "", nationalId: "", status: "active" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["students", currentPage, searchCode],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*", { count: "exact" })
        .order("student_code")
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (searchCode) {
        query = query.or(`student_code.ilike.%${searchCode}%,student_name.ilike.%${searchCode}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { students: data as unknown as Student[], count };
    },
    placeholderData: keepPreviousData,
  });

  const students = data?.students || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleAddStudent = async () => {
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

    // Sanitize inputs
    const sanitizedCode = sanitizeInput(newStudent.code);
    const sanitizedName = sanitizeInput(newStudent.name);
    const sanitizedNationalId = sanitizeInput(newStudent.nationalId);

    if (!sanitizedCode || !sanitizedName || !sanitizedNationalId) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    // Validate student code format
    if (!validateStudentCode(sanitizedCode)) {
      toast({
        title: "خطأ",
        description: " الكود الاكاديمي غير صحيح (استخدم أحرف وأرقام و- أو _)",
        variant: "destructive",
      });
      return;
    }

    // Validate National ID length
    if (sanitizedNationalId.length !== 14) {
      toast({
        title: "خطأ",
        description: "الرقم القومي يجب أن يتكون من 14 رقم",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("students")
        .insert([{
          student_code: sanitizedCode,
          student_name: sanitizedName,
          national_id: sanitizedNationalId,
          status: newStudent.status
        }]);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "students", "insert", {
        student_code: sanitizedCode,
        student_name: sanitizedName,
        national_id: sanitizedNationalId,
        status: newStudent.status
      });

      toast({ title: "نجح", description: "تم إضافة الطالب بنجاح" });
      setNewStudent({ code: "", name: "", nationalId: "", status: "active" });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      console.error("Error adding student:", error);
      let errorMessage = "حدث خطأ أثناء إضافة الطالب";

      if (dbError.code === "23505") { // Unique violation
        errorMessage = "بيانات مكررة: الكود الاكاديمي أو الرقم القومي موجود بالفعل لطالب آخر";
      } else if (dbError.code === "42703") { // Undefined column
        errorMessage = "خطأ في النظام: قاعدة البيانات تحتاج إلى تحديث (عمود الرقم القومي غير موجود)";
      } else if (dbError.message) {
        errorMessage = dbError.message;
      }

      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;

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

    if (!editingStudent.student_code || !editingStudent.student_name || !editingStudent.national_id) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    if (editingStudent.national_id.length !== 14) {
      toast({
        title: "خطأ",
        description: "الرقم القومي يجب أن يتكون من 14 رقم",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("students")
        .update({
          student_code: editingStudent.student_code,
          student_name: editingStudent.student_name,
          national_id: editingStudent.national_id,
          status: editingStudent.status
        })
        .eq("id", editingStudent.id);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "students", "update", {
        id: editingStudent.id,
        student_code: editingStudent.student_code,
        student_name: editingStudent.student_name,
        national_id: editingStudent.national_id,
        status: editingStudent.status
      });

      toast({ title: "نجح", description: "تم تحديث الطالب بنجاح" });
      setEditingStudent(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      console.error("Error updating student:", error);
      let errorMessage = "فشل تحديث الطالب";

      if (dbError.code === "23505") {
        errorMessage = "بيانات مكررة: الكود الاكاديمي أو الرقم القومي موجود بالفعل لطالب آخر";
      } else if (dbError.code === "42703") {
        errorMessage = "خطأ في النظام: قاعدة البيانات تحتاج إلى تحديث (عمود الرقم القومي غير موجود)";
      } else if (dbError.message) {
        errorMessage = dbError.message;
      }

      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteStudent = async (id: string) => {
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
      // First delete all grades associated with this student
      const { error: gradesError } = await supabase
        .from("grades")
        .delete()
        .eq("student_id", id);

      if (gradesError) throw gradesError;

      // Then delete the student
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "students", "delete", { id });

      toast({ title: "نجح", description: "تم حذف الطالب وجميع درجاته بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "خطأ",
        description: "فشل حذف الطالب",
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
        <h2 className="text-2xl font-bold text-foreground">إدارة الطلاب</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingStudent(null);
                setNewStudent({ code: "", name: "", nationalId: "", status: "active" });
              }}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              إضافة طالب
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground text-right mt-4">
                {editingStudent ? "تعديل بيانات الطالب" : "إضافة طالب جديد"}
              </DialogTitle>
              {/* Accessibility: Description is required */}
              <DialogDescription className="sr-only">
                {editingStudent ? "نموذج تعديل بيانات الطالب" : "نموذج إضافة طالب جديد"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder=" الكود الاكاديمي"
                  value={editingStudent ? editingStudent.student_code : newStudent.code}
                  maxLength={6}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      if (editingStudent) {
                        setEditingStudent({ ...editingStudent, student_code: val });
                      } else {
                        setNewStudent({ ...newStudent, code: val });
                      }
                    }
                  }}
                  className="text-right bg-secondary/50 border-border"
                  dir="ltr"
                />
              </div>
              <div>
                <Input
                  placeholder="اسم الطالب"
                  value={editingStudent ? editingStudent.student_name : newStudent.name}
                  minLength={3}
                  maxLength={50}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[a-zA-Z\u0600-\u06FF\s]*$/.test(val)) {
                      if (editingStudent) {
                        setEditingStudent({ ...editingStudent, student_name: val });
                      } else {
                        setNewStudent({ ...newStudent, name: val });
                      }
                    }
                  }}
                  className="text-right bg-secondary/50 border-border"
                />
              </div>
              <div>
                <Input
                  placeholder="الرقم القومي"
                  value={editingStudent ? (editingStudent.national_id || "") : newStudent.nationalId}
                  maxLength={14}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Only allow numbers
                    if (/^\d*$/.test(val)) {
                      if (editingStudent) {
                        setEditingStudent({ ...editingStudent, national_id: val });
                      } else {
                        setNewStudent({ ...newStudent, nationalId: val });
                      }
                    }
                  }}
                  className="text-right bg-secondary/50 border-border"
                  dir="ltr"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div>
                <Select
                  value={editingStudent ? editingStudent.status : newStudent.status}
                  onValueChange={(val) => {
                    if (editingStudent) {
                      setEditingStudent({ ...editingStudent, status: val });
                    } else {
                      setNewStudent({ ...newStudent, status: val });
                    }
                  }}
                >
                  <SelectTrigger className="text-right bg-secondary/50 border-border" dir="rtl">
                    <SelectValue placeholder="حالة الطالب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="absent">غائب</SelectItem>
                    <SelectItem value="hide">محجوب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={editingStudent ? handleUpdateStudent : handleAddStudent}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {editingStudent ? "تحديث" : "إضافة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="ابحث برقم الطالب أو الاسم..."
          value={searchCode}
          maxLength={50}
          onChange={(e) => setSearchCode(e.target.value)}
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

      {/* Desktop View */}
      <Card className="hidden md:block bg-card/95 backdrop-blur-sm border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-right text-foreground"> الكود الاكاديمي</TableHead>
              <TableHead className="text-right text-foreground">اسم الطالب</TableHead>
              <TableHead className="text-right text-foreground">الرقم القومي</TableHead>
              <TableHead className="text-right text-foreground">الحالة</TableHead>
              <TableHead className="text-right text-foreground">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length > 0 ? (
              students.map((student) => (
                <TableRow key={student.id} className="border-border">
                  <TableCell className="text-foreground font-mono">{student.student_code}</TableCell>
                  <TableCell className="text-foreground">{student.student_name}</TableCell>
                  <TableCell className="text-foreground font-mono">{student.national_id || "-"}</TableCell>
                  <TableCell>
                    {student.status === 'active' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        نشط
                      </span>
                    ) : (student.status === 'absent' || student.status === 'غائب') ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                        غائب
                      </span>
                    ) : (student.status === 'hide' || student.status === 'محجوب') ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                        محجوب
                      </span>
                    ) : (
                      <span className="text-foreground">{student.status}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingStudent(student);
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
                            <AlertDialogTitle className="text-right">حذف الطالب؟</AlertDialogTitle>
                            <AlertDialogDescription className="text-right">
                              هل أنت متأكد من حذف الطالب <span className="font-bold text-foreground">{student.student_name}</span>؟ سيتم حذف جميع درجاته أيضاً.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="justify-end gap-2">
                            <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteStudent(student.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {searchCode ? "لم يتم العثور على طلاب" : "لا يوجد طلاب"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {students.length > 0 ? (
          students.map((student) => (
            <Card key={student.id} className="p-4 bg-card/95 backdrop-blur-sm border-border space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-foreground">{student.student_name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{student.student_code}</p>
                </div>
                {student.status === 'active' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    نشط
                  </span>
                ) : (student.status === 'absent' || student.status === 'غائب') ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                    غائب
                  </span>
                ) : (student.status === 'hide' || student.status === 'محجوب') ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                    محجوب
                  </span>
                ) : (
                  <span className="text-foreground text-xs">{student.status}</span>
                )}
              </div>
              
              <div className="flex justify-between items-center text-sm bg-secondary/30 p-2 rounded">
                 <span className="text-muted-foreground">الرقم القومي:</span>
                 <span className="font-mono text-foreground">{student.national_id || "-"}</span>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingStudent(student);
                    setDialogOpen(true);
                  }}
                  className="gap-1 border-border h-8"
                >
                  <Pencil className="w-3 h-3" />
                  تعديل
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-destructive text-destructive hover:bg-red-500 hover:text-white h-8"
                    >
                      <Trash2 className="w-3 h-3" />
                      حذف
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">حذف الطالب؟</AlertDialogTitle>
                      <AlertDialogDescription className="text-right">
                        هل أنت متأكد من حذف الطالب <span className="font-bold text-foreground">{student.student_name}</span>؟ سيتم حذف جميع درجاته أيضاً.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="justify-end gap-2">
                      <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteStudent(student.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))
        ) : (
           <div className="text-center text-muted-foreground py-8 bg-card/50 rounded-lg border border-border border-dashed">
             {searchCode ? "لم يتم العثور على طلاب" : "لا يوجد طلاب"}
           </div>
        )}
      </div>

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
