"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClientById,
  getApolloUploads,
  uploadApolloData,
  getWorkflows,
  getClientPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
  Client,
  ApolloUpload,
  ApolloRow,
  EnrichmentWorkflow,
  EnrichmentPipeline,
} from "@/app/actions";

// Apollo CSV header to snake_case mapping
const HEADER_MAP: Record<string, keyof ApolloRow> = {
  "first name": "first_name",
  "last name": "last_name",
  "full name": "full_name",
  "title": "title",
  "headline": "headline",
  "seniority": "seniority",
  "email": "email",
  "email status": "email_status",
  "linkedin url": "linkedin_url",
  "person linkedin url": "linkedin_url",
  "linkedin link": "linkedin_url",
  "is likely to engage": "is_likely_to_engage",
  "city": "lead_city",
  "state": "lead_state",
  "country": "lead_country",
  "lead city": "lead_city",
  "lead state": "lead_state",
  "lead country": "lead_country",
  "company": "company_name",
  "company name": "company_name",
  "industry": "industry",
  "# employees": "employee_count",
  "employees": "employee_count",
  "employee count": "employee_count",
  "departments": "departments",
  "subdepartments": "subdepartments",
  "functions": "functions",
  "website": "company_website",
  "company website": "company_website",
  "company url": "company_website",
  "url": "company_website",
  "company website full": "company_website",
  "domain": "company_website_short",
  "company domain": "company_website_short",
  "company website short": "company_website_short",
  "blog url": "company_blog_url",
  "company blog url": "company_blog_url",
  "company blog link": "company_blog_url",
  "twitter url": "company_twitter_url",
  "company twitter url": "company_twitter_url",
  "company twitter link": "company_twitter_url",
  "facebook url": "company_facebook_url",
  "company facebook url": "company_facebook_url",
  "company facebook link": "company_facebook_url",
  "linkedin url (company)": "company_linkedin_url",
  "company linkedin url": "company_linkedin_url",
  "company linkedin link": "company_linkedin_url",
  "phone": "company_phone",
  "company phone": "company_phone",
  "company phone number": "company_phone",
  "street": "company_street",
  "company street": "company_street",
  "company city": "company_city",
  "company state": "company_state",
  "company country": "company_country",
  "postal code": "company_postal_code",
  "company postal code": "company_postal_code",
  "address": "company_address",
  "company address": "company_address",
  "annual revenue": "company_annual_revenue",
  "company annual revenue": "company_annual_revenue",
  "market cap": "company_market_cap",
  "company market cap": "company_market_cap",
  "total funding": "company_total_funding",
  "company total funding": "company_total_funding",
  "latest funding": "company_latest_funding_type",
  "latest funding type": "company_latest_funding_type",
  "latest funding amount": "company_latest_funding_amount",
  "last raised at": "company_last_funding_date",
  "last fund raised at": "company_last_funding_date",
  "keywords": "company_keywords",
  "company keywords": "company_keywords",
  "technologies": "company_technologies",
  "company technologies": "company_technologies",
  "short description": "company_short_description",
  "company short description": "company_short_description",
  "seo description": "company_seo_description",
  "company seo description": "company_seo_description",
  "retail locations": "number_of_retail_locations",
  "# retail locations": "number_of_retail_locations",
  "number of retail locations": "number_of_retail_locations",
  "founded year": "company_founded_year",
  "company founded year": "company_founded_year",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

function mapCsvRow(row: Record<string, string>): ApolloRow {
  const mapped: ApolloRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = HEADER_MAP[normalizedKey];
    if (mappedKey && value) {
      mapped[mappedKey] = value;
    }
  }
  return mapped;
}

