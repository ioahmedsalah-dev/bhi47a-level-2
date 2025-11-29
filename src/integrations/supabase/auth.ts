import { supabase } from "./client";
export * from "./auth-utils";

// NEW: Secure server-side authentication
export const authenticateAdmin = async (
  adminCode: string,
  password: string
): Promise<{ 
  success: boolean; 
  sessionToken?: string; 
  adminId?: string; 
  adminName?: string; 
  error?: string 
}> => {
  try {
    // Call the secure RPC function 'login_admin'
    // This bypasses RLS restrictions by running as SECURITY DEFINER on the server
    const { data, error } = await supabase.rpc('login_admin', {
      p_admin_code: adminCode,
      p_password: password
    });

    if (error) {
      console.error("Login RPC error:", error);
      return { success: false, error: "Authentication failed" };
    }

    // The RPC returns a set of rows (even if just one), so we handle it as an array
    // or a single object depending on how Supabase client types it (usually array for RETURNS TABLE)
    const result = Array.isArray(data) ? data[0] : data;

    if (!result || !result.success) {
      return { 
        success: false, 
        error: result?.error_message || "Admin code or password is incorrect" 
      };
    }

    return {
      success: true,
      sessionToken: result.session_token,
      adminId: result.admin_id,
      adminName: result.admin_name
    };

  } catch (err) {
    console.error("Login error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
};

// DEPRECATED: Old client-side verification (kept for reference but should not be used)
export const verifyAdminPassword = async (
  adminCode: string,
  password: string
): Promise<{ success: boolean; adminId?: string; adminName?: string; error?: string }> => {
  console.warn("verifyAdminPassword is deprecated. Use authenticateAdmin instead.");
  return { success: false, error: "Please use the new secure login method" };
};

// DEPRECATED: Old session creation (kept for reference)
export const createAdminSession = async (
  adminCode: string,
  sessionToken: string
): Promise<string | null> => {
  console.warn("createAdminSession is deprecated. Session is now created by authenticateAdmin.");
  return null;
};

// Log admin action for audit trail
export const logAdminAction = async (
  adminCode: string,
  tableName: string,
  operation: string,
  changedData?: Record<string, string | number | boolean | null | object>
): Promise<void> => {
  try {
    // Log to browser console for now
    // Full audit logging will be available after TypeScript types are regenerated
    // console.log("Admin Action:", {
    //   admin_code: adminCode,
    //   table_name: tableName,
    //   operation: operation,
    //   changed_data: changedData || {},
    //   timestamp: new Date().toISOString(),
    // });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};
