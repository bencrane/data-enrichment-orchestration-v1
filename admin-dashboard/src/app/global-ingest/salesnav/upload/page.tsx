"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { uploadSalesNavToWarehouse } from "@/app/actions";

interface SavedQuery {
  id: string;
  koolkit_title: string | null;
  salesnav_search_query: string | null;
  description: string | null;
  salesnav_url: string;
  created_at: string;
  updated_at: string;
}

interface FilterCriteria {
  // Company
  currentCompany?: string;
  companyHeadcount?: string;
  pastCompany?: string;
  companyType?: string;
  companyHeadquartersLocation?: string;
  // Role
  function?: string;
  currentJobTitle?: string;
  seniorityLevel?: string;
  pastJobTitle?: string;
  yearsInCurrentCompany?: string;
  yearsInCurrentPosition?: string;
  // Personal
  geography?: string;
  industry?: string;
  firstName?: string;
  lastName?: string;
  profileLanguage?: string;
  yearsOfExperience?: string;
  groups?: string;
  school?: string;
  // Buyer intent
  categoryInterest?: string;
  followingYourCompany?: string;
  viewedYourProfileRecently?: string;
  // Best path in
  connection?: string;
  connectionsOf?: string;
  pastColleague?: string;
  sharedExperiences?: string;
  // Recent updates
  changedJobs?: string;
  postedOnLinkedIn?: string;
  // Workflow
  persona?: string;
  accountLists?: string;
  leadLists?: string;
  peopleInCRM?: string;
  peopleYouInteractedWith?: string;
  savedLeadsAndAccounts?: string;
  // URL
  linkedinSalesNavUrl?: string;
}

export default function SalesNavUploadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">Loading...</div>}>
      <SalesNavUploadContent />
    </Suspense>
  );
}

function SalesNavUploadContent() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [exportTitle, setExportTitle] = useState("");
  const [exportTimestamp, setExportTimestamp] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});

  // Saved queries state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string>("");
  const [loadingQueries, setLoadingQueries] = useState(true);

  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    queued?: boolean;
    estimated_rows?: number;
    upload_id?: string;
    error?: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fetch saved queries on mount
  useEffect(() => {
    async function fetchSavedQueries() {
      try {
        const res = await fetch("/api/salesnav-settings");
        if (res.ok) {
          const data = await res.json();
          setSavedQueries(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch saved queries:", error);
      } finally {
        setLoadingQueries(false);
      }
    }
    fetchSavedQueries();
  }, []);

  // Parse filter criteria from URL on mount
  useEffect(() => {
    const filtersParam = searchParams.get("filters");
    if (filtersParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filtersParam));
        setFilterCriteria(parsed);
      } catch (e) {
        console.error("Failed to parse filter criteria:", e);
      }
    }
  }, [searchParams]);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      // Count rows (subtract 1 for header)
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
    if (!csvContent) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadSalesNavToWarehouse(
        csvContent,
        exportTitle || null,
        exportTimestamp || null,
        notes || null,
        selectedQueryId || null
      );

      setUploadResult({
        success: result.success,
        upload_id: result.upload_id,
        estimated_rows: result.rows_inserted,
        error: result.error,
      });

      if (result.success) {
        // Reset form
        setFile(null);
        setCsvContent(null);
        setRowCount(0);
        setExportTitle("");
        setExportTimestamp("");
        setNotes("");
        setSelectedQueryId("");
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

  // Count how many filters are set
  const filterCount = Object.values(filterCriteria).filter(v => v && v.trim()).length;

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
            <Link
              href="/global-ingest/salesnav"
              className="hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              SalesNav KoolKit
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Upload</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Upload Export File
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload your LinkedIn Sales Navigator export file
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        {/* Filter Summary */}
        {filterCount > 0 && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  {filterCount} filter{filterCount !== 1 ? 's' : ''} configured
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Filter criteria will be saved with this upload
                </p>
              </div>
              <Link
                href="/global-ingest/salesnav"
                className="text-sm text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                Edit filters
              </Link>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Upload Export File</CardTitle>
            <CardDescription>
              Drop your SalesNav export TSV/CSV file below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Saved Query Selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Link to Saved Query <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedQueryId}
                onChange={(e) => setSelectedQueryId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={loadingQueries}
              >
                <option value="">
                  {loadingQueries ? "Loading..." : "-- Select a saved query --"}
                </option>
                {savedQueries.map((query) => (
                  <option key={query.id} value={query.id}>
                    {query.koolkit_title || query.salesnav_search_query || query.description || `Query from ${new Date(query.created_at).toLocaleDateString()}`}
                  </option>
                ))}
              </select>
              {selectedQueryId && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Upload will be linked to this saved query
                </p>
              )}
              {savedQueries.length === 0 && !loadingQueries && (
                <p className="text-xs text-zinc-400 mt-1">
                  No saved queries yet.{" "}
                  <Link href="/global-ingest/salesnav/save-settings" className="text-emerald-600 hover:underline">
                    Create one first
                  </Link>
                </p>
              )}
            </div>

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
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
                    className="mx-auto text-emerald-600"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="m9 15 2 2 4-4" />
                  </svg>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {file.name}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {rowCount} records found
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
                    <label className="text-emerald-600 hover:text-emerald-700 cursor-pointer underline">
                      browse
                      <input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-zinc-400">
                    Accepts TSV/CSV files with SalesNav headers
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Export Title
                </label>
                <input
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  placeholder="e.g., Q1 2026 Energy Sector Leads"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Export Timestamp
                </label>
                <input
                  type="text"
                  value={exportTimestamp}
                  onChange={(e) => setExportTimestamp(e.target.value)}
                  placeholder="e.g., 12/26/2025, 5:55 PM"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Paste the timestamp from SalesNav (e.g., 12/26/2025, 5:55 PM)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes{" "}
                  <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional context about this export..."
                  rows={3}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!csvContent || !selectedQueryId || uploading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
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
                `Upload ${rowCount > 0 ? `${rowCount} Records` : "File"}`
              )}
            </Button>

            {/* Result Message */}
            {uploadResult && (
              <div
                className={`p-4 rounded-md ${
                  uploadResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
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
                      className="text-emerald-600 mt-0.5"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <div>
                      <p className="font-medium text-emerald-800 dark:text-emerald-200">
                        Upload Successful
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        {uploadResult.estimated_rows} records inserted
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
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
