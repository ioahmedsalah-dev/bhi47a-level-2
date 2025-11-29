import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getAdminSession, logAdminAction } from "@/integrations/supabase/auth";


interface ExcelRow {
  student_code?: string | number;
  student_name?: string;
  national_id?: string | number;
  course_name?: string;
  grade?: number;
}

const BulkUploadTab = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ student_code: string; student_name: string; national_id?: string; grade?: number; status?: string; isValid: boolean; error?: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load courses using React Query
  const { data: courses = [] } = useQuery({
    queryKey: ["courses_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('id, course_name').order('course_name');
      if (error) throw error;
      return data;
    },
  });

  // Set default selected course when courses are loaded
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const handleClearFile = () => {
    setFile(null);
    setPreview([]);
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setFile(selectedFile);
      
      // Preview the data
      try {
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        console.log('Workbook sheets:', workbook.SheetNames);
        const sheetName = workbook.SheetNames[0];
        console.log('Using sheet:', sheetName);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const dataRows = jsonData.slice(1) as (string | number)[][];
        
        const previewData: { student_code: string; student_name: string; national_id?: string; grade?: number; status?: string; isValid: boolean; error?: string }[] = [];
        const seenRecords = new Set<string>();
        const seenNationalIds = new Set<string>();
        
        for (let index = 0; index < dataRows.length; index++) {
          const row = dataRows[index];
          const rowNumber = index + 2;
          
          let isValid = true;
          let error = '';
          let nationalId: string | undefined = undefined;
          let grade: number | undefined = undefined;
          let status: string = '_';

          // Validation checks
          if (!row[0] || !row[1]) {
            isValid = false;
            error = 'حقول ناقصة';
          } else {
            const studentCode = String(row[0]).trim();
            if (seenRecords.has(studentCode)) {
              isValid = false;
              error = 'تكرار كود الطالب';
            }
            seenRecords.add(studentCode);

            // Check columns for National ID and Grade
            // Format MUST be: Code, Name, National ID, Grade, Status (optional)
            
            const val2 = row[2];
            const val3 = row[3];
            const val4 = row[4];

            // Check National ID (Column 3)
            if (val2 === undefined || val2 === null || String(val2).trim() === '') {
              isValid = false;
              if (error) error += ' و الرقم القومي مفقود';
              else error = 'الرقم القومي مفقود';
            } else {
              nationalId = String(val2).trim();
              if (seenNationalIds.has(nationalId)) {
                isValid = false;
                if (error) error += ' و تكرار الرقم القومي';
                else error = 'تكرار الرقم القومي';
              }
              seenNationalIds.add(nationalId);
            }

            // Check Grade (Column 4)
            if (val3 === undefined || val3 === null || String(val3).trim() === '') {
              // Check if user might be using old format (Code, Name, Grade)
              // If val2 looks like a grade and val3 is empty
              const v2Num = Number(val2);
              if (!isNaN(v2Num) && v2Num <= 100) {
                 isValid = false;
                 error = 'الرقم القومي مفقود (التنسيق القديم غير مدعوم)';
              } else {
                 isValid = false;
                 if (error) error += ' و الدرجة مفقودة';
                 else error = 'الدرجة مفقودة';
              }
            } else {
              const g = Number(val3);
              if (!isNaN(g)) {
                grade = g;
              } else {
                isValid = false;
                if (error) error += ' و درجة غير صحيحة';
                else error = 'درجة غير صحيحة';
              }
            }

            // Check Status (Column 5) 
            if (val4 === undefined || val4 === null || String(val4).trim() === '') {
              isValid = false;
              if (error) error += ' و الحالة مفقودة';
              else error = 'الحالة مفقودة';
            } else {
              const s = String(val4).trim().toLowerCase();
              status = s;
              const validStatuses = ['active', 'absent', 'hide'];
              if (!validStatuses.includes(s)) {
                isValid = false;
                if (error) error += ' و حالة غير صحيحة';
                else error = 'حالة غير صحيحة (يجب أن تكون: active, absent, hide)';
              }
            }
          }
          
          previewData.push({
            student_code: String(row[0] || '').trim(),
            student_name: String(row[1] || '').trim(),
            national_id: nationalId,
            grade: grade,
            status: status,
            isValid: isValid,
            error: error
          });
        }
        setPreview(previewData);
        setCurrentPage(1);
      } catch (error) {
        console.error('Preview error:', error);
        setPreview([]);
      }
    } else {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار ملف Excel صحيح (.xlsx أو .xls)",
        variant: "destructive",
      });
      setFile(null);
      setPreview([]);
    }
  };

  const processExcel = async () => {
    if (!file) return;

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

    setLoading(true);
    try {
      console.log('Starting file processing...');

      // Validate that a course is selected
      if (!selectedCourseId) {
        throw new Error('يجب اختيار مادة أولاً');
      }

      const selectedCourse = courses.find(c => c.id === selectedCourseId);
      if (!selectedCourse) {
        throw new Error('المادة المختارة غير متاحة');
      }

      const data = await file.arrayBuffer();
      console.log('File loaded, size:', data.byteLength);

      const workbook = XLSX.read(data);
      console.log('Workbook sheets:', workbook.SheetNames);
      const sheetName = workbook.SheetNames[0];
      console.log('Using sheet:', sheetName);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log('Raw data:', jsonData);

      // Skip header row and process data
      const dataRows = jsonData.slice(1) as (string | number)[][];
      console.log('Data rows:', dataRows);

      // Expected columns: 0: student_code, 1: student_name, 2: national_id (optional/mandatory), 3: grade, 4: status (optional)
      const processedData: { student_code: string; student_name: string; national_id?: string; grade: number; status: string }[] = [];
      const invalidRows: string[] = [];
      const seenRecords = new Set<string>();
      const seenNationalIds = new Set<string>();

      for (let index = 0; index < dataRows.length; index++) {
        const row = dataRows[index];
        const rowNumber = index + 2; // +1 for header, +1 for human-readable (not 0-indexed)
        
        console.log(`Processing row ${rowNumber}:`, row);
        
        // Check if all first two columns exist (student_code, student_name)
        if (!row[0] || !row[1]) {
          invalidRows.push(`الصف ${rowNumber}: العموديات الأولى والثانية مطلوبة (رقم الطالب، اسم الطالب)`);
          continue;
        }

        let nationalId: string | undefined = undefined;
        let gradeNumber: number | undefined = undefined;
        let status: string = 'active';

        const val2 = row[2];
        const val3 = row[3];
        const val4 = row[4];

        // Validate National ID
        if (val2 === undefined || val2 === null || String(val2).trim() === '') {
           invalidRows.push(`الصف ${rowNumber}: الرقم القومي مفقود`);
           continue;
        }
        nationalId = String(val2).trim();

        if (seenNationalIds.has(nationalId)) {
           invalidRows.push(`الصف ${rowNumber}: تكرار - الرقم القومي '${nationalId}' موجود بالفعل في الملف`);
           continue;
        }
        seenNationalIds.add(nationalId);

        // Validate Grade
        if (val3 === undefined || val3 === null || String(val3).trim() === '') {
           invalidRows.push(`الصف ${rowNumber}: الدرجة مفقودة`);
           continue;
        }
        
        const g = Number(val3);
        if (isNaN(g)) {
           invalidRows.push(`الصف ${rowNumber}: الدرجة غير صحيحة`);
           continue;
        }
        gradeNumber = g;

        // Validate Status
        if (val4 === undefined || val4 === null || String(val4).trim() === '') {
           invalidRows.push(`الصف ${rowNumber}: الحالة مفقودة`);
           continue;
        } else {
          const s = String(val4).trim().toLowerCase();
          const validStatuses = ['active', 'absent', 'hide'];
          if (validStatuses.includes(s)) {
            status = s;
          } else {
            invalidRows.push(`الصف ${rowNumber}: حالة غير صحيحة (يجب أن تكون: active, absent, hide)`);
            continue;
          }
        }
        
        const studentCode = String(row[0]).trim();
        
        // Check for duplicates within the file
        if (seenRecords.has(studentCode)) {
          invalidRows.push(`الصف ${rowNumber}: تكرار - الطالب '${studentCode}' موجود بالفعل في الملف`);
          continue;
        }
        
        seenRecords.add(studentCode);
        
        processedData.push({
          student_code: studentCode,
          student_name: String(row[1]).trim(),
          national_id: nationalId,
          grade: gradeNumber,
          status: status
        });
      }

      console.log('Processed data:', processedData);
      console.log('Invalid rows:', invalidRows);

      // If there are any errors, show them and prevent upload
      if (invalidRows.length > 0) {
        const errorMessage = invalidRows.slice(0, 5).join('\n');
        const totalErrors = invalidRows.length;
        const errorSuffix = totalErrors > 5 ? `\n... و ${totalErrors - 5} أخطاء أخرى` : '';
        throw new Error(`وجدت أخطاء في البيانات:\n${errorMessage}${errorSuffix}`);
      }

      if (processedData.length === 0) {
        throw new Error("لا توجد بيانات صحيحة في الملف");
      }

      // Upsert students (insert new or update existing)
      const studentsToUpsert = processedData.map(row => ({ 
        student_code: row.student_code, 
        student_name: row.student_name,
        national_id: row.national_id,
        status: row.status
      }));

      console.log('Students to upsert:', studentsToUpsert);

      if (studentsToUpsert.length > 0) {
        const { error: studentError } = await supabase
          .from('students')
          .upsert(studentsToUpsert, { onConflict: 'student_code' });
          
        if (studentError) {
          console.error('Student upsert error:', studentError);
          throw studentError;
        }
        console.log('Students upserted successfully');
      }

      // Insert new courses (ignore duplicates by checking existing)
      console.log('Courses already managed in CoursesTab - no new courses created');

      console.log('Using course:', selectedCourse.course_name);

      // Insert grades (all have grades now, they're mandatory)
      const gradeInserts = [];
      for (const row of processedData) {
        console.log('Looking up student:', row.student_code);
        const { data: student, error: studentLookupError } = await supabase.from('students').select('id').eq('student_code', row.student_code).single();
        if (studentLookupError) {
          console.error('Student lookup error:', studentLookupError);
          continue;
        }

        if (student) {
          gradeInserts.push({
            student_id: student.id,
            course_id: selectedCourse.id,
            grade: row.grade
          });
        }
      }

      console.log('Grade inserts:', gradeInserts);

      if (gradeInserts.length > 0) {
        const { error: gradeError } = await supabase.from('grades').upsert(gradeInserts, { onConflict: 'student_id,course_id' });
        if (gradeError) {
          console.error('Grade insert error:', gradeError);
          throw gradeError;
        }
        console.log('Grades inserted successfully');
      }

      console.log('Summary:');
      console.log('- Processed rows:', processedData.length);
      console.log('- Students upserted:', studentsToUpsert.length);
      console.log('- Grades inserted/updated:', gradeInserts.length);

      // Log action
      await logAdminAction(session.adminCode, "bulk_upload", "upsert", {
        course_id: selectedCourse.id,
        total_rows: processedData.length,
        students_processed: studentsToUpsert.length,
        grades_inserted: gradeInserts.length
      });

      toast({
        title: "نجح الرفع",
        description: `تم معالجة ${processedData.length} سجل (تحديث/إضافة ${studentsToUpsert.length} طالب, ${gradeInserts.length} درجة) للمادة: ${selectedCourse.course_name}`,
      });

      // Invalidate queries to refresh data in other tabs
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students_list"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });

      setFile(null);
      setPreview([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : "حدث خطأ غير معروف أثناء رفع البيانات";
      toast({
        title: "خطأ",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCourseData = async () => {
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

    if (!selectedCourseId) {
      toast({
        title: "تنبيه",
        description: "الرجاء اختيار المادة التي تريد حذف بياناتها",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('course_id', selectedCourseId);

      if (error) throw error;

      // Log action
      await logAdminAction(session.adminCode, "grades", "delete_course_grades", {
        course_id: selectedCourseId
      });

      toast({
        title: "تم الحذف",
        description: "تم حذف جميع درجات المادة المحددة بنجاح",
      });

      // Invalidate queries to refresh data in other tabs
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const message = error instanceof Error ? error.message : "حدث خطأ غير معروف";
      toast({
        title: "خطأ",
        description: message,
        variant: "destructive",
      });
    }
  };

  const deleteAllData = async () => {
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
      // Delete in order: grades first (due to foreign keys), then students, then courses
      // Using gt (greater than) with nil UUID is a reliable way to match all rows
      const { error: gradeError } = await supabase.from('grades').delete().gt('id', '00000000-0000-0000-0000-000000000000');
      if (gradeError) throw gradeError;

      const { error: studentError } = await supabase.from('students').delete().gt('id', '00000000-0000-0000-0000-000000000000');
      if (studentError) throw studentError;

      const { error: courseError } = await supabase.from('courses').delete().gt('id', '00000000-0000-0000-0000-000000000000');
      if (courseError) throw courseError;

      // Log action
      await logAdminAction(session.adminCode, "system", "delete_all_data", {});

      // Reset local state to reflect changes immediately
      setSelectedCourseId('');
      setPreview([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Invalidate all queries to refresh data in other tabs
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students_list"] });
      queryClient.invalidateQueries({ queryKey: ["courses_list"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });

      toast({
        title: "تم الحذف",
        description: "تم حذف جميع البيانات بنجاح",
      });
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const message = error instanceof Error ? error.message : "حدث خطأ غير معروف";
      toast({
        title: "خطأ",
        description: message,
        variant: "destructive",
      });
    }
  };

  const totalPages = Math.ceil(preview.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = preview.slice(startIndex, endIndex);

  return (
    <Card className="p-6 bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-glow)]">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">رفع البيانات بالجملة</h2>
          <p className="text-muted-foreground">
            ارفع ملف Excel يحتوي على بيانات الطلاب والدرجات
          </p>
        </div>

        <div className="space-y-4 ">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
            <div>
              <Label htmlFor="course-select">اختر المادة</Label>
              <div className="mt-2">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger id="course-select" className="text-right bg-secondary/40 border-input" dir="rtl">
                    <SelectValue placeholder="-- اختر مادة --" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border ">
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="excel-file">اختر ملف Excel (.xlsx)</Label>
              <Input
                id="excel-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="mt-2 cursor-pointer text-left"
                dir="ltr"
              />
            </div>
          </div>

          {file && (
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-secondary/30 p-3 rounded-lg border border-border/50">
              <div className="flex items-center w-full md:w-auto">
                <div className="font-semibold text-foreground ml-2">الملف المختار:</div>
                <div className="text-sm font-bold text-muted-foreground truncate">
                  {file.name}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFile}
                className="w-full md:w-auto flex text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
              >
                <X className="w-4 h-4 ml-1" />
                إزالة الملف
              </Button>
            </div>
          )}

          {preview.length > 0 && (
            <div className="bg-secondary/50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  معاينة البيانات
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">{preview.length} صف</span>
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    صفحة {currentPage} من {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="preview-scroll max-h-96 overflow-y-auto bg-white overflow-x-auto">
                {/* Header Row */}
                <div className="sticky top-0 bg-gray-100 grid grid-cols-12 gap-2 px-4 py-3 text-xs font-bold text-gray-700 border-b border-gray-200 min-w-[600px]">
                  <div className="col-span-2">رقم الطالب</div>
                  <div className="col-span-3">اسم الطالب</div>
                  <div className="col-span-2">الرقم القومي</div>
                  <div className="col-span-1">الدرجة</div>
                  <div className="col-span-2">الحالة</div>
                  <div className="col-span-2">الخطأ</div>
                </div>

                {/* Data Rows */}
                {currentData.map((row, index) => (
                  <div 
                    key={startIndex + index} 
                    className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 text-sm transition-colors min-w-[600px] ${
                      row.isValid 
                        ? 'bg-green-50 hover:bg-green-100' 
                        : 'bg-red-50 hover:bg-red-100'
                    }`}
                  >
                    <div className="col-span-2 font-mono text-gray-700 truncate">{row.student_code || '—'}</div>
                    <div className="col-span-3 text-gray-700 truncate">{row.student_name || '—'}</div>
                    <div className="col-span-2 font-mono text-gray-700 truncate">{row.national_id || '—'}</div>
                    <div className="col-span-1 font-semibold text-gray-700">{row.grade ?? '—'}</div>
                    <div className="col-span-2 text-gray-700 truncate">{row.status}</div>
                    <div className="col-span-2 flex items-center gap-1">
                      {row.isValid ? (
                        <span className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          صحيح
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-700 text-xs font-semibold">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          {row.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-secondary/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">تنسيق الملف المطلوب:</h3>
            <p className="text-sm text-muted-foreground">
              العمود الأول: الكود الاكاديمي<br />
              العمود الثاني: اسم الطالب<br />
              العمود الثالث: الرقم القومي (<span className="font-semibold text-foreground">مطلوب</span>)<br />
              العمود الرابع: الدرجة (رقم، <span className="font-semibold text-foreground">مطلوب</span>)<br />
              العمود الخامس: الحالة (<span className="font-semibold text-foreground">مطلوب</span>) - القيم المسموحة: active, absent, hide
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              * الصف الأول هو العناوين (سيتم تجاهله)<br />
              * جميع الحقول مطلوبة<br />
              * لا يمكن أن يكون هناك تكرار لنفس الطالب في الملف<br />
              * يجب إضافة المواد أولاً من تبويب "المواد" قبل الرفع
            </p>
          </div>

          <Button
            onClick={processExcel}
            disabled={!file || loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? "جاري الرفع..." : "رفع البيانات"}
          </Button>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
            ⚠️ منطقة الخطر
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 space-y-3">
              <h4 className="font-medium text-foreground">حذف بيانات مادة محددة</h4>
              <p className="text-sm text-muted-foreground">
                سيتم حذف جميع الدرجات المسجلة للمادة المختارة ({courses.find(c => c.id === selectedCourseId)?.course_name || 'لم يتم الاختيار'}).
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10" disabled={!selectedCourseId}>
                    حذف بيانات المادة
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">حذف بيانات المادة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                      سيتم حذف جميع الدرجات المرتبطة بمادة <span className="font-bold text-destructive">"{courses.find(c => c.id === selectedCourseId)?.course_name}"</span>. هل أنت متأكد؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="justify-end gap-2">
                    <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteCourseData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 space-y-3">
              <h4 className="font-medium text-foreground">حذف جميع البيانات</h4>
              <p className="text-sm text-muted-foreground">
                سيتم حذف جميع الطلاب والمواد والدرجات من النظام نهائياً.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    حذف الكل
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">هل أنت متأكد تماماً؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                      سيتم حذف جميع الطلاب والمواد والدرجات نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="justify-end gap-2">
                    <AlertDialogCancel className="ml-0">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAllData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      حذف الكل
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BulkUploadTab;
