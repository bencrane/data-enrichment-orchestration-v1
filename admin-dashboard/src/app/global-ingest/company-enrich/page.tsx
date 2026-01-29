"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Papa from "papaparse";

type QueueStatus = {
  total: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
};

type BatchResult = {
  event: string;
  batch_id: string;
  status: string;
  total: number;
  processed: number;
  errors: number;
  error_details: Array<{ domain: string; error: string }>;
  received_at: string;
};

export default function CompanyEnrichPage() {
  // File upload state
  const [domains, setDomains] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Queue state
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueResult, setQueueResult] = useState<{ success: boolean; domains_queued: number } | null>(null);

  // Status state
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Batch processing state
  const [batchSize, setBatchSize] = useState(300);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeBatch, setActiveBatch] = useState<{
    batch_id: string;
    domains_to_process: number;
    estimated_time_seconds: number;
  } | null>(null);

  // Results state
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch queue status
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/company-enrich");
      const data = await res.json();
      if (res.ok) {
        setQueueStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // Poll for batch results
  const pollBatchResult = useCallback(async (batchId: string) => {
    try {
      const res = await fetch(`/api/company-enrich/webhook?batch_id=${batchId}`);
      const data = await res.json();
      if (data.status === "completed") {
        setBatchResults((prev) => [data, ...prev]);
        setActiveBatch(null);
        fetchStatus(); // Refresh status after batch completes
        return true;
      }
    } catch (err) {
      console.error("Failed to poll batch result:", err);
    }
    return false;
  }, [fetchStatus]);

  // Fetch status on mount and set up polling
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Poll for active batch result
  useEffect(() => {
    if (!activeBatch) return;

    const poll = async () => {
      const completed = await pollBatchResult(activeBatch.batch_id);
      if (!completed) {
        setTimeout(poll, 5000); // Poll every 5s
      }
    };

    const timeout = setTimeout(poll, 5000);
    return () => clearTimeout(timeout);
  }, [activeBatch, pollBatchResult]);

  const processFile = useCallback((uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setQueueResult(null);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || [];
        const domainColumn = headers.find(
          (h) =>
            h.toLowerCase().includes("domain") ||
            h.toLowerCase().includes("website") ||
            h.toLowerCase().includes("url")
        ) || headers[0];

        if (domainColumn) {
          const extractedDomains = (result.data as Record<string, string>[])
            .map((row) => {
              let domain = (row[domainColumn] || "").trim().toLowerCase();
              domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
              return domain.includes(".") && domain.length > 3 ? domain : null;
            })
            .filter((d): d is string => !!d);

          setDomains([...new Set(extractedDomains)]);
        }
      },
    });
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile?.name.endsWith(".csv")) {
      processFile(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      processFile(uploadedFile);
    }
  };

  // Step 1: Queue domains
  const queueDomains = async () => {
    if (domains.length === 0) return;

    setIsQueueing(true);
    setError(null);

    try {
      const res = await fetch("/api/company-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", domains }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to queue domains");
      } else {
        setQueueResult(data);
        setDomains([]);
        setFile(null);
        fetchStatus(); // Refresh status
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue domains");
    } finally {
      setIsQueueing(false);
    }
  };

  // Step 2: Process batch
  const processBatch = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const webhookUrl = `${window.location.origin}/api/company-enrich/webhook`;

      const res = await fetch("/api/company-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          batch_size: batchSize,
          webhook_url: webhookUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start batch processing");
      } else {
        setActiveBatch(data);
        fetchStatus(); // Refresh status
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start batch processing");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearForm = () => {
    setDomains([]);
    setFile(null);
    setQueueResult(null);
    setError(null);
  };

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
            <span className="text-zinc-900 dark:text-zinc-100">Find Similar Companies</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Find Similar Companies
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload domains to queue, then process in batches via CompanyEnrich API
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Queue Status */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Queue Status
            </h2>
            <button
              onClick={fetchStatus}
              disabled={isLoadingStatus}
              className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 disabled:opacity-50"
            >
              {isLoadingStatus ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {queueStatus ? (
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{queueStatus.total}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Total</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{queueStatus.pending}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Pending</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{queueStatus.processing}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Processing</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{queueStatus.done}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Done</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{queueStatus.error}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Errors</p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400 text-center py-4">Loading status...</p>
          )}
        </div>

        {/* Step 1: Upload Domains */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Step 1: Upload Domains to Queue
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Upload a CSV file with domains to add them to the processing queue
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragActive
                ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {file ? (
              <div>
                <p className="text-zinc-900 dark:text-zinc-100 font-medium">{file.name}</p>
                <p className="text-sky-600 dark:text-sky-400 mt-1">{domains.length} unique domains found</p>
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">
                Drag & drop a CSV file here, or click to browse
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={clearForm}
              className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Clear
            </button>
            <button
              onClick={queueDomains}
              disabled={domains.length === 0 || isQueueing}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-zinc-400
                text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {isQueueing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding to queue...
                </>
              ) : (
                `Add to Queue (${domains.length} domains)`
              )}
            </button>
          </div>

          {queueResult && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200">
                Successfully queued {queueResult.domains_queued} domains
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Process Batch */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Step 2: Process Batch
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Trigger processing for a batch of pending domains
          </p>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Batch Size
              </label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md
                  bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              onClick={processBatch}
              disabled={isProcessing || !!activeBatch}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400
                text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Starting...
                </>
              ) : activeBatch ? (
                "Batch in progress..."
              ) : (
                "Process Batch"
              )}
            </button>
          </div>

          {/* Active Batch Indicator */}
          {activeBatch && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Processing {activeBatch.domains_to_process} domains...
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Batch ID: {activeBatch.batch_id}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Batch Results */}
        {batchResults.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Batch Results
            </h2>

            <div className="space-y-3">
              {batchResults.map((result) => (
                <div
                  key={result.batch_id}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Batch {result.batch_id.slice(0, 8)}...
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(result.received_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      {result.processed} success
                    </span>
                    {result.errors > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        {result.errors} errors
                      </span>
                    )}
                  </div>
                  {result.error_details && result.error_details.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200">
                        View error details
                      </summary>
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-1">
                        {result.error_details.slice(0, 5).map((err, idx) => (
                          <p key={idx}>
                            {err.domain}: {err.error}
                          </p>
                        ))}
                        {result.error_details.length > 5 && (
                          <p>...and {result.error_details.length - 5} more</p>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
