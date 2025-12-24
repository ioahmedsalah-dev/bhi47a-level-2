import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, logAdminAction } from "@/integrations/supabase/auth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface Course {
  id: string;
  course_name: string;
  level: number | null;
}

export const CoursesTab = () => {
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: loading } = useQuery({
    queryKey: ["courses_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("course_name");

      if (error) throw error;
      return (data as unknown) as Course[];
    },
  });

  const handleAddCourse = async () => {
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

    if (!newCourseName.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم المادة",
        variant: "destructive",
      });
      return;
    }

    if (newCourseName.trim().length <= 4) {
      toast({
        title: "خطأ",
        description: "اسم المادة يجب أن يكون أكثر من 4 أحرف",
        variant: "destructive",
      });
      return;
    }

    if (!newCourseLevel) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار المستوى",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate course names
    const trimmedName = newCourseName.trim();
    const existingCourse = courses.find(course => 
      course.course_name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCourse) {
      toast({
        title: "خطأ",
        description: "اسم المادة موجود بالفعل",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("courses")
        .insert([{ course_name: trimmedName, level: parseInt(newCourseLevel) }]);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "courses", "insert", {
        course_name: trimmedName,
        level: parseInt(newCourseLevel)
      });

      toast({ title: "نجح", description: `تم إضافة مادة "${trimmedName}" بنجاح` });
      setNewCourseName("");
      setNewCourseLevel("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["courses_list"] });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل إضافة المادة",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse) return;

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

    const trimmedName = editingCourse.course_name.trim();
    if (!trimmedName) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم المادة",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length <= 4) {
      toast({
        title: "خطأ",
        description: "اسم المادة يجب أن يكون أكثر من 4 أحرف",
        variant: "destructive",
      });
      return;
    }

    if (!editingCourse.level) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار المستوى",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate course names (excluding the current course being edited)
    const existingCourse = courses.find(course => 
      course.id !== editingCourse.id && 
      course.course_name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCourse) {
      toast({
        title: "خطأ",
        description: "اسم المادة موجود بالفعل",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("courses")
        .update({ course_name: trimmedName, level: editingCourse.level })
        .eq("id", editingCourse.id);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "courses", "update", {
        id: editingCourse.id,
        course_name: trimmedName,
        level: editingCourse.level
      });

      toast({ title: "نجح", description: "تم تحديث المادة بنجاح" });
      setEditingCourse(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["courses_list"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تحديث المادة",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCourse = async (id: string) => {
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
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "courses", "delete", { id });

      toast({ title: "نجح", description: "تم حذف المادة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["courses_list"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف المادة",
        variant: "destructive",
      });
    }
  };

  const handleCourseNameChange = (value: string, isEditing: boolean) => {
    // Allow only letters (Arabic/English), spaces, and parentheses, max 50 chars
    const sanitizedValue = value.replace(/[^a-zA-Z\u0600-\u06FF\s()]/g, '').slice(0, 50);
    
    if (isEditing && editingCourse) {
      setEditingCourse({ ...editingCourse, course_name: sanitizedValue });
    } else {
      setNewCourseName(sanitizedValue);
    }
  };

  if (loading) {
    return <div className="text-center p-8 text-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">إدارة المواد</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingCourse(null);
                setNewCourseName("");
                setNewCourseLevel("");
              }}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              إضافة مادة
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground text-right mt-4">
                {editingCourse ? "تعديل مادة" : "إضافة مادة جديدة"}
              </DialogTitle>
              {/* Accessibility: Description is required */}
              <DialogDescription className="sr-only">
                {editingCourse ? "نموذج تعديل اسم المادة" : "نموذج إضافة مادة جديدة"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="اسم المادة"
                  minLength={4}
                  maxLength={50}
                  value={editingCourse ? editingCourse.course_name : newCourseName}
                  onChange={(e) => handleCourseNameChange(e.target.value, !!editingCourse)}
                  className="text-right bg-secondary/50 border-border"
                />
              </div>
              <div>
                <Select
                  value={editingCourse ? editingCourse.level?.toString() : newCourseLevel}
                  onValueChange={(value) => {
                    if (editingCourse) {
                      setEditingCourse({ ...editingCourse, level: parseInt(value) });
                    } else {
                      setNewCourseLevel(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full text-right bg-secondary/50 border-border" dir="rtl">
                    <SelectValue placeholder="اختر المستوى" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="1">المستوى الأول</SelectItem>
                    <SelectItem value="2">المستوى الثاني</SelectItem>
                    <SelectItem value="3">المستوى الثالث</SelectItem>
                    <SelectItem value="4">المستوى الرابع</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={editingCourse ? handleUpdateCourse : handleAddCourse}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {editingCourse ? "تحديث" : "إضافة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block bg-card/95 backdrop-blur-sm border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-right text-foreground">اسم المادة</TableHead>
              <TableHead className="text-right text-foreground">المستوى</TableHead>
              <TableHead className="text-right text-foreground">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id} className="border-border">
                <TableCell className="text-foreground">{course.course_name}</TableCell>
                <TableCell className="text-foreground">{course.level ? `المستوى ${course.level}` : "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCourse(course);
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
                          <AlertDialogTitle className="text-right">حذف المادة؟</AlertDialogTitle>
                          <AlertDialogDescription className="text-right">
                            سيتم حذف المادة <span className="font-bold text-destructive">"{course.course_name}"</span> .هل أنت متأكد؟
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="justify-end gap-2">
                          <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCourse(course.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {courses.map((course) => (
          <Card key={course.id} className="p-4 bg-card/95 backdrop-blur-sm border-border flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-foreground text-lg">{course.course_name}</span>
              <span className="text-sm text-muted-foreground">{course.level ? `المستوى ${course.level}` : "-"}</span>
            </div>
            <div className="flex gap-2 justify-end border-t border-border/50 pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCourse(course);
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
                    <AlertDialogTitle className="text-right">حذف المادة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                      سيتم حذف المادة <span className="font-bold text-destructive">"{course.course_name}"</span> .هل أنت متأكد؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="justify-end gap-2">
                    <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteCourse(course.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
        {courses.length === 0 && (
           <div className="text-center text-muted-foreground py-8 bg-card/50 rounded-lg border border-border border-dashed">
             لا توجد مواد
           </div>
        )}
      </div>
    </div>
  );
};
