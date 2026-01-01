"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
} from "@/components/ui/card";
import {
  getClientById,
  getClientPipelines,
  getClientWorkflowConfigs,
  Client,
  EnrichmentPipeline,
  ClientWorkflowConfig,
} from "@/app/actions";

export default function CustomerCompaniesPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [savedPipelines, setSavedPipelines] = useState<EnrichmentPipeline[]>([]);
  const [clientConfigs, setClientConfigs] = useState<ClientWorkflowConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Replace with actual customer companies upload count when backend is ready
  const uploadsCount = 0;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, pipelinesData, configsData] = await Promise.all([
        getClientById(clientId),
        getClientPipelines(clientId),
        getClientWorkflowConfigs(clientId),
      ]);
      setClient(clientData);
      setSavedPipelines(pipelinesData);
      setClientConfigs(configsData);
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
                Customer Companies
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Upload customer company lists, configure enrichment pipelines, and manage workflow settings
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Upload Files */}
          <Link href={`/clients/${clientId}/customer-companies/upload`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
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
            </Card>
          </Link>

          {/* Past Uploads */}
          <Link href={`/clients/${clientId}/customer-companies/uploads`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
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
                  {uploadsCount === 0
                    ? "No uploads yet"
                    : `${uploadsCount} upload${uploadsCount !== 1 ? "s" : ""}`
                  }
                </p>
              </div>
            </Card>
          </Link>

          {/* Enrichment Pipelines */}
          <Link href={`/clients/${clientId}/customer-companies/pipelines`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
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
            </Card>
          </Link>

          {/* Workflow Configuration */}
          <Link href={`/clients/${clientId}/customer-companies/config`}>
            <Card className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors h-full">
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
                <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-3">
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
                    className="text-orange-600 dark:text-orange-400"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Workflow Configuration
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {clientConfigs.length === 0
                    ? "Set up webhook URLs & API keys"
                    : `${clientConfigs.length} workflow${clientConfigs.length !== 1 ? "s" : ""} configured`
                  }
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
