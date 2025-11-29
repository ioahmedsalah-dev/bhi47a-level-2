import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import StudentLogin from "./pages/StudentLogin"; // Eager load critical path

// Lazy load other pages for code splitting
const NotFound = lazy(() => import("./pages/NotFound"));
const Grades = lazy(() => import("./pages/Grades"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Fallback component for lazy loading
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<Index />}
          />
          <Route
            path="/student/login"
            element={<StudentLogin />}
          />
          <Route
            path="/grades"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Grades />
              </Suspense>
            }
          />
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <AdminLogin />
              </Suspense>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <AdminDashboard />
              </Suspense>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route
            path="*"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
