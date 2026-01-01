"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getClientById,
  getWorkflowsByWorkstream,
  getClientWorkflowConfigs,
  saveClientWorkflowConfig,
  getActivePipelineForClient,
  Client,
  EnrichmentWorkflow,
  EnrichmentPipeline,
  ClientWorkflowConfig,
} from "@/app/actions";

const WORKSTREAM_SLUG = "crm_data";

export default function CrmDataConfigPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [activePipeline, setActivePipeline] = useState<EnrichmentPipeline | null>(null);
  const [clientConfigs, setClientConfigs] = useState<ClientWorkflowConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [allWorkflowsOpen, setAllWorkflowsOpen] = useState(false);

  // Config editor state
  const [editingWorkflowSlug, setEditingWorkflowSlug] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, workflowsData, configsData, pipelineData] = await Promise.all([
        getClientById(clientId),
        getWorkflowsByWorkstream(WORKSTREAM_SLUG),
        getClientWorkflowConfigs(clientId),
        getActivePipelineForClient(WORKSTREAM_SLUG, clientId),
      ]);
      setClient(clientData);
      setWorkflows(workflowsData);
      setClientConfigs(configsData);
      setActivePipeline(pipelineData);
      setLoading(false);
    }
    fetchData();
  }, [clientId]);

  // Get workflows that are in the active pipeline
  const pipelineWorkflows = activePipeline
    ? activePipeline.steps
        .map((slug) => workflows.find((w) => w.slug === slug))
        .filter((w): w is EnrichmentWorkflow => w !== undefined)
    : [];

  // Get workflows that are NOT in the active pipeline
  const otherWorkflows = workflows.filter(
    (w) => !activePipeline?.steps.includes(w.slug)
  );

  function getConfigForWorkflow(workflowSlug: string): ClientWorkflowConfig | undefined {
    return clientConfigs.find((c) => c.workflow_slug === workflowSlug);
  }

  function openConfigEditor(workflowSlug: string) {
    const existing = getConfigForWorkflow(workflowSlug);
    setEditingWorkflowSlug(workflowSlug);
    setConfigJson(existing ? JSON.stringify(existing.config, null, 2) : '{\n  "webhook_url": ""\n}');
    setConfigError(null);
  }

  function closeConfigEditor() {
    setEditingWorkflowSlug(null);
    setConfigJson("");
    setConfigError(null);
  }

  async function handleSaveConfig() {
    if (!editingWorkflowSlug) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      setConfigError("Invalid JSON format");
      return;
    }

    setSavingConfig(true);
    setConfigError(null);

    const result = await saveClientWorkflowConfig(
      clientId,
      editingWorkflowSlug,
      parsed,
      WORKSTREAM_SLUG
    );

    if (result.success) {
      const newConfigs = await getClientWorkflowConfigs(clientId);
      setClientConfigs(newConfigs);
      closeConfigEditor();
    } else {
      setConfigError(result.error || "Failed to save configuration");
    }

    setSavingConfig(false);
  }

  function renderWorkflowCard(workflow: EnrichmentWorkflow) {
    const config = getConfigForWorkflow(workflow.slug);
    const isConfigured = !!config && !!config.config?.webhook_url;
    const requiresClay = workflow.requires_clay;

    const getCardClasses = () => {
      if (!requiresClay) {
        // Clay not required - light grey
        return "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50";
      }
      if (requiresClay && !isConfigured) {
        // Clay required but not configured - faint red
        return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10";
      }
      // Clay required and configured - subtle green border
      return "border-green-200 dark:border-green-800 bg-white dark:bg-zinc-800";
    };

    return (
      <div
        key={workflow.slug}
        className={`p-4 border rounded-lg transition-colors ${getCardClasses()}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">
              {workflow.name}
            </h4>
            <code className="text-xs text-zinc-400 font-mono">
              {workflow.slug}
            </code>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span
              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                workflow.type === "SYNC"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
              }`}
            >
              {workflow.type}
            </span>
            {requiresClay && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  isConfigured
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                }`}
              >
                {isConfigured ? "Configured" : "Not Set"}
              </span>
            )}
          </div>
        </div>
        {workflow.description && (
          <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
            {workflow.description}
          </p>
        )}
        {isConfigured && config?.config && (
          <div className="mb-3 p-2 bg-zinc-100 dark:bg-zinc-900 rounded text-xs font-mono overflow-hidden">
            <p className="text-zinc-600 dark:text-zinc-400 truncate">
              {(config.config as Record<string, unknown>).webhook_url
                ? `webhook_url: ${String((config.config as Record<string, unknown>).webhook_url).slice(0, 30)}...`
                : JSON.stringify(config.config).slice(0, 40) + "..."
              }
            </p>
          </div>
        )}
        {requiresClay && (
          <Button
            onClick={() => openConfigEditor(workflow.slug)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isConfigured ? "Edit Configuration" : "Configure"}
          </Button>
        )}
      </div>
    );
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
                Workflow Configuration
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Configure webhook URLs and API settings for CRM Data
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Active Pipeline Workflows */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Pipeline Workflows</CardTitle>
            <CardDescription>
              {activePipeline ? (
                <>
                  Configure workflows in <span className="font-medium">{activePipeline.name}</span>
                </>
              ) : (
                "No active pipeline configured"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activePipeline && (
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  {activePipeline.steps.map((slug, idx) => {
                    const workflow = workflows.find((w) => w.slug === slug);
                    const config = getConfigForWorkflow(slug);
                    const requiresClay = workflow?.requires_clay ?? false;
                    const isConfigured = !!config && !!config.config?.webhook_url;
                    const needsConfig = requiresClay && !isConfigured;
                    return (
                      <span key={slug} className="flex items-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-mono ${
                            needsConfig
                              ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {slug}
                        </span>
                        {idx < activePipeline.steps.length - 1 && (
                          <span className="mx-2 text-zinc-400">→</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {pipelineWorkflows.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                {activePipeline
                  ? "No workflows in the active pipeline."
                  : "Configure an active pipeline to see workflows here."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pipelineWorkflows.map((workflow) => renderWorkflowCard(workflow))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Available Workflows - Collapsible */}
        {otherWorkflows.length > 0 && (
          <Card>
            <Collapsible open={allWorkflowsOpen} onOpenChange={setAllWorkflowsOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">All Available Workflows</CardTitle>
                      <CardDescription>
                        {otherWorkflows.length} workflow{otherWorkflows.length !== 1 ? "s" : ""} not in active pipeline
                      </CardDescription>
                    </div>
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
                      className={`text-zinc-400 transition-transform ${allWorkflowsOpen ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {otherWorkflows.map((workflow) => renderWorkflowCard(workflow))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Config Edit Modal */}
        {editingWorkflowSlug && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-lg w-full mx-4">
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Configure Workflow
                  </h3>
                  <code className="text-xs text-zinc-500 font-mono">{editingWorkflowSlug}</code>
                </div>
                <button
                  onClick={closeConfigEditor}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
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
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Configuration (JSON)
                </label>
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder='{"webhook_url": "https://..."}'
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Common fields: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">webhook_url</code>, <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">api_key</code>, <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">table_id</code>
                </p>
                {configError && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-sm text-red-700 dark:text-red-300">{configError}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-200 dark:border-zinc-700">
                <Button
                  onClick={closeConfigEditor}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  {savingConfig ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
