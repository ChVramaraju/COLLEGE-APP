import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import type { JSX, DragEvent, KeyboardEvent } from 'react';
import { ALLOWED_TYPES_DISPLAY } from '@/types/facultyNotes';
import { FILE_INPUT_ACCEPT } from '@/utils/fileValidation';

interface Props {
  isUploading: boolean;
  onFileDrop:  (file: File) => void;
}

export default function UploadDropzone({ isUploading, onFileDrop }: Props): JSX.Element {
  const inputRef     = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Drag handlers ─────────────────────────────────────────
  // Use a counter to avoid false dragLeave events triggered by
  // the cursor moving over child elements inside the zone.
  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCountRef.current += 1;
    setIsDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setIsDragOver(false);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDragOver(false);
    if (isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) onFileDrop(file);
  };

  // ── Click / keyboard ──────────────────────────────────────
  const openPicker = () => {
    if (!isUploading) inputRef.current?.click();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  };

  const onFileChange = () => {
    const file = inputRef.current?.files?.[0];
    if (file) onFileDrop(file);
    // Reset input so the same file can be re-selected after clearing
    if (inputRef.current) inputRef.current.value = '';
  };

  const disabled = isUploading;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="File upload zone. Click or drag a file here to upload."
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`
        relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
        px-8 py-12 text-center transition-all duration-150 outline-none
        ${disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
          : isDragOver
            ? 'cursor-copy border-indigo-500 bg-indigo-50'
            : 'cursor-pointer border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2'
        }
      `}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        onChange={onFileChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Icon */}
      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
          isDragOver ? 'bg-indigo-100' : 'bg-indigo-50'
        }`}
        aria-hidden="true"
      >
        <UploadCloud
          className={`h-7 w-7 transition-colors ${
            isDragOver ? 'text-indigo-600' : 'text-indigo-400'
          }`}
        />
      </div>

      {/* Headline */}
      <p className="mb-1 text-sm font-semibold text-gray-900">
        {isDragOver ? 'Drop your file here' : 'Drag & drop your file here'}
      </p>

      {/* Sub-text */}
      <p className="mb-4 text-xs text-gray-500">
        {disabled ? 'Upload in progress…' : 'or click to browse your files'}
      </p>

      {/* Accepted types */}
      <p className="text-xs text-gray-400">
        Accepted: {ALLOWED_TYPES_DISPLAY}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">
        Maximum size: 20 MB · Minimum size: 1 KB
      </p>
    </div>
  );
}
