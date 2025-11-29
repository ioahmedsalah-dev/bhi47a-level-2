
// Generate a secure session token
export const generateSessionToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Store session securely (consider using httpOnly cookies in production)
export const setAdminSession = (adminId: string, adminName: string, token: string, adminCode: string): void => {
  // Use localStorage to persist across tab closes, with short expiry
  localStorage.setItem("adminId", adminId);
  localStorage.setItem("adminName", adminName);
  localStorage.setItem("adminToken", token);
  localStorage.setItem("adminCode", adminCode);
  // Set expiry to 5 minutes from now
  localStorage.setItem("adminTokenExpiry", new Date(Date.now() + 5 * 60 * 1000).toISOString());
};

// Retrieve session safely
export const getAdminSession = (): { adminId: string; adminName: string; token: string; adminCode: string } | null => {
  const adminId = localStorage.getItem("adminId");
  const adminName = localStorage.getItem("adminName");
  const token = localStorage.getItem("adminToken");
  const adminCode = localStorage.getItem("adminCode");
  const expiry = localStorage.getItem("adminTokenExpiry");

  // Check if token is expired OR invalid
  const expiryDate = expiry ? new Date(expiry) : null;
  const isExpired = !expiryDate || isNaN(expiryDate.getTime()) || expiryDate < new Date();

  if (isExpired) {
    clearAdminSession();
    return null;
  }

  if (adminId && adminName && token && adminCode) {
    // Extend session expiry on activity (sliding window)
    localStorage.setItem("adminTokenExpiry", new Date(Date.now() + 30 * 60 * 1000).toISOString());
    return { adminId, adminName, token, adminCode };
  }

  return null;
};

// Clear session completely
export const clearAdminSession = (): void => {
  localStorage.removeItem("adminId");
  localStorage.removeItem("adminName");
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminCode");
  localStorage.removeItem("adminTokenExpiry");
};

// Validate input to prevent injection attacks
export const sanitizeInput = (input: string, maxLength: number = 255): string => {
  return input
    .slice(0, maxLength)
    .trim()
    .replace(/[<>'`]/g, "") // Remove potentially dangerous characters
    .split("")
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("");
};

// Validate student code format
export const validateStudentCode = (code: string): boolean => {
  // Allow alphanumeric with hyphens and underscores
  const codeRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return codeRegex.test(code);
};

// Validate grade value
export const validateGrade = (grade: number): boolean => {
  return Number.isInteger(grade) && grade >= 0 && grade <= 30;
};

// Validate course name
export const validateCourseName = (name: string): boolean => {
  return name.length >= 2 && name.length <= 100;
};
