"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function GlobalIngestPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              Home
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Global Ingest</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Global Ingest
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cross-client data ingestion sources
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* SalesNav KoolKit Scrapes - Upload */}
          <Link href="/global-ingest/salesnav">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-emerald-500 dark:hover:border-emerald-400 h-full border-l-4 border-l-emerald-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    className="text-emerald-600"
                  >
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect width="4" height="12" x="2" y="9" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                  SalesNav KoolKit Scrapes
                </CardTitle>
                <CardDescription>
                  Upload LinkedIn Sales Navigator export files
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Download SalesNav Batches as CSV */}
          <Link href="/global-ingest/salesnav/download-batches">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 h-full border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    className="text-blue-600"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  Download SalesNav Batches
                </CardTitle>
                <CardDescription>
                  Download SalesNav records as CSV files (10k per batch)
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* VC Portfolio Scrapes */}
          <Link href="/global-ingest/vc-portfolios">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-violet-500 dark:hover:border-violet-400 h-full border-l-4 border-l-violet-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    className="text-violet-600"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  VC Portfolio Scrapes
                </CardTitle>
                <CardDescription>
                  Upload Crunchbase VC portfolio company exports
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Browse VC Portfolio Data */}
          <Link href="/global-ingest/vc-portfolios/browse">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-amber-500 dark:hover:border-amber-400 h-full border-l-4 border-l-amber-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    className="text-amber-600"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M21 3v6h-6" />
                  </svg>
                  Browse Portfolio Data
                </CardTitle>
                <CardDescription>
                  View and audit all VC portfolio company records
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* VC Crunchbase Portfolios (New) */}
          <Link href="/global-ingest/vc-crunchbase">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-cyan-500 dark:hover:border-cyan-400 h-full border-l-4 border-l-cyan-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    className="text-cyan-600"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  VC Crunchbase (New)
                </CardTitle>
                <CardDescription>
                  Upload flattened VC portfolio CSV with clean headers
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* SalesNav CSV Import */}
          <Link href="/global-ingest/salesnav/import-csv">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-rose-500 dark:hover:border-rose-400 h-full border-l-4 border-l-rose-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    className="text-rose-600"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  SalesNav CSV Import
                </CardTitle>
                <CardDescription>
                  Import a SalesNav CSV file
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Placeholder for future sources */}
          <Card className="opacity-40 cursor-not-allowed h-full border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-400">
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
                More Sources
              </CardTitle>
              <CardDescription>
                Additional ingest sources coming soon
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}