export default function ClientDashboard() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [uploads, setUploads] = useState<ApolloUpload[]>([]);
  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [savedPipelines, setSavedPipelines] = useState<EnrichmentPipeline[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadType, setUploadType] = useState<string>("apollo");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<ApolloRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  // Pipeline builder state
  const [showPipelineBuilder, setShowPipelineBuilder] = useState(false);
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [savingPipeline, setSavingPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Past uploads state
  const [showPastUploads, setShowPastUploads] = useState(false);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  async function fetchData() {
    setLoading(true);
    const [clientData, uploadsData, workflowsData, pipelinesData] = await Promise.all([
      getClientById(clientId),
      getApolloUploads(clientId),
      getWorkflows(),
      getClientPipelines(clientId),
    ]);
    setClient(clientData);
    setUploads(uploadsData);
    setWorkflows(workflowsData);
    setSavedPipelines(pipelinesData);
    setLoading(false);
  }

  // Pipeline builder functions
  function addWorkflowToPipeline(slug: string) {
    if (pipeline.includes(slug)) return;
    setPipeline((prev) => [...prev, slug]);
  }

  function removeWorkflowFromPipeline(index: number) {
    setPipeline((prev) => prev.filter((_, i) => i !== index));
  }

  function moveWorkflowUp(index: number) {
    if (index === 0) return;
    setPipeline((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveWorkflowDown(index: number) {
    if (index >= pipeline.length - 1) return;
    setPipeline((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function getWorkflowBySlug(slug: string) {
    return workflows.find((w) => w.slug === slug);
  }

  // Pipeline save/edit functions
  async function handleSavePipeline() {
    if (pipeline.length === 0) {
      setPipelineError("Add at least one workflow to the pipeline");
      return;
    }
    if (!pipelineName.trim()) {
      setPipelineError("Pipeline name is required");
      return;
    }

    setSavingPipeline(true);
    setPipelineError(null);

    if (editingPipelineId) {
      // Update existing pipeline
      const result = await updatePipeline(editingPipelineId, {
        name: pipelineName.trim(),
        description: pipelineDescription.trim() || undefined,
        steps: pipeline,
      });
      if (result.success) {
        const newPipelines = await getClientPipelines(clientId);
        setSavedPipelines(newPipelines);
        resetPipelineForm();
      } else {
        setPipelineError(result.error || "Failed to update pipeline");
      }
    } else {
      // Create new pipeline
      const result = await createPipeline(clientId, {
        name: pipelineName.trim(),
        description: pipelineDescription.trim() || undefined,
        steps: pipeline,
      });
      if (result.success) {
        const newPipelines = await getClientPipelines(clientId);
        setSavedPipelines(newPipelines);
        resetPipelineForm();
      } else {
        setPipelineError(result.error || "Failed to save pipeline");
      }
    }

    setSavingPipeline(false);
  }

  function loadPipelineForEdit(pipelineData: EnrichmentPipeline) {
    setPipeline(pipelineData.steps);
    setPipelineName(pipelineData.name);
    setPipelineDescription(pipelineData.description || "");
    setEditingPipelineId(pipelineData.id);
    setPipelineError(null);
  }

  function resetPipelineForm() {
    setPipeline([]);
    setPipelineName("");
    setPipelineDescription("");
    setEditingPipelineId(null);
    setPipelineError(null);
  }

  async function handleDeletePipeline(pipelineId: string) {
    if (!confirm("Are you sure you want to delete this pipeline?")) return;

    const result = await deletePipeline(pipelineId);
    if (result.success) {
      const newPipelines = await getClientPipelines(clientId);
      setSavedPipelines(newPipelines);
      if (editingPipelineId === pipelineId) {
        resetPipelineForm();
      }
    }
  }

  // Upload handlers
  const handleFile = useCallback((file: File) => {
    setParseError(null);
    setParsedRows([]);
    setUploadResult(null);

    if (!file.name.endsWith(".csv")) {
      setParseError("Please upload a CSV file");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ",",
      complete: (result) => {
        // Filter out delimiter detection warnings - we explicitly set comma
        const criticalErrors = result.errors.filter(
          (e) => !e.message.includes("auto-detect delimiting character")
        );
        if (criticalErrors.length > 0) {
          setParseError(`Parse error: ${criticalErrors[0].message}`);
          return;
        }

        const rows = result.data.map(mapCsvRow);
        const validRows = rows.filter((r) => r.email || r.company_name);

        if (validRows.length === 0) {
          setParseError("No valid rows found. Ensure CSV has email or company_name columns.");
          return;
        }

        setParsedRows(validRows);
      },
      error: (error) => {
        setParseError(`Failed to parse CSV: ${error.message}`);
      },
    });
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  async function handleUpload() {
    if (parsedRows.length === 0) return;

    setUploading(true);
    setUploadResult(null);

    const uploadId = crypto.randomUUID();
    const result = await uploadApolloData(clientId, uploadId, parsedRows);

    if (result.success) {
      setUploadResult({
        success: true,
        message: `Upload Success: ${result.rowCount} rows added.`,
      });
      setParsedRows([]);
      const newUploads = await getApolloUploads(clientId);
      setUploads(newUploads);
    } else {
      setUploadResult({
        success: false,
        message: `Upload Failed: ${result.error}`,
      });
    }

    setUploading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-red-500">Client not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/clients"
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
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {client.company_name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_domain}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Upload Zone - Collapsible */}
              <Card className={!showUploadForm ? "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors" : "md:col-span-2 lg:col-span-2"}>
                {!showUploadForm ? (
                  /* Collapsed State - Click to Expand */
                  <div
                    onClick={() => setShowUploadForm(true)}
                    className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-blue-600 dark:text-blue-400"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" x2="12" y1="3" y2="15" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Upload Files
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      Upload a new CSV file
                    </p>
                  </div>
                ) : (
                  /* Expanded State - Full Upload Form */
                  <>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle>Upload Files</CardTitle>
                        <CardDescription>
                          Select the type of data and upload a CSV file
                        </CardDescription>
                      </div>
                      <button
                        onClick={() => {
                          setShowUploadForm(false);
                          setParsedRows([]);
                          setParseError(null);
                          setUploadResult(null);
                        }}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        title="Close"
                      >
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
                          className="text-zinc-500"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Upload Type Selector */}
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Upload Type
                        </label>
                        <Select value={uploadType} onValueChange={setUploadType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select upload type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="apollo">Upload Scraped Apollo.io</SelectItem>
                            <SelectItem value="companies" disabled>
                              Upload Customer Companies (Coming Soon)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Drag & Drop Zone */}
                      <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                          dragActive
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                        }`}
                        onClick={() => document.getElementById("file-input")?.click()}
                      >
                        <input
                          id="file-input"
                          type="file"
                          accept=".csv"
                          onChange={handleFileInput}
                          className="hidden"
                        />
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
                          className="mx-auto mb-4 text-zinc-400"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" x2="12" y1="3" y2="15" />
                        </svg>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {uploadType === "apollo" ? "Drop your Apollo CSV here" : "Drop your CSV here"}
                        </p>
                        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                          or click to browse
                        </p>
                      </div>

                      {parseError && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                          <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
                        </div>
                      )}

                      {parsedRows.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              Ready to upload: {parsedRows.length} rows
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setParsedRows([]);
                                setParseError(null);
                                setUploadResult(null);
                                // Reset file input
                                const fileInput = document.getElementById("file-input") as HTMLInputElement;
                                if (fileInput) fileInput.value = "";
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Clear file"
                            >
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
                              >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                              </svg>
                              Clear
                            </button>
                          </div>
                          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-md max-h-48">
                            <table className="w-full text-xs">
                              <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                                <tr>
                                  <th className="text-left py-2 px-3">Email</th>
                                  <th className="text-left py-2 px-3">Name</th>
                                  <th className="text-left py-2 px-3">Company</th>
                                  <th className="text-left py-2 px-3">Title</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedRows.slice(0, 5).map((row, i) => (
                                  <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                                    <td className="py-2 px-3 font-mono">{row.email || "-"}</td>
                                    <td className="py-2 px-3">
                                      {row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim() || "-"}
                                    </td>
                                    <td className="py-2 px-3">{row.company_name || "-"}</td>
                                    <td className="py-2 px-3">{row.title || "-"}</td>
                                  </tr>
                                ))}
                                {parsedRows.length > 5 && (
                                  <tr className="border-t border-zinc-200 dark:border-zinc-700">
                                    <td colSpan={4} className="py-2 px-3 text-zinc-500 text-center">
                                      ... and {parsedRows.length - 5} more rows
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          <Button onClick={handleUpload} disabled={uploading} className="w-full">
                            {uploading ? "Uploading..." : `Upload ${parsedRows.length} Rows`}
                          </Button>
                        </div>
                      )}

                      {uploadResult && (
                        <div
                          className={`p-3 rounded-md ${
                            uploadResult.success
                              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                          }`}
                        >
                          <p
                            className={`text-sm ${
                              uploadResult.success
                                ? "text-green-700 dark:text-green-300"
                                : "text-red-700 dark:text-red-300"
                            }`}
                          >
                            {uploadResult.message}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>

              {/* Past Uploads - Collapsible */}
              <Card className={!showPastUploads ? "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors" : "md:col-span-2 lg:col-span-2"}>
                {!showPastUploads ? (
                  /* Collapsed State */
                  <div
                    onClick={() => setShowPastUploads(true)}
                    className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-600 dark:text-green-400"
                      >
                        <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5 5-5-5M12 12.8V2.5" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Past Uploads
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {uploads.length === 0
                        ? "No uploads yet"
                        : `${uploads.length} upload${uploads.length !== 1 ? "s" : ""}`
                      }
                    </p>
                  </div>
                ) : (
                  /* Expanded State */
                  <>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle>Past Uploads</CardTitle>
                        <CardDescription>Previous Apollo CSV uploads</CardDescription>
                      </div>
                      <button
                        onClick={() => setShowPastUploads(false)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        title="Close"
                      >
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
                          className="text-zinc-500"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </CardHeader>
                    <CardContent>
                      {uploads.length === 0 ? (
                        <p className="text-zinc-500 py-8 text-center">No uploads yet</p>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {uploads.map((upload) => (
                            <Link
                              key={upload.id}
                              href={`/clients/${clientId}/uploads/${upload.upload_id}`}
                              className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                              <div>
                                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                  {upload.upload_id.slice(0, 8)}...
                                </p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                  {upload.row_count} rows
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-zinc-500">
                                  {new Date(upload.uploaded_at).toLocaleString()}
                                </p>
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
                                  className="text-zinc-400"
                                >
                                  <path d="m9 18 6-6-6-6" />
                                </svg>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>

              {/* Enrichment Workflow Pipeline - Collapsible */}
              <Card className={!showPipelineBuilder ? "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors" : "md:col-span-2 lg:col-span-3"}>
                {!showPipelineBuilder ? (
                  /* Collapsed State */
                  <div
                    onClick={() => setShowPipelineBuilder(true)}
                    className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-purple-600 dark:text-purple-400"
                      >
                        <path d="M3 12h4l3 9 4-18 3 9h4" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Enrichment Pipelines
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {savedPipelines.length === 0
                        ? "Create workflow sequences"
                        : `${savedPipelines.length} saved pipeline${savedPipelines.length !== 1 ? "s" : ""}`
                      }
                    </p>
                  </div>
                ) : (
                  /* Expanded State - Pipeline Manager */
                  <>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle>{editingPipelineId ? "Edit Pipeline" : "Create Pipeline"}</CardTitle>
                        <CardDescription>
                          Define and save workflow sequences for data enrichment
                        </CardDescription>
                      </div>
                      <button
                        onClick={() => {
                          setShowPipelineBuilder(false);
                          resetPipelineForm();
                        }}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        title="Close"
                      >
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
                          className="text-zinc-500"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </CardHeader>
                    <CardContent>
                      {/* Saved Pipelines List */}
                      {savedPipelines.length > 0 && !editingPipelineId && (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                            Saved Pipelines
                          </h4>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {savedPipelines.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">
                                    {p.name}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {p.steps.length} step{p.steps.length !== 1 ? "s" : ""}: {p.steps.join(" → ")}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <button
                                    onClick={() => loadPipelineForEdit(p)}
                                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    title="Edit"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeletePipeline(p.id)}
                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-zinc-500 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                            <p className="text-xs text-zinc-500 text-center">
                              Or create a new pipeline below
                            </p>
                          </div>
                        </div>
                      )}

                      {workflows.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-8 text-center">
                          No workflows registered.{" "}
                          <Link href="/workflows" className="text-blue-600 hover:underline">
                            Create one first
                          </Link>
                        </p>
                      ) : (
                        <>
                          {/* Pipeline Name & Description */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Pipeline Name *
                              </label>
                              <input
                                type="text"
                                value={pipelineName}
                                onChange={(e) => setPipelineName(e.target.value)}
                                placeholder="e.g., Full Lead Enrichment"
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Description (optional)
                              </label>
                              <input
                                type="text"
                                value={pipelineDescription}
                                onChange={(e) => setPipelineDescription(e.target.value)}
                                placeholder="e.g., Normalize → Clay → LinkedIn"
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left Column: Available Workflows */}
                            <div>
                              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                                Available Workflows
                              </h4>
                              <div className="space-y-2 max-h-[250px] overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md p-2">
                                {workflows.map((workflow) => {
                                  const isAdded = pipeline.includes(workflow.slug);
                                  return (
                                    <button
                                      key={workflow.slug}
                                      onClick={() => addWorkflowToPipeline(workflow.slug)}
                                      disabled={isAdded}
                                      className={`w-full text-left p-3 rounded-md transition-colors ${
                                        isAdded
                                          ? "bg-zinc-100 dark:bg-zinc-800 opacity-50 cursor-not-allowed"
                                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                                            {workflow.name}
                                          </span>
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                              workflow.type === "SYNC"
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                            }`}
                                          >
                                            {workflow.type}
                                          </span>
                                        </div>
                                        {!isAdded && (
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
                                            className="text-purple-500"
                                          >
                                            <path d="M5 12h14" />
                                            <path d="M12 5v14" />
                                          </svg>
                                        )}
                                      </div>
                                      <code className="text-xs text-zinc-400 font-mono">
                                        {workflow.slug}
                                      </code>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Right Column: Pipeline */}
                            <div>
                              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                                Execution Pipeline
                                {pipeline.length > 0 && (
                                  <span className="ml-2 text-zinc-400 font-normal">
                                    ({pipeline.length} step{pipeline.length !== 1 ? "s" : ""})
                                  </span>
                                )}
                              </h4>
                              <div className="min-h-[250px] border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-md p-2">
                                {pipeline.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-zinc-400 text-sm min-h-[230px]">
                                    <div className="text-center">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="mx-auto mb-2 opacity-50"
                                      >
                                        <path d="m12 19-7-7 7-7" />
                                        <path d="M19 12H5" />
                                      </svg>
                                      <p>Click workflows to add</p>
                                      <p className="text-xs mt-1">Order matters</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {pipeline.map((slug, index) => {
                                      const workflow = getWorkflowBySlug(slug);
                                      if (!workflow) return null;
                                      return (
                                        <div
                                          key={`${slug}-${index}`}
                                          className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-sm"
                                        >
                                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate block">
                                              {workflow.name}
                                            </span>
                                            <code className="text-xs text-zinc-400 font-mono">
                                              {workflow.slug}
                                            </code>
                                          </div>
                                          <div className="flex-shrink-0 flex items-center gap-1">
                                            <button
                                              onClick={() => moveWorkflowUp(index)}
                                              disabled={index === 0}
                                              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                                              title="Move up"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                                            </button>
                                            <button
                                              onClick={() => moveWorkflowDown(index)}
                                              disabled={index === pipeline.length - 1}
                                              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                                              title="Move down"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </button>
                                            <button
                                              onClick={() => removeWorkflowFromPipeline(index)}
                                              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded ml-1"
                                              title="Remove"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Error Message */}
                          {pipelineError && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                              <p className="text-sm text-red-700 dark:text-red-300">{pipelineError}</p>
                            </div>
                          )}

                          {/* Save/Cancel Buttons */}
                          <div className="mt-4 flex items-center justify-between">
                            <div>
                              {editingPipelineId && (
                                <button
                                  onClick={resetPipelineForm}
                                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                >
                                  Cancel Edit
                                </button>
                              )}
                            </div>
                            <Button
                              onClick={handleSavePipeline}
                              disabled={savingPipeline || pipeline.length === 0 || !pipelineName.trim()}
                              className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed"
                            >
                              {savingPipeline
                                ? "Saving..."
                                : editingPipelineId
                                ? "Update Pipeline"
                                : "Save Pipeline"
                              }
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
        </div>
      </main>
    </div>
  );
}
