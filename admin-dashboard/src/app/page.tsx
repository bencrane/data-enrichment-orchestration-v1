import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Data Enrichment Admin
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Control Plane Dashboard
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Client Manager */}
          <Link href="/clients">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600">
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
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Client Manager
                </CardTitle>
                <CardDescription>
                  Create and manage client companies
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Workflow Registry */}
          <Link href="/workflows">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600">
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
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="m9 15 2 2 4-4" />
                  </svg>
                  Workflow Registry
                </CardTitle>
                <CardDescription>
                  Register and manage enrichment workflows
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Schema Viewer */}
          <Link href="/schema">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600">
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
                  >
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
                    <path d="M3 12A9 3 0 0 0 21 12" />
                  </svg>
                  Table Schema Viewer
                </CardTitle>
                <CardDescription>
                  View column definitions and data types for all database tables
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* Batch Monitor - Coming Soon */}
          <Card className="opacity-50 cursor-not-allowed">
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
                >
                  <path d="M12 3v18" />
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                </svg>
                Batch Monitor
              </CardTitle>
              <CardDescription>
                View and manage batch processing status (Coming Soon)
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Workflow States - Coming Soon */}
          <Card className="opacity-50 cursor-not-allowed">
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
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                  <line x1="10" x2="8" y1="9" y2="9" />
                </svg>
                Workflow States
              </CardTitle>
              <CardDescription>
                Inspect workflow state transitions (Coming Soon)
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Global Ingest - Coming Soon */}
          <Card className="opacity-50 cursor-not-allowed">
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
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                Global Ingest
              </CardTitle>
              <CardDescription>
                Cross-client data ingestion and management (Coming Soon)
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}
