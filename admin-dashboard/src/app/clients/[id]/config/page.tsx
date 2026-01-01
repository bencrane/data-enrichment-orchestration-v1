"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClientById,
  getActiveWorkstreams,
  Client,
  DataIngestionWorkstream,
} from "@/app/actions";

// Map workstream slugs to their route paths
function getWorkstreamRoutePath(slug: string): string {
  const routeMap: Record<string, string> = {
    apollo_scrape: "apollo-ingest",
    salesnav_koolkit: "salesnav-koolkit",
    customer_companies: "customer-companies",
    crm_data: "crm-data",
  };
  return routeMap[slug] || slug.replace(/_/g, "-");
}

export default function ClientConfigPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [workstreams, setWorkstreams] = useState<DataIngestionWorkstream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, workstreamsData] = await Promise.all([
        getClientById(clientId),
        getActiveWorkstreams(),
      ]);
      setClient(clientData);
      setWorkstreams(workstreamsData);
      setLoading(false);
    }
    fetchData();
  }, [clientId]);

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
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Configuration
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Ingestion Workstreams</CardTitle>
            <CardDescription>
              Active workstreams available for this client
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workstreams.length === 0 ? (
              <p className="text-zinc-500 py-4 text-center">
                No active workstreams found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workstreams.map((workstream) => (
                    <TableRow
                      key={workstream.slug}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      onClick={() => {
                        router.push(`/clients/${clientId}/${getWorkstreamRoutePath(workstream.slug)}/config`);
                      }}
                    >
                      <TableCell className="font-medium">
                        {workstream.name}
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">
                          {workstream.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {workstream.description || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
