import { X, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';
import { formatBytes, getMimeConfig } from '@/types/facultyNotes';

interface Props {
  file:        File;
  isUploading: boolean;
  onClear:     () => void;
}

export default function UploadFilePreview({ file, isUploading, onClear }: Props): JSX.Element {
  const mime = getMimeConfig(file.type);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      {/* File type icon pill */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${mime.iconBg} ${mime.iconColor}`}
        aria-hidden="true"
      >
        {mime.label}
      </div>

      {/* File info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {file.name}
        </p>
        <p className="text-xs text-gray-500">
          {formatBytes(file.size)}
        </p>
      </div>

      {/* Change / clear button */}
      <button
        onClick={onClear}
        disabled={isUploading}
        aria-label="Remove selected file"
        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-white hover:text-gray-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        {isUploading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isUploading ? 'Uploading' : 'Change'}
      </button>
    </div>
  );
}
