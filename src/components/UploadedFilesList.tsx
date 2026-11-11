import React, { useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { getFileFormatInfo, ACCEPTED_DOCUMENT_TYPES } from '../utils/fileHelpers';

export interface UploadedFileItem {
  id: string;
  name: string;
  size: string;
  type: string;
  base64: string;
  previewUrl?: string;
  textContent?: string;
}

interface UploadedFilesListProps {
  files: UploadedFileItem[];
  onRemoveFile: (id: string) => void;
  onReplaceFile: (id: string, newFile: File) => void;
  errorMessages?: string[];
  onClearErrors?: () => void;
}

export const UploadedFilesList: React.FC<UploadedFilesListProps> = ({
  files,
  onRemoveFile,
  onReplaceFile,
  errorMessages = [],
  onClearErrors,
}) => {
  const replaceTargetIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerReplace = (fileId: string) => {
    replaceTargetIdRef.current = fileId;
    fileInputRef.current?.click();
  };

  const handleFilePickedForReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = e.target.files?.[0];
    if (pickedFile && replaceTargetIdRef.current) {
      onReplaceFile(replaceTargetIdRef.current, pickedFile);
    }
    // reset input
    e.target.value = '';
    replaceTargetIdRef.current = null;
  };

  // Summary counts
  const pdfCount = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')).length;
  const imgCount = files.filter((f) => f.type.startsWith('image/')).length;
  const otherCount = files.length - pdfCount - imgCount;

  return (
    <div className="space-y-3">
      {/* Hidden file input for Replace action */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePickedForReplace}
        accept={ACCEPTED_DOCUMENT_TYPES}
        className="hidden"
      />

      {/* Validation Error Banner if any */}
      {errorMessages.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>File Validation Notice:</span>
            </div>
            {onClearErrors && (
              <button
                type="button"
                onClick={onClearErrors}
                className="text-[10px] text-rose-500 hover:text-rose-800 cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-700">
            {errorMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Files Header & Counter */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Selected Files ({files.length})
                {(pdfCount > 0 || imgCount > 0) && (
                  <span className="text-[11px] font-normal text-slate-500 ml-1">
                    · {pdfCount > 0 && `${pdfCount} PDF${pdfCount > 1 ? 's' : ''}`}
                    {pdfCount > 0 && imgCount > 0 && ', '}
                    {imgCount > 0 && `${imgCount} Image${imgCount > 1 ? 's' : ''}`}
                    {otherCount > 0 && `, ${otherCount} other doc${otherCount > 1 ? 's' : ''}`}
                  </span>
                )}
              </span>
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Ready for multimodal AI analysis</span>
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {files.map((file, idx) => {
              const fmt = getFileFormatInfo(file.name, file.type);
              return (
                <div
                  key={file.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between gap-2.5 group"
                >
                  {/* Thumbnail / Icon */}
                  <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : fmt.isPdf ? (
                      <div className="flex flex-col items-center justify-center text-rose-600 font-bold text-[9px]">
                        <FileText className="w-5 h-5 text-rose-500" />
                        <span className="text-[8px] font-extrabold uppercase">PDF</span>
                      </div>
                    ) : (
                      <FileText className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>

                  {/* Name and Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${fmt.badgeClass}`}
                      >
                        {fmt.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                    </div>
                    <div
                      className="font-bold text-slate-800 truncate text-xs mt-0.5"
                      title={file.name}
                    >
                      {file.name}
                    </div>
                    <div className="text-[10px] text-slate-400">{file.size}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTriggerReplace(file.id)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                      title="Replace this file"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(file.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      title="Remove this file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
