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
  getClientPipelines,
  getWorkstreamPipelines,
  createClientPipelineForWorkstream,
  updatePipeline,
  deletePipeline,
  setActivePipeline,
  Client,
  EnrichmentWorkflow,
  EnrichmentPipeline,
} from "@/app/actions";

const WORKSTREAM_SLUG = "apollo_scrape";

export default function PipelinesPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [savedPipelines, setSavedPipelines] = useState<EnrichmentPipeline[]>([]);
  const [workstreamDefaultPipeline, setWorkstreamDefaultPipeline] = useState<EnrichmentPipeline | null>(null);
  const [loading, setLoading] = useState(true);

  // Pipeline builder state
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [savingPipeline, setSavingPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, workflowsData, pipelinesData, workstreamPipelines] = await Promise.all([
        getClientById(clientId),
        getWorkflowsByWorkstream(WORKSTREAM_SLUG),
        getClientPipelines(clientId),
        getWorkstreamPipelines(WORKSTREAM_SLUG),
      ]);
      setClient(clientData);
      setWorkflows(workflowsData);

      // Filter client pipelines to only those for this workstream
      const clientWorkstreamPipelines = pipelinesData.filter(
        (p) => p.workstream_slug === WORKSTREAM_SLUG
      );
      setSavedPipelines(clientWorkstreamPipelines);

      // Find the active workstream default pipeline
      const defaultPipeline = workstreamPipelines.find((p) => p.is_active);
      setWorkstreamDefaultPipeline(defaultPipeline || null);

      setLoading(false);
    }
    fetchData();
  }, [clientId]);

  // Determine which pipeline is active for this client
  const clientActivePipeline = savedPipelines.find((p) => p.is_active);
  const effectivePipeline = clientActivePipeline || workstreamDefaultPipeline;
  const isUsingInheritedDefault = !clientActivePipeline && !!workstreamDefaultPipeline;

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
      const result = await updatePipeline(editingPipelineId, {
        name: pipelineName.trim(),
        description: pipelineDescription.trim() || undefined,
        steps: pipeline,
      });
      if (result.success) {
        const newPipelines = await getClientPipelines(clientId);
        setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
        resetPipelineForm();
      } else {
        setPipelineError(result.error || "Failed to update pipeline");
      }
    } else {
      const result = await createClientPipelineForWorkstream(clientId, WORKSTREAM_SLUG, {
        name: pipelineName.trim(),
        description: pipelineDescription.trim() || undefined,
        steps: pipeline,
      });
      if (result.success) {
        const newPipelines = await getClientPipelines(clientId);
        setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
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
    setBuilderOpen(true);
  }

  function resetPipelineForm() {
    setPipeline([]);
    setPipelineName("");
    setPipelineDescription("");
    setEditingPipelineId(null);
    setPipelineError(null);
    setBuilderOpen(false);
  }

  async function handleDeletePipeline(pipelineId: string) {
    if (!confirm("Are you sure you want to delete this pipeline?")) return;

    const result = await deletePipeline(pipelineId);
    if (result.success) {
      const newPipelines = await getClientPipelines(clientId);
      setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
      if (editingPipelineId === pipelineId) {
        resetPipelineForm();
      }
    }
  }

  async function handleSetActivePipeline(pipelineId: string) {
    const result = await setActivePipeline(pipelineId, WORKSTREAM_SLUG, clientId);
    if (result.success) {
      const newPipelines = await getClientPipelines(clientId);
      setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
    }
  }

  async function handleUseInheritedDefault() {
    // Deactivate all client pipelines for this workstream
    for (const p of savedPipelines) {
      if (p.is_active) {
        await updatePipeline(p.id, { is_active: false });
      }
    }
    const newPipelines = await getClientPipelines(clientId);
    setSavedPipelines(newPipelines.filter((p) => p.workstream_slug === WORKSTREAM_SLUG));
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
              href={`/clients/${clientId}/apollo-ingest`}
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
                Enrichment Pipelines
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Apollo Scrape workstream
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Active Pipeline Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Pipeline</CardTitle>
            <CardDescription>
              Used when processing batches for {client.company_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {effectivePipeline ? (
              <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {effectivePipeline.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        ({isUsingInheritedDefault ? "default" : "custom"})
                      </span>
                    </div>
                    {effectivePipeline.description && (
                      <p className="text-sm text-zinc-500 mt-1">{effectivePipeline.description}</p>
                    )}
                    <p className="text-sm text-zinc-500 mt-2">
                      {effectivePipeline.steps.join(" → ")}
                    </p>
                  </div>
                  {!isUsingInheritedDefault && workstreamDefaultPipeline && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUseInheritedDefault}
                    >
                      Use Default
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No active pipeline configured.
              </p>
            )}
          </CardContent>
        </Card>


        {/* Client Custom Pipelines */}
        <Card>
          <CardHeader>
            <CardTitle>{editingPipelineId ? "Edit Pipeline" : "Custom Pipelines"}</CardTitle>
            <CardDescription>
              Create custom pipelines for this client to override the workstream default
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Saved Client Pipelines List */}
            {savedPipelines.length > 0 && !editingPipelineId && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Client Pipelines
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {savedPipelines.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">
                            {p.name}
                          </p>
                          {p.is_active && (
                            <span className="text-xs text-zinc-500">
                              (active)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {p.steps.length} step{p.steps.length !== 1 ? "s" : ""}: {p.steps.join(" → ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {!p.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActivePipeline(p.id)}
                          >
                            Set Active
                          </Button>
                        )}
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
              </div>
            )}

            {/* Create/Edit Pipeline - Collapsible */}
            {workflows.length > 0 && (
              <Collapsible open={builderOpen || !!editingPipelineId} onOpenChange={setBuilderOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 mt-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {editingPipelineId ? "Edit Pipeline" : "Create New Pipeline"}
                    </span>
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
                      className={`text-zinc-400 transition-transform ${builderOpen || editingPipelineId ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-4">
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
                      placeholder="e.g., Normalize -> Clay -> LinkedIn"
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
                    <div className="space-y-2 max-h-[300px] overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md p-2">
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
                    <div className="min-h-[300px] border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-md p-2">
                      {pipeline.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-zinc-400 text-sm min-h-[280px]">
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
                        onClick={() => {
                          resetPipelineForm();
                          setBuilderOpen(false);
                        }}
                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <Button
                    onClick={handleSavePipeline}
                    disabled={savingPipeline || pipeline.length === 0 || !pipelineName.trim()}
                  >
                    {savingPipeline
                      ? "Saving..."
                      : editingPipelineId
                      ? "Update Pipeline"
                      : "Save Pipeline"
                    }
                  </Button>
                </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
