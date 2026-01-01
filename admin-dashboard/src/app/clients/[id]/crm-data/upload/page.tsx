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
  uploadCrmNormalizedCompanies,
  uploadCrmNormalizedPeople,
  Client,
  CrmNormalizedCompanyRow,
  CrmNormalizedPersonRow,
  CrmDataFileType,
} from "@/app/actions";

// CSV header to snake_case mapping for Companies
const COMPANY_HEADER_MAP: Record<string, keyof CrmNormalizedCompanyRow> = {
  "company name": "company_name",
  "company_name": "company_name",
  "companyname": "company_name",
  "company": "company_name",
  "account name": "company_name",
  "account": "company_name",
  "domain": "domain",
  "company domain": "domain",
  "company_domain": "domain",
  "website": "domain",
  "company website": "domain",
  "url": "domain",
  "company linkedin url": "company_linkedin_url",
  "company_linkedin_url": "company_linkedin_url",
  "company linkedin": "company_linkedin_url",
  "linkedin company url": "company_linkedin_url",
};

// CSV header to snake_case mapping for People
const PEOPLE_HEADER_MAP: Record<string, keyof CrmNormalizedPersonRow> = {
  "company name": "company_name",
  "company_name": "company_name",
  "companyname": "company_name",
  "company": "company_name",
  "domain": "domain",
  "company domain": "domain",
  "company_domain": "domain",
  "website": "domain",
  "company linkedin url": "company_linkedin_url",
  "company_linkedin_url": "company_linkedin_url",
  "company linkedin": "company_linkedin_url",
  "first name": "first_name",
  "first_name": "first_name",
  "firstname": "first_name",
  "last name": "last_name",
  "last_name": "last_name",
  "lastname": "last_name",
  "full name": "full_name",
  "full_name": "full_name",
  "fullname": "full_name",
  "name": "full_name",
  "person linkedin url": "person_linkedin_url",
  "person_linkedin_url": "person_linkedin_url",
  "linkedin url": "person_linkedin_url",
  "linkedin_url": "person_linkedin_url",
  "linkedin": "person_linkedin_url",
  "profile url": "person_linkedin_url",
  "email": "email",
  "work email": "email",
  "work_email": "email",
  "email address": "email",
  "business email": "email",
  "mobile phone": "mobile_phone",
  "mobile_phone": "mobile_phone",
  "phone": "mobile_phone",
  "phone number": "mobile_phone",
  "mobile": "mobile_phone",
  "cell": "mobile_phone",
  "cell phone": "mobile_phone",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

function mapCompanyCsvRow(row: Record<string, string>): CrmNormalizedCompanyRow {
  const mapped: CrmNormalizedCompanyRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = COMPANY_HEADER_MAP[normalizedKey];
    if (mappedKey && value) {
      mapped[mappedKey] = value;
    }
  }
  return mapped;
}

