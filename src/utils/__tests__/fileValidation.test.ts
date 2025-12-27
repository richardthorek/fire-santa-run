/**
 * Unit tests for file validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  validateTotalSize,
  validateFileCount,
  validateFilename,
  validateEvidenceFile,
  validateEvidenceFiles,
  scanForMalware,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
} from '../fileValidation';

describe('fileValidation', () => {
  describe('validateFileType', () => {
    it('should accept JPEG files', () => {
      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept PNG files', () => {
      const file = new File([''], 'photo.png', { type: 'image/png' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(true);
    });

    it('should accept PDF files', () => {
      const file = new File([''], 'document.pdf', { type: 'application/pdf' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(true);
    });

    it('should accept HEIC files', () => {
      const file = new File([''], 'photo.heic', { type: 'image/heic' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(true);
    });

    it('should reject executable files', () => {
      const file = new File([''], 'malware.exe', { type: 'application/x-msdownload' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should reject text files', () => {
      const file = new File([''], 'document.txt', { type: 'text/plain' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should reject unknown file types', () => {
      const file = new File([''], 'unknown.xyz', { type: '' });
      const result = validateFileType(file);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files under size limit', () => {
      const content = 'x'.repeat(1000); // 1KB
      const file = new File([content], 'small.pdf', { type: 'application/pdf' });
      const result = validateFileSize(file);
      
      expect(result.valid).toBe(true);
    });

    it('should accept files at size limit', () => {
      const content = 'x'.repeat(MAX_FILE_SIZE_BYTES);
      const file = new File([content], 'max.pdf', { type: 'application/pdf' });
      const result = validateFileSize(file);
      
      expect(result.valid).toBe(true);
    });

    it('should reject files over size limit', () => {
      const content = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1);
      const file = new File([content], 'large.pdf', { type: 'application/pdf' });
      const result = validateFileSize(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
      expect(result.error).toContain('5MB');
    });

    it('should include file size in error message', () => {
      const content = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1000000); // Over by ~1MB
      const file = new File([content], 'large.pdf', { type: 'application/pdf' });
      const result = validateFileSize(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/\d+\.\d+MB/);
    });
  });

  describe('validateTotalSize', () => {
    it('should accept multiple files under total limit', () => {
      const files = [
        new File(['x'.repeat(1000000)], 'file1.pdf', { type: 'application/pdf' }),
        new File(['x'.repeat(1000000)], 'file2.pdf', { type: 'application/pdf' }),
      ];
      const result = validateTotalSize(files);
      
      expect(result.valid).toBe(true);
    });

    it('should accept files at total limit', () => {
      const files = [
        new File(['x'.repeat(MAX_TOTAL_SIZE_BYTES / 2)], 'file1.pdf', { type: 'application/pdf' }),
        new File(['x'.repeat(MAX_TOTAL_SIZE_BYTES / 2)], 'file2.pdf', { type: 'application/pdf' }),
      ];
      const result = validateTotalSize(files);
      
      expect(result.valid).toBe(true);
    });

    it('should reject files over total limit', () => {
      const files = [
        new File(['x'.repeat(MAX_TOTAL_SIZE_BYTES / 2 + 1)], 'file1.pdf', { type: 'application/pdf' }),
        new File(['x'.repeat(MAX_TOTAL_SIZE_BYTES / 2 + 1)], 'file2.pdf', { type: 'application/pdf' }),
      ];
      const result = validateTotalSize(files);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Total file size too large');
      expect(result.error).toContain('10MB');
    });
  });

  describe('validateFileCount', () => {
    it('should accept valid number of files', () => {
      const files = [
        new File([''], 'file1.pdf', { type: 'application/pdf' }),
        new File([''], 'file2.pdf', { type: 'application/pdf' }),
      ];
      const result = validateFileCount(files);
      
      expect(result.valid).toBe(true);
    });

    it('should reject empty file array', () => {
      const result = validateFileCount([]);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one evidence file is required');
    });

    it('should reject too many files', () => {
      const files = Array(MAX_FILES_PER_REQUEST + 1).fill(null).map((_, i) => 
        new File([''], `file${i}.pdf`, { type: 'application/pdf' })
      );
      const result = validateFileCount(files);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many files');
    });

    it('should accept maximum number of files', () => {
      const files = Array(MAX_FILES_PER_REQUEST).fill(null).map((_, i) => 
        new File([''], `file${i}.pdf`, { type: 'application/pdf' })
      );
      const result = validateFileCount(files);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFilename', () => {
    it('should accept valid filenames', () => {
      expect(validateFilename('photo.jpg').valid).toBe(true);
      expect(validateFilename('document.pdf').valid).toBe(true);
      expect(validateFilename('my-file_2024.png').valid).toBe(true);
    });

    it('should reject path traversal attempts', () => {
      expect(validateFilename('../../../etc/passwd').valid).toBe(false);
      expect(validateFilename('..\\..\\windows\\system32').valid).toBe(false);
      expect(validateFilename('file/../other.pdf').valid).toBe(false);
    });

    it('should reject filenames with slashes', () => {
      expect(validateFilename('path/to/file.pdf').valid).toBe(false);
      expect(validateFilename('path\\to\\file.pdf').valid).toBe(false);
    });

    it('should reject filenames with null bytes', () => {
      expect(validateFilename('file\0.pdf').valid).toBe(false);
    });

    it('should reject empty filenames', () => {
      const result = validateFilename('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject very long filenames', () => {
      const longName = 'a'.repeat(256) + '.pdf';
      const result = validateFilename(longName);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should accept filename at max length', () => {
      const maxName = 'a'.repeat(251) + '.pdf'; // 255 chars total
      const result = validateFilename(maxName);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEvidenceFile', () => {
    it('should validate complete file successfully', () => {
      const file = new File(['x'.repeat(1000)], 'evidence.jpg', { type: 'image/jpeg' });
      const result = validateEvidenceFile(file);
      
      expect(result.valid).toBe(true);
    });

    it('should fail on invalid filename', () => {
      const file = new File(['x'.repeat(1000)], '../malicious.jpg', { type: 'image/jpeg' });
      const result = validateEvidenceFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should fail on invalid file type', () => {
      const file = new File(['x'.repeat(1000)], 'file.txt', { type: 'text/plain' });
      const result = validateEvidenceFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should fail on file too large', () => {
      const file = new File(['x'.repeat(MAX_FILE_SIZE_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' });
      const result = validateEvidenceFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('validateEvidenceFiles', () => {
    it('should validate multiple files successfully', () => {
      const files = [
        new File(['x'.repeat(1000)], 'evidence1.jpg', { type: 'image/jpeg' }),
        new File(['x'.repeat(1000)], 'evidence2.pdf', { type: 'application/pdf' }),
      ];
      const result = validateEvidenceFiles(files);
      
      expect(result.valid).toBe(true);
    });

    it('should fail on no files', () => {
      const result = validateEvidenceFiles([]);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one');
    });

    it('should fail on too many files', () => {
      const files = Array(MAX_FILES_PER_REQUEST + 1).fill(null).map((_, i) => 
        new File(['x'], `file${i}.jpg`, { type: 'image/jpeg' })
      );
      const result = validateEvidenceFiles(files);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many files');
    });

    it('should fail if any file is invalid', () => {
      const files = [
        new File(['x'.repeat(1000)], 'good.jpg', { type: 'image/jpeg' }),
        new File(['x'.repeat(1000)], 'bad.exe', { type: 'application/x-msdownload' }),
      ];
      const result = validateEvidenceFiles(files);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('bad.exe');
    });

    it('should fail on total size too large', () => {
      const files = Array(3).fill(null).map((_, i) => 
        new File(['x'.repeat(MAX_TOTAL_SIZE_BYTES / 2)], `file${i}.jpg`, { type: 'image/jpeg' })
      );
      const result = validateEvidenceFiles(files);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Total file size too large');
    });
  });

  describe('scanForMalware', () => {
    it('should pass safe files', () => {
      const file = new File(['x'.repeat(1000)], 'photo.jpg', { type: 'image/jpeg' });
      const result = scanForMalware(file);
      
      expect(result.valid).toBe(true);
    });

    it('should detect executable extensions in filename', () => {
      const suspiciousFiles = [
        'malware.exe',
        'script.bat',
        'command.cmd',
        'shell.sh',
        'powershell.ps1',
        'screen.scr',
        'virus.vbs',
        'code.js',
      ];

      for (const filename of suspiciousFiles) {
        const file = new File(['x'], filename, { type: 'application/octet-stream' });
        const result = scanForMalware(file);
        
        expect(result.valid).toBe(false);
        expect(result.error).toContain('executable code');
      }
    });

    it('should detect suspicious extensions in middle of filename', () => {
      const file = new File(['x'], 'photo.exe.jpg', { type: 'image/jpeg' });
      const result = scanForMalware(file);
      
      expect(result.valid).toBe(false);
    });

    it('should be case-insensitive', () => {
      const file = new File(['x'], 'MALWARE.EXE', { type: 'application/octet-stream' });
      const result = scanForMalware(file);
      
      expect(result.valid).toBe(false);
    });
  });
});
