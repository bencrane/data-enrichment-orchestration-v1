"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { uploadVcCrunchbasePortfolios } from "@/app/actions";

export default function VcCrunchbaseUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    upload_id?: string;
    rows_inserted?: number;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        const reader = new FileReader();
        reader.onload = (event) => {
          setCsvContent(event.target?.result as string);
        };
        reader.readAsText(droppedFile);
        setResult(null);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!csvContent) return;

    setUploading(true);
    setResult(null);

    try {
      const response = await uploadVcCrunchbasePortfolios(csvContent);

      if (response.success) {
        setResult({
          success: true,
          message: `Successfully uploaded ${response.rows_inserted} records`,
          upload_id: response.upload_id,
          rows_inserted: response.rows_inserted,
        });
        setFile(null);
        setCsvContent("");
      } else {
        setResult({
          success: false,
          message: response.error || "Upload failed",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  // Count rows in CSV
  const rowCount = csvContent
    ? csvContent.split("\n").filter((line) => line.trim()).length - 1
    : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              Home
            </Link>
            <span>/</span>
            <Link href="/global-ingest" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              Global Ingest
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">VC Crunchbase Portfolios</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Upload VC Crunchbase Portfolios
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload CSV with flattened VC portfolio data
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-3xl">
        {/* Expected Headers */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Expected CSV Headers</h3>
          <code className="text-xs text-blue-700 dark:text-blue-400 block whitespace-pre-wrap">
            vc_name, vc_domain, website, name, operating_status, founded_date, full_description, short_description, city, state, country, number_employees, linkedin_url
          </code>
        </div>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {file ? (
            <div>
              <div className="text-4xl mb-2">📄</div>
              <p className="text-zinc-900 dark:text-zinc-100 font-medium">{file.name}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {rowCount.toLocaleString()} rows detected
              </p>
              <button
                onClick={() => {
                  setFile(null);
                  setCsvContent("");
                }}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-2">📁</div>
              <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                Drag and drop a CSV file here, or
              </p>
              <label className="cursor-pointer text-violet-600 hover:underline">
                browse
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Upload Button */}
        {file && (
          <div className="mt-6">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium rounded-lg transition-colors"
            >
              {uploading ? "Uploading..." : `Upload ${rowCount.toLocaleString()} Records`}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              result.success
                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            }`}
          >
            <p
              className={`font-medium ${
                result.success
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-red-800 dark:text-red-300"
              }`}
            >
              {result.success ? "✓ Upload Successful" : "✗ Upload Failed"}
            </p>
            <p
              className={`text-sm mt-1 ${
                result.success
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {result.message}
            </p>
            {result.upload_id && (
              <p className="text-xs text-zinc-500 mt-2">Upload ID: {result.upload_id}</p>
            )}
          </div>
        )}

        {/* Table Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Data uploads to: <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">raw.vc_crunchbase_portfolios</code>
          </p>
        </div>
      </main>
    </div>
  );
}


