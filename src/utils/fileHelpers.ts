/**
 * Utility helpers for universal multiple file handling across ADR, DDI, Medication Error, and Daily Casesheet modules.
 * Supports multiple images (JPG, PNG, WEBP, HEIC, TIFF, etc.), PDFs, and combinations of PDFs and multiple images in the same submission.
 */

export const ACCEPTED_DOCUMENT_TYPES =
  'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.heic,.doc,.docx,.txt,.csv,.json,.xml';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const MAX_TOTAL_BATCH_BYTES = 60 * 1024 * 1024; // 60 MB total

export interface FileValidationResult {
  isValid: boolean;
  validFiles: File[];
  errors: string[];
}

export function validateUploadedFiles(files: FileList | File[]): FileValidationResult {
  const filesArray = Array.from(files);
  const validFiles: File[] = [];
  const errors: string[] = [];
  let totalBytes = 0;

  const supportedExtensions = [
    'pdf',
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'bmp',
    'tiff',
    'tif',
    'heic',
    'heif',
    'doc',
    'docx',
    'txt',
    'csv',
    'json',
    'xml',
    'rtf',
  ];

  for (const file of filesArray) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // Check empty files
    if (file.size === 0) {
      errors.push(`"${file.name}" is an empty file (0 bytes) and cannot be processed.`);
      continue;
    }

    // Check file type
    const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'heic', 'heif'].includes(ext);
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isOtherDoc = supportedExtensions.includes(ext);

    if (!isImage && !isPdf && !isOtherDoc) {
      errors.push(
        `Unsupported file type for "${file.name}". Please upload PDF documents or clinical image files (JPEG, PNG, WebP, etc.).`
      );
      continue;
    }

    // Check individual file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(
        `"${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed file size of 25 MB.`
      );
      continue;
    }

    totalBytes += file.size;
    validFiles.push(file);
  }

  // Check cumulative batch size
  if (totalBytes > MAX_TOTAL_BATCH_BYTES) {
    errors.push(
      `Total submission size (${(totalBytes / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed batch size of 60 MB.`
    );
  }

  return {
    isValid: errors.length === 0,
    validFiles,
    errors,
  };
}

export function resolveFileMimeType(fileName: string = '', mimeType: string = ''): string {
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() : '';
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg'].includes(ext || '')) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'tiff' || ext === 'tif') return 'image/tiff';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'json') return 'application/json';
  if (ext === 'xml') return 'application/xml';
  if (ext === 'rtf') return 'application/rtf';
  if (ext === 'xls') return 'application/vnd.ms-excel';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (mimeType && mimeType !== 'application/octet-stream' && mimeType !== '') {
    return mimeType;
  }
  return 'application/pdf';
}

export function formatFileSize(bytes: number): string {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export async function readFileToUploadItem(
  file: File,
  idPrefix = 'file'
): Promise<{
  id: string;
  name: string;
  size: string;
  type: string;
  base64: string;
  previewUrl?: string;
  textContent?: string;
}> {
  const mimeType = resolveFileMimeType(file.name, file.type);
  const sizeStr = formatFileSize(file.size);
  const isImg = mimeType.startsWith('image/');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read or parse file "${file.name}". File may be unreadable or damaged.`));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const previewUrl = isImg ? dataUrl : undefined;
      let textContent = '';
      if (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        ['txt', 'csv', 'json', 'xml', 'log', 'rtf'].includes(file.name.split('.').pop()?.toLowerCase() || '')
      ) {
        try {
          textContent = atob(base64);
        } catch {
          textContent = '';
        }
      }

      resolve({
        id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: sizeStr,
        type: mimeType,
        base64,
        previewUrl,
        textContent,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function getFileFormatInfo(fileName: string = '', mimeType: string = '') {
  const resolved = resolveFileMimeType(fileName, mimeType);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImg = resolved.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'heic'].includes(ext);
  const isPdf = resolved === 'application/pdf' || ext === 'pdf';
  const isDoc = ['doc', 'docx'].includes(ext) || resolved.includes('word');
  const isSheet = ['csv', 'xls', 'xlsx'].includes(ext) || resolved.includes('spreadsheet') || resolved.includes('excel') || resolved === 'text/csv';
  const isText = ['txt', 'rtf', 'log', 'md'].includes(ext) || resolved.startsWith('text/');
  const isCode = ['json', 'xml'].includes(ext) || resolved === 'application/json' || resolved === 'application/xml';

  if (isPdf) {
    return {
      label: 'PDF',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      iconType: 'pdf' as const,
      isPdf: true,
      isDoc: false,
      isImg: false,
    };
  }
  if (isDoc) {
    return {
      label: ext.toUpperCase() || 'DOC',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      iconType: 'doc' as const,
      isPdf: false,
      isDoc: true,
      isImg: false,
    };
  }
  if (isSheet) {
    return {
      label: ext.toUpperCase() || 'CSV',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      iconType: 'sheet' as const,
      isPdf: false,
      isDoc: false,
      isImg: false,
    };
  }
  if (isCode) {
    return {
      label: ext.toUpperCase(),
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      iconType: 'code' as const,
      isPdf: false,
      isDoc: false,
      isImg: false,
    };
  }
  if (isText) {
    return {
      label: 'TXT',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      iconType: 'text' as const,
      isPdf: false,
      isDoc: false,
      isImg: false,
    };
  }
  if (isImg) {
    return {
      label: ext ? ext.toUpperCase() : 'IMG',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      iconType: 'image' as const,
      isPdf: false,
      isDoc: false,
      isImg: true,
    };
  }
  return {
    label: ext ? ext.toUpperCase() : 'DOC',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    iconType: 'file' as const,
    isPdf: false,
    isDoc: false,
    isImg: false,
  };
}
