"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  getClientById,
  getUploadDetails,
  getActivePipelineForClient,
  startBatchFromUpload,
  startBatchFromSelectedRows,
  Client,
  UploadDetails,
  EnrichmentPipeline,
} from "@/app/actions";

// Workstream slug for apollo uploads
const WORKSTREAM_SLUG = "apollo_scrape";

const PAGE_SIZE = 25;

export default function UploadInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const uploadId = params.upload_id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [upload, setUpload] = useState<UploadDetails | null>(null);
  const [activePipeline, setActivePipeline] = useState<EnrichmentPipeline | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Launch modal state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, uploadData, pipelineData] = await Promise.all([
        getClientById(clientId),
        getUploadDetails(clientId, uploadId, 500), // Fetch more rows for pagination
        getActivePipelineForClient(WORKSTREAM_SLUG, clientId),
      ]);
      setClient(clientData);
      setUpload(uploadData);
      setActivePipeline(pipelineData);
      setLoading(false);
    }
    fetchData();
  }, [clientId, uploadId]);

  // Pagination calculations
  const totalPages = upload ? Math.ceil(upload.rows.length / PAGE_SIZE) : 1;
  const paginatedRows = useMemo(() => {
    if (!upload) return [];
    const start = (currentPage - 1) * PAGE_SIZE;
    return upload.rows.slice(start, start + PAGE_SIZE);
  }, [upload, currentPage]);

  // Selection helpers
  const allCurrentPageSelected = paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedRowIds.has(row.id));
  const someCurrentPageSelected = paginatedRows.some((row) => selectedRowIds.has(row.id));
  const allRowsSelected = upload && upload.rows.length > 0 &&
    upload.rows.every((row) => selectedRowIds.has(row.id));

  function toggleRowSelection(rowId: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function toggleCurrentPageSelection() {
    if (allCurrentPageSelected) {
      // Deselect all on current page
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        paginatedRows.forEach((row) => next.delete(row.id));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        paginatedRows.forEach((row) => next.add(row.id));
        return next;
      });
    }
  }

  function selectAllRows() {
    if (!upload) return;
    setSelectedRowIds(new Set(upload.rows.map((row) => row.id)));
  }

  function clearSelection() {
    setSelectedRowIds(new Set());
  }

  async function handleLaunchBatch() {
    if (!activePipeline) {
      setLaunchError("No active pipeline configured");
      return;
    }

    setLaunching(true);
    setLaunchError(null);

    let result;
    if (selectedRowIds.size > 0) {
      // Launch with selected rows only
      result = await startBatchFromSelectedRows(
        clientId,
        uploadId,
        Array.from(selectedRowIds),
        activePipeline.steps,
        WORKSTREAM_SLUG
      );
    } else {
      // Launch with all rows
      result = await startBatchFromUpload(clientId, uploadId, activePipeline.steps, WORKSTREAM_SLUG);
    }

    if (result.success) {
      router.push(`/clients/${clientId}`);
    } else {
      setLaunchError(result.error || "Failed to launch batch");
      setLaunching(false);
    }
  }

  const itemCountForLaunch = selectedRowIds.size > 0 ? selectedRowIds.size : (upload?.row_count || 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!client || !upload) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Upload not found</p>
          <Link href={`/clients/${clientId}`}>
            <Button variant="outline">Back to Client</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/clients/${clientId}`}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
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
                >
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
              </Link>
              <div>
                <p className="text-sm text-zinc-500">
                  {client.company_name} / Uploads
                </p>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Upload Inspector
                </h1>
              </div>
            </div>
            <Button onClick={() => setShowLaunchModal(true)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              Launch Enrichment Batch
              {selectedRowIds.size > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                  {selectedRowIds.size}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Upload Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-500 mb-1">Upload ID</p>
              <p className="font-mono text-sm">{upload.upload_id.slice(0, 8)}...</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-500 mb-1">Total Rows</p>
              <p className="text-2xl font-bold">{upload.row_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-500 mb-1">Selected</p>
              <p className="text-2xl font-bold">
                {selectedRowIds.size > 0 ? selectedRowIds.size : "All"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-500 mb-1">Uploaded</p>
              <p className="text-sm">{new Date(upload.uploaded_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Data Preview
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllRows}
                disabled={allRowsSelected || false}
              >
                Select All ({upload.rows.length})
              </Button>
              {selectedRowIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-zinc-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, upload.rows.length)} of {upload.rows.length} rows
          </p>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="w-12 py-3 px-4">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
                      }}
                      onChange={toggleCurrentPageSelection}
                      className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Full Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Website
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Country
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      selectedRowIds.has(row.id) ? "bg-blue-50 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                        className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">
                      {row.full_name ||
                        `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
                        "—"}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                      {row.company_name || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {row.company_website || row.company_website_short ? (
                        <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                          {row.company_website || row.company_website_short}
                        </code>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                      {row.title || "—"}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {row.lead_country || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-zinc-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Launch Batch Modal - Shows Active Pipeline */}
      {showLaunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Launch Enrichment Batch</CardTitle>
              <CardDescription>
                {selectedRowIds.size > 0
                  ? `Run pipeline on ${selectedRowIds.size} selected rows`
                  : `Run pipeline on all ${upload.row_count} rows`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selection Summary */}
              {selectedRowIds.size > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {selectedRowIds.size} of {upload.row_count} rows selected
                  </p>
                </div>
              )}

              {!activePipeline ? (
                <div className="py-8 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600"
                  >
                    <path d="M3 12h4l3 9 4-18 3 9h4" />
                  </svg>
                  <p className="text-sm text-zinc-500 mb-4">
                    No active pipeline configured for this workstream.
                  </p>
                  <Link href={`/clients/${clientId}/apollo-ingest/pipelines`}>
                    <Button variant="outline" size="sm">
                      Configure Pipeline
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Active Pipeline Display */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Active Pipeline
                    </label>
                    <div className="p-4 rounded-md border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {activePipeline.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Active
                        </span>
                      </div>
                      {activePipeline.description && (
                        <p className="text-xs text-zinc-500 mb-3">
                          {activePipeline.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        {activePipeline.steps.map((step, i) => (
                          <span key={i} className="inline-flex items-center">
                            <span className="px-2 py-1 rounded text-xs font-mono bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300">
                              {step}
                            </span>
                            {i < activePipeline.steps.length - 1 && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mx-1 text-zinc-400"
                              >
                                <path d="m9 18 6-6-6-6" />
                              </svg>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {launchError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300">{launchError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleLaunchBatch}
                  disabled={launching || !activePipeline}
                  className="flex-1"
                >
                  {launching
                    ? "Launching..."
                    : `Launch Batch (${itemCountForLaunch} items)`
                  }
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLaunchModal(false);
                    setLaunchError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
