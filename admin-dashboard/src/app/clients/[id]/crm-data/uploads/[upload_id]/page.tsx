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
  getCrmUploadDetails,
  getActivePipelineForClient,
  startCrmBatchFromUpload,
  Client,
  CrmUploadDetails,
  EnrichmentPipeline,
} from "@/app/actions";

const WORKSTREAM_SLUG = "crm_data";
const PAGE_SIZE = 25;

export default function CrmUploadInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const uploadId = params.upload_id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [upload, setUpload] = useState<CrmUploadDetails | null>(null);
  const [activePipeline, setActivePipeline] = useState<EnrichmentPipeline | null>(null);
  const [loading, setLoading] = useState(true);

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
        getCrmUploadDetails(clientId, uploadId, 500),
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

  async function handleLaunchBatch() {
    if (!activePipeline) {
      setLaunchError("No active pipeline configured");
      return;
    }

    setLaunching(true);
    setLaunchError(null);

    const result = await startCrmBatchFromUpload(
      clientId,
      uploadId,
      activePipeline.steps
    );

    if (result.success) {
      router.push(`/clients/${clientId}`);
    } else {
      setLaunchError(result.error || "Failed to launch batch");
      setLaunching(false);
    }
  }

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
          <Link href={`/clients/${clientId}/crm-data`}>
            <Button variant="outline">Back to CRM Data</Button>
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
                href={`/clients/${clientId}/crm-data/uploads`}
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
                  {client.company_name} / CRM Data / Uploads
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
              <p className="text-sm text-zinc-500 mb-1">Contacts</p>
              <p className="text-2xl font-bold">{upload.row_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-500 mb-1">Companies</p>
              <p className="text-2xl font-bold">{upload.company_count || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-500 mb-1">Uploaded</p>
              <p className="text-sm">{new Date(upload.uploaded_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Preview Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Data Preview
          </h2>
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
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Domain
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">
                      {row.full_name ||
                        `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
                        "—"}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                      {row.company_name || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {row.domain ? (
                        <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                          {row.domain}
                        </code>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                      {row.email || "—"}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {row.mobile_phone || "—"}
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

      {/* Launch Batch Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Launch Enrichment Batch</CardTitle>
              <CardDescription>
                Run enrichment pipeline on {upload.row_count} contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    No active pipeline configured for CRM Data.
                  </p>
                  <Link href={`/clients/${clientId}/crm-data/pipelines`}>
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
                    : `Launch Batch (${upload.row_count} contacts)`
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