function mapPeopleCsvRow(row: Record<string, string>): CrmNormalizedPersonRow {
  const mapped: CrmNormalizedPersonRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = PEOPLE_HEADER_MAP[normalizedKey];
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
  const [fileType, setFileType] = useState<CrmDataFileType>("companies");
  const [parsedCompanyRows, setParsedCompanyRows] = useState<CrmNormalizedCompanyRow[]>([]);
  const [parsedPeopleRows, setParsedPeopleRows] = useState<CrmNormalizedPersonRow[]>([]);
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
    setParsedCompanyRows([]);
    setParsedPeopleRows([]);
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

        if (fileType === "companies") {
          const rows = result.data.map(mapCompanyCsvRow);
          const validRows = rows.filter((r) => r.company_name || r.domain);
          if (validRows.length === 0) {
            setParseError("No valid rows found. Ensure CSV has company_name or domain columns.");
            return;
          }
          setParsedCompanyRows(validRows);
        } else {
          const rows = result.data.map(mapPeopleCsvRow);
          const validRows = rows.filter((r) =>
            r.first_name || r.last_name || r.full_name || r.email || r.company_name
          );
          if (validRows.length === 0) {
            setParseError("No valid rows found. Ensure CSV has name, email, or company columns.");
            return;
          }
          setParsedPeopleRows(validRows);
        }
      },
      error: (error) => {
        setParseError(`Failed to parse CSV: ${error.message}`);
      },
    });
  }, [fileType]);

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

  function clearFile() {
    setParsedCompanyRows([]);
    setParsedPeopleRows([]);
    setParseError(null);
    setUploadResult(null);
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  }

  function handleFileTypeChange(newType: CrmDataFileType) {
    setFileType(newType);
    clearFile();
  }

  async function handleUpload() {
    const rowCount = fileType === "companies" ? parsedCompanyRows.length : parsedPeopleRows.length;
    if (rowCount === 0) return;

    setUploading(true);
    setUploadResult(null);

    const uploadId = crypto.randomUUID();

    let result;
    if (fileType === "companies") {
      result = await uploadCrmNormalizedCompanies(clientId, uploadId, parsedCompanyRows);
    } else {
      result = await uploadCrmNormalizedPeople(clientId, uploadId, parsedPeopleRows);
    }

    if (result.success) {
      setUploadResult({
        success: true,
        message: `Upload Success: ${result.rowCount} ${fileType} records added.`,
      });
      clearFile();
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

  const hasRows = fileType === "companies" ? parsedCompanyRows.length > 0 : parsedPeopleRows.length > 0;
  const rowCount = fileType === "companies" ? parsedCompanyRows.length : parsedPeopleRows.length;

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
                Upload CRM Data
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Upload normalized CRM data
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Select Data Type</CardTitle>
              <CardDescription>
                Choose which type of CRM data you are uploading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Type Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleFileTypeChange("companies")}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    fileType === "companies"
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      fileType === "companies"
                        ? "bg-rose-100 dark:bg-rose-900"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}>
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
                        className={fileType === "companies" ? "text-rose-600" : "text-zinc-500"}
                      >
                        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                        <path d="M10 6h4" />
                        <path d="M10 10h4" />
                        <path d="M10 14h4" />
                        <path d="M10 18h4" />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-medium ${
                        fileType === "companies"
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}>
                        Companies
                      </p>
                      <p className="text-xs text-zinc-500">
                        Company records only
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleFileTypeChange("people")}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    fileType === "people"
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      fileType === "people"
                        ? "bg-rose-100 dark:bg-rose-900"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}>
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
                        className={fileType === "people" ? "text-rose-600" : "text-zinc-500"}
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-medium ${
                        fileType === "people"
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}>
                        People
                      </p>
                      <p className="text-xs text-zinc-500">
                        Contact/person records
                      </p>
                    </div>
                  </div>
                </button>
              </div>

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
                  Drop your {fileType === "companies" ? "Companies" : "People"} CSV here
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

              {hasRows && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Ready to upload: {rowCount} {fileType} records
                    </p>
                    <button
                      type="button"
                      onClick={clearFile}
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

                  {/* Preview Table - Companies */}
                  {fileType === "companies" && parsedCompanyRows.length > 0 && (
                    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-md max-h-48">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3">Company Name</th>
                            <th className="text-left py-2 px-3">Domain</th>
                            <th className="text-left py-2 px-3">LinkedIn URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedCompanyRows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                              <td className="py-2 px-3">{row.company_name || "-"}</td>
                              <td className="py-2 px-3">{row.domain || "-"}</td>
                              <td className="py-2 px-3 font-mono text-xs truncate max-w-[200px]">
                                {row.company_linkedin_url || "-"}
                              </td>
                            </tr>
                          ))}
                          {parsedCompanyRows.length > 5 && (
                            <tr className="border-t border-zinc-200 dark:border-zinc-700">
                              <td colSpan={3} className="py-2 px-3 text-zinc-500 text-center">
                                ... and {parsedCompanyRows.length - 5} more records
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Preview Table - People */}
                  {fileType === "people" && parsedPeopleRows.length > 0 && (
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
                          {parsedPeopleRows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                              <td className="py-2 px-3">
                                {row.full_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "-"}
                              </td>
                              <td className="py-2 px-3">{row.company_name || "-"}</td>
                              <td className="py-2 px-3 font-mono text-xs">{row.email || "-"}</td>
                              <td className="py-2 px-3">{row.domain || "-"}</td>
                            </tr>
                          ))}
                          {parsedPeopleRows.length > 5 && (
                            <tr className="border-t border-zinc-200 dark:border-zinc-700">
                              <td colSpan={4} className="py-2 px-3 text-zinc-500 text-center">
                                ... and {parsedPeopleRows.length - 5} more records
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? "Uploading..." : `Upload ${rowCount} ${fileType === "companies" ? "Companies" : "People"}`}
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

              {/* Expected Columns Info */}
              <div className="text-sm text-zinc-500 border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                <p className="font-medium mb-2">
                  Expected CSV columns for {fileType === "companies" ? "Companies" : "People"}:
                </p>
                {fileType === "companies" ? (
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 text-xs">
                    <li>company_name</li>
                    <li>domain</li>
                    <li>company_linkedin_url</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 text-xs">
                    <li>company_name, domain, company_linkedin_url</li>
                    <li>first_name, last_name, full_name</li>
                    <li>person_linkedin_url</li>
                    <li>email, mobile_phone</li>
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
