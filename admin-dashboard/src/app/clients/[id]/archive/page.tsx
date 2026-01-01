"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getClientById, Client } from "@/app/actions";

export default function ArchivePage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const clientData = await getClientById(clientId);
      setClient(clientData);
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
                Archive
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Legacy workstreams
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Apollo Scrape Ingest */}
          <Link href={`/clients/${clientId}/apollo-ingest`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
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
                    className="text-zinc-600 dark:text-zinc-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  Apollo Scrape
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  People data enrichment
                </p>
              </div>
            </Card>
          </Link>

          {/* Customer Companies */}
          <Link href={`/clients/${clientId}/customer-companies`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
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
                    className="text-zinc-600 dark:text-zinc-400"
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
                <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  Customer Companies
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Company data enrichment
                </p>
              </div>
            </Card>
          </Link>

          {/* SalesNav KoolKit */}
          <Link href={`/clients/${clientId}/salesnav-koolkit`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
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
                    className="text-zinc-600 dark:text-zinc-400"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  SalesNav KoolKit
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  LinkedIn scraped data
                </p>
              </div>
            </Card>
          </Link>

          {/* CRM Data Upload */}
          <Link href={`/clients/${clientId}/crm-data`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
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
                    className="text-zinc-600 dark:text-zinc-400"
                  >
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
                    <path d="M3 12A9 3 0 0 0 21 12" />
                  </svg>
                </div>
                <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  CRM Data
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  CRM export enrichment
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
