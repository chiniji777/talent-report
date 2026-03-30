"use client";

import { useState, useCallback } from "react";
import { Upload, File, X } from "lucide-react";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export function FileDropzone({
  onFiles,
  accept = ".csv",
  multiple = true,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      setFiles(dropped);
      onFiles(dropped);
    },
    [onFiles]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    onFiles(selected);
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFiles(next);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl p-10 text-center transition-all duration-300 ${
          isDragging
            ? "border-blue-500/40 scale-[1.01]"
            : "border-slate-600/30 hover:border-slate-500/30"
        }`}
        style={{
          border: isDragging ? "2px dashed rgba(59, 130, 246, 0.4)" : "2px dashed rgba(148, 163, 184, 0.15)",
          background: isDragging
            ? "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.06) 0%, transparent 70%)"
            : "radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.3) 0%, transparent 70%)",
        }}
      >
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{
          background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)",
        }}>
          <Upload className={`w-6 h-6 transition-colors ${isDragging ? "text-blue-400" : "text-slate-400"}`} />
        </div>
        <p className="text-slate-300 mb-1 font-medium">ลากไฟล์มาวางที่นี่</p>
        <p className="text-slate-500 text-sm mb-4">หรือ</p>
        <label className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl cursor-pointer transition-all text-sm font-medium btn-press hover:shadow-lg" style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
          boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)"
        }}>
          <Upload className="w-4 h-4" />
          เลือกไฟล์
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleChange}
            className="hidden"
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 glass-card-sm px-4 py-3 animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)"
              }}>
                <File className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm text-slate-300 truncate flex-1">
                {file.name}
              </span>
              <span className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={() => removeFile(i)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
