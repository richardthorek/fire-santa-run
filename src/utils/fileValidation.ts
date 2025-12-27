/**
 * File validation utilities for admin verification evidence uploads.
 * Validates file types, sizes, and performs security checks.
 */

/**
 * Allowed MIME types for evidence file uploads.
 * Supports images (JPEG, PNG, HEIC) and PDF documents.
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

/**
 * Maximum file size per individual file (5MB)
 */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Maximum total size for all files in a verification request (10MB)
 */
export const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Maximum number of evidence files per verification request
 */
export const MAX_FILES_PER_REQUEST = 5;

/**
 * Result type for file validation operations
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file type against allowed MIME types.
 * 
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * validateFileType(new File([''], 'doc.pdf', { type: 'application/pdf' }))
 * // { valid: true }
 * 
 * validateFileType(new File([''], 'doc.exe', { type: 'application/x-msdownload' }))
 * // { valid: false, error: 'File type not allowed...' }
 */
export function validateFileType(file: File): FileValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: JPEG, PNG, HEIC, PDF. Got: ${file.type || 'unknown'}`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate individual file size.
 * 
 * @param file - File to validate
 * @returns Validation result with error message if too large
 * 
 * @example
 * validateFileSize(new File(['x'.repeat(1000)], 'small.pdf'))
 * // { valid: true }
 */
export function validateFileSize(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File too large. Maximum size: 5MB. File size: ${sizeMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate total size of multiple files.
 * 
 * @param files - Array of files to validate
 * @returns Validation result with error message if total too large
 * 
 * @example
 * validateTotalSize([file1, file2])
 * // { valid: true }
 */
export function validateTotalSize(files: File[]): FileValidationResult {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Total file size too large. Maximum total: 10MB. Total size: ${sizeMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate number of files in a verification request.
 * 
 * @param files - Array of files to validate
 * @returns Validation result with error message if too many files
 */
export function validateFileCount(files: File[]): FileValidationResult {
  if (files.length === 0) {
    return {
      valid: false,
      error: 'At least one evidence file is required',
    };
  }
  
  if (files.length > MAX_FILES_PER_REQUEST) {
    return {
      valid: false,
      error: `Too many files. Maximum: ${MAX_FILES_PER_REQUEST} files`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate file name for security issues.
 * Checks for path traversal attempts and suspicious characters.
 * 
 * @param filename - Filename to validate
 * @returns Validation result with error message if invalid
 */
export function validateFilename(filename: string): FileValidationResult {
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return {
      valid: false,
      error: 'Filename contains invalid characters',
    };
  }
  
  // Check for null bytes (security issue)
  if (filename.includes('\0')) {
    return {
      valid: false,
      error: 'Filename contains invalid characters',
    };
  }
  
  // Check filename length
  if (filename.length === 0) {
    return {
      valid: false,
      error: 'Filename cannot be empty',
    };
  }
  
  if (filename.length > 255) {
    return {
      valid: false,
      error: 'Filename too long (max 255 characters)',
    };
  }
  
  return { valid: true };
}

/**
 * Comprehensive validation of a single evidence file.
 * Checks file type, size, and filename.
 * 
 * @param file - File to validate
 * @returns Validation result with error message if any check fails
 */
export function validateEvidenceFile(file: File): FileValidationResult {
  // Validate filename
  const filenameResult = validateFilename(file.name);
  if (!filenameResult.valid) {
    return filenameResult;
  }
  
  // Validate file type
  const typeResult = validateFileType(file);
  if (!typeResult.valid) {
    return typeResult;
  }
  
  // Validate file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) {
    return sizeResult;
  }
  
  return { valid: true };
}

/**
 * Comprehensive validation of all evidence files in a verification request.
 * Validates count, individual files, and total size.
 * 
 * @param files - Array of files to validate
 * @returns Validation result with error message if any check fails
 */
export function validateEvidenceFiles(files: File[]): FileValidationResult {
  // Validate file count
  const countResult = validateFileCount(files);
  if (!countResult.valid) {
    return countResult;
  }
  
  // Validate each file individually
  for (const file of files) {
    const fileResult = validateEvidenceFile(file);
    if (!fileResult.valid) {
      return {
        valid: false,
        error: `${file.name}: ${fileResult.error}`,
      };
    }
  }
  
  // Validate total size
  const totalSizeResult = validateTotalSize(files);
  if (!totalSizeResult.valid) {
    return totalSizeResult;
  }
  
  return { valid: true };
}

/**
 * Scan file for malware using client-side heuristics.
 * This is a basic check - true malware scanning should be done server-side.
 * 
 * @param file - File to scan
 * @returns Validation result with error message if suspicious
 * 
 * Note: This is a placeholder for future integration with Azure Blob Storage
 * malware scanning. In production, server-side scanning is required.
 */
export function scanForMalware(file: File): FileValidationResult {
  // Basic client-side checks (server-side scanning required for production)
  
  // Check for suspicious file extensions hidden in name
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.scr', '.vbs', '.js'];
  const lowerName = file.name.toLowerCase();
  
  for (const ext of suspiciousExtensions) {
    if (lowerName.includes(ext)) {
      return {
        valid: false,
        error: 'File appears to contain executable code and cannot be uploaded',
      };
    }
  }
  
  // Additional checks could include:
  // - File magic number verification (check first bytes match declared MIME type)
  // - Embedded executable detection in PDFs
  // - These should be implemented server-side with proper malware scanning
  
  return { valid: true };
}
