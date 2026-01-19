'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

export default function SalesNavImportCsvPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ rows: number; size: string } | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    // Get file size
    const sizeKb = (f.size / 1024).toFixed(1);
    const sizeMb = (f.size / 1024 / 1024).toFixed(2);
    const sizeStr = f.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

    // Count rows
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      setFileInfo({ rows: Math.max(0, lines.length - 1), size: sizeStr });
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const clearFile = () => {
    setFile(null);
    setFileInfo(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 text-sm text-zinc-500 mb-2">
            <Link href="/" className="hover:text-zinc-300">Dashboard</Link>
            <span>/</span>
            <Link href="/global-ingest" className="hover:text-zinc-300">Global Ingest</Link>
            <span>/</span>
            <span className="text-zinc-300">SalesNav CSV Import</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">SalesNav CSV Import</h1>
          <p className="text-sm text-zinc-500 mt-1">Import a SalesNav CSV file</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-rose-500 bg-rose-950/20'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto text-rose-500"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="m9 15 2 2 4-4" />
                </svg>
                <p className="font-medium text-white">{file.name}</p>
                {fileInfo && (
                  <p className="text-sm text-zinc-400">
                    {fileInfo.rows.toLocaleString()} rows • {fileInfo.size}
                  </p>
                )}
                <button
                  onClick={clearFile}
                  className="text-sm text-zinc-500 hover:text-zinc-300 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto text-zinc-500"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                <p className="text-zinc-400">
                  Drag and drop your CSV file here, or{' '}
                  <label className="text-rose-500 hover:text-rose-400 cursor-pointer underline">
                    browse
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </p>
                <p className="text-xs text-zinc-600">CSV files only</p>
              </div>
            )}
          </div>

          {/* File loaded - show info */}
          {file && fileInfo && (
            <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
              <h3 className="font-medium text-white mb-2">File Ready</h3>
              <div className="text-sm text-zinc-400 space-y-1">
                <p><strong>Name:</strong> {file.name}</p>
                <p><strong>Size:</strong> {fileInfo.size}</p>
                <p><strong>Rows:</strong> {fileInfo.rows.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

