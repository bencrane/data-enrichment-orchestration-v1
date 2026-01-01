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
  uploadCrmData,
  Client,
  CrmDataRow,
} from "@/app/actions";

// CSV header to snake_case mapping for CRM Data
// Handles exact headers and common variations
const HEADER_MAP: Record<string, keyof CrmDataRow> = {
  // Company name
  "company name": "company_name",
  "company_name": "company_name",
  "companyname": "company_name",
  "company": "company_name",
  "account name": "company_name",
  "account": "company_name",
  // Domain
  "domain": "domain",
  "company domain": "domain",
  "company_domain": "domain",
  "website": "domain",
  "company website": "domain",
  "url": "domain",
  // Company LinkedIn URL
  "company linkedin url": "company_linkedin_url",
  "company_linkedin_url": "company_linkedin_url",
  "company linkedin": "company_linkedin_url",
  "linkedin company url": "company_linkedin_url",
  // First name
  "first name": "first_name",
  "first_name": "first_name",
  "firstname": "first_name",
  // Last name
  "last name": "last_name",
  "last_name": "last_name",
  "lastname": "last_name",
  // Person LinkedIn URL
  "person linkedin url": "person_linkedin_url",
  "person_linkedin_url": "person_linkedin_url",
  "linkedin url": "person_linkedin_url",
  "linkedin_url": "person_linkedin_url",
  "linkedin": "person_linkedin_url",
  "profile url": "person_linkedin_url",
  // Work email
  "work email": "work_email",
  "work_email": "work_email",
  "email": "work_email",
  "email address": "work_email",
  "business email": "work_email",
  // Mobile phone
  "mobile phone": "mobile_phone",
  "mobile_phone": "mobile_phone",
  "phone": "mobile_phone",
  "phone number": "mobile_phone",
  "mobile": "mobile_phone",
  "cell": "mobile_phone",
  "cell phone": "mobile_phone",
  // Notes
  "notes": "notes",
  "note": "notes",
  "comments": "notes",
  "comment": "notes",
  "description": "notes",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

function mapCsvRow(row: Record<string, string>): CrmDataRow {
  const mapped: CrmDataRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = HEADER_MAP[normalizedKey];
    if (mappedKey && value) {
      mapped[mappedKey] = value;
    }
  }
  return mapped;
}

export default function CrmDataUploadPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<CrmDataRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const clientData = await getClientById(clientId);
      setClient(clientData);
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
      delimiter: ",",
      complete: (result) => {
        const criticalErrors = result.errors.filter(
          (e) => !e.message.includes("auto-detect delimiting character")
        );
        if (criticalErrors.length > 0) {
          setParseError(`Parse error: ${criticalErrors[0].message}`);
          return;
        }

        const rows = result.data.map(mapCsvRow);
        // Filter rows that have at least some data
        const validRows = rows.filter((r) =>
          r.company_name || r.first_name || r.last_name || r.work_email || r.domain
        );

        if (validRows.length === 0) {
          setParseError("No valid rows found. Ensure CSV has recognizable columns.");
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
    const result = await uploadCrmData(clientId, uploadId, parsedRows);

    if (result.success) {
      setUploadResult({
        success: true,
        message: `Upload Success: ${result.rowCount} records added.`,
      });
      setParsedRows([]);
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
              href={`/clients/${clientId}/crm-data`}
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
                Upload Files
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Upload CRM Data CSV
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Upload CRM Data CSV</CardTitle>
              <CardDescription>
                Upload a CSV file with company and contact data from your CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
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
                  Drop your CRM Data CSV here
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
                      Ready to upload: {parsedRows.length} records
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedRows([]);
                        setParseError(null);
                        setUploadResult(null);
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
                          <th className="text-left py-2 px-3">Name</th>
                          <th className="text-left py-2 px-3">Company</th>
                          <th className="text-left py-2 px-3">Email</th>
                          <th className="text-left py-2 px-3">Domain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                            <td className="py-2 px-3">
                              {[row.first_name, row.last_name].filter(Boolean).join(" ") || "-"}
                            </td>
                            <td className="py-2 px-3">{row.company_name || "-"}</td>
                            <td className="py-2 px-3 font-mono text-xs">{row.work_email || "-"}</td>
                            <td className="py-2 px-3">{row.domain || "-"}</td>
                          </tr>
                        ))}
                        {parsedRows.length > 5 && (
                          <tr className="border-t border-zinc-200 dark:border-zinc-700">
                            <td colSpan={4} className="py-2 px-3 text-zinc-500 text-center">
                              ... and {parsedRows.length - 5} more records
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? "Uploading..." : `Upload ${parsedRows.length} Records`}
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

              <div className="text-sm text-zinc-500 border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                <p className="font-medium mb-2">Expected CSV columns:</p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 text-xs">
                  <li>Company name, Domain, Company LinkedIn URL</li>
                  <li>First name, Last name, Person LinkedIn URL</li>
                  <li>Work email, Mobile phone</li>
                  <li>Notes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
