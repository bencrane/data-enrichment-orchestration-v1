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
  getClientById,
  getApolloUploads,
  uploadApolloData,
  Client,
  ApolloUpload,
  ApolloRow,
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
  "is likely to engage": "is_likely_to_engage",
  "city": "lead_city",
  "state": "lead_state",
  "country": "lead_country",
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
  "company domain": "company_website_short",
  "blog url": "company_blog_url",
  "company blog url": "company_blog_url",
  "twitter url": "company_twitter_url",
  "company twitter url": "company_twitter_url",
  "facebook url": "company_facebook_url",
  "company facebook url": "company_facebook_url",
  "linkedin url (company)": "company_linkedin_url",
  "company linkedin url": "company_linkedin_url",
  "phone": "company_phone",
  "company phone": "company_phone",
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

function generateUploadId(): string {
  return crypto.randomUUID();
}

export default function ApolloUploadsPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [uploads, setUploads] = useState<ApolloUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<ApolloRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, uploadsData] = await Promise.all([
        getClientById(clientId),
        getApolloUploads(clientId),
      ]);
      setClient(clientData);
      setUploads(uploadsData);
      setLoading(false);
    }
    fetchData();
  }, [clientId]);

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
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(`Parse error: ${result.errors[0].message}`);
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

    const uploadId = generateUploadId();
    const result = await uploadApolloData(clientId, uploadId, parsedRows);

    if (result.success) {
      setUploadResult({
        success: true,
        message: `Upload Success: ${result.rowCount} rows added.`,
      });
      setParsedRows([]);
      // Refresh uploads list
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
                Apollo Uploads
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} ({client.company_domain})
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Zone */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Apollo CSV</CardTitle>
              <CardDescription>
                Drag & drop an Apollo export CSV or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
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
                  Drop your Apollo CSV here
                </p>
                <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                  or click to browse
                </p>
              </div>

              {/* Parse Error */}
              {parseError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
                </div>
              )}

              {/* Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Ready to upload: {parsedRows.length} rows
                  </p>
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

              {/* Upload Result */}
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
          </Card>

          {/* Upload History */}
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>Previous Apollo CSV uploads for this client</CardDescription>
            </CardHeader>
            <CardContent>
              {uploads.length === 0 ? (
                <p className="text-zinc-500 py-8 text-center">No uploads yet</p>
              ) : (
                <div className="space-y-3">
                  {uploads.map((upload) => (
                    <div
                      key={upload.id}
                      className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md"
                    >
                      <div>
                        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {upload.upload_id.slice(0, 8)}...
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                          {upload.row_count} rows
                        </p>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {new Date(upload.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
