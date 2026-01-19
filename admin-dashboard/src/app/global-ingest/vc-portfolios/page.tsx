"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { getVcFirms, uploadVcPortfolioCompanies } from "@/app/actions";

type VcFirm = {
  id: string;
  name: string;
  domain: string;
};

export default function VcPortfoliosUploadPage() {
  const [vcFirms, setVcFirms] = useState<VcFirm[]>([]);
  const [selectedVcId, setSelectedVcId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    upload_id?: string;
    rows_inserted?: number;
    error?: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    getVcFirms().then(setVcFirms);
  }, []);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      const lines = text.split("\n").filter((line) => line.trim());
      setRowCount(Math.max(0, lines.length - 1));
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        setFile(droppedFile);
        parseFile(droppedFile);
        setUploadResult(null);
      }
    },
    [parseFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        parseFile(selectedFile);
        setUploadResult(null);
      }
    },
    [parseFile]
  );

  const handleUpload = async () => {
    if (!csvContent || !selectedVcId) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadVcPortfolioCompanies(csvContent, selectedVcId);

      setUploadResult({
        success: result.success,
        upload_id: result.upload_id,
        rows_inserted: result.rows_inserted,
        error: result.error,
      });

      if (result.success) {
        setFile(null);
        setCsvContent(null);
        setRowCount(0);
      }
    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const selectedVc = vcFirms.find((vc) => vc.id === selectedVcId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              Home
            </Link>
            <span>/</span>
            <Link
              href="/global-ingest"
              className="hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Global Ingest
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">VC Portfolios</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            VC Portfolio Scrapes
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload Crunchbase VC portfolio company exports
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Upload Portfolio Export</CardTitle>
            <CardDescription>
              Select the VC firm and upload the Crunchbase export CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* VC Selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                VC Firm <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVcId}
                onChange={(e) => setSelectedVcId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select a VC firm...</option>
                {vcFirms.map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    {vc.name} ({vc.domain})
                  </option>
                ))}
              </select>
            </div>

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-2">
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
                    className="mx-auto text-violet-600"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="m9 15 2 2 4-4" />
                  </svg>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {file.name}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {rowCount} companies found
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setCsvContent(null);
                      setRowCount(0);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
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
                    className="mx-auto text-zinc-400"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Drag and drop your file here, or{" "}
                    <label className="text-violet-600 hover:text-violet-700 cursor-pointer underline">
                      browse
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-zinc-400">
                    Crunchbase portfolio export CSV
                  </p>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!csvContent || !selectedVcId || uploading}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {uploading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Uploading...
                </>
              ) : (
                `Upload ${rowCount > 0 ? `${rowCount} Companies` : "File"}${selectedVc ? ` to ${selectedVc.name}` : ""}`
              )}
            </Button>

            {/* Result Message */}
            {uploadResult && (
              <div
                className={`p-4 rounded-md ${
                  uploadResult.success
                    ? "bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800"
                    : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                }`}
              >
                {uploadResult.success ? (
                  <div className="flex items-start gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-violet-600 mt-0.5"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <div>
                      <p className="font-medium text-violet-800 dark:text-violet-200">
                        Upload Successful
                      </p>
                      <p className="text-sm text-violet-700 dark:text-violet-300">
                        {uploadResult.rows_inserted} companies inserted
                      </p>
                      <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 font-mono">
                        Upload ID: {uploadResult.upload_id}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-red-600 mt-0.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" x2="12" y1="8" y2="12" />
                      <line x1="12" x2="12.01" y1="16" y2="16" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">
                        Upload Failed
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {uploadResult.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}



