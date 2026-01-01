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
  getClientById,
  getWorkflows,
  getClientPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
  Client,
  EnrichmentWorkflow,
  EnrichmentPipeline,
} from "@/app/actions";

export default function CrmDataPipelinesPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [pipelines, setPipelines] = useState<EnrichmentPipeline[]>([]);
  const [loading, setLoading] = useState(true);

  // Pipeline builder state
  const [isCreating, setIsCreating] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<EnrichmentPipeline | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [clientData, workflowsData, pipelinesData] = await Promise.all([
        getClientById(clientId),
        getWorkflows(),
        getClientPipelines(clientId),
      ]);
      setClient(clientData);
      setWorkflows(workflowsData);
      // Filter pipelines for this workstream
      const crmDataPipelines = pipelinesData.filter(
        (p) => p.name.startsWith("[crm_data]") || p.description?.includes("crm_data")
      );
      setPipelines(crmDataPipelines);
      setLoading(false);
    }
    fetchData();
  }, [clientId]);

  function openCreateForm() {
    setIsCreating(true);
    setEditingPipeline(null);
    setPipelineName("");
    setPipelineDescription("");
    setSelectedSteps([]);
    setError(null);
  }

  function openEditForm(pipeline: EnrichmentPipeline) {
    setIsCreating(false);
    setEditingPipeline(pipeline);
    setPipelineName(pipeline.name.replace("[crm_data] ", ""));
    setPipelineDescription(pipeline.description || "");
    setSelectedSteps(pipeline.steps);
    setError(null);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingPipeline(null);
    setPipelineName("");
    setPipelineDescription("");
    setSelectedSteps([]);
    setError(null);
  }

  function toggleStep(slug: string) {
    setSelectedSteps((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newSteps = [...selectedSteps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSelectedSteps(newSteps);
  }

  async function handleSave() {
    if (!pipelineName.trim()) {
      setError("Pipeline name is required");
      return;
    }
    if (selectedSteps.length === 0) {
      setError("Select at least one workflow step");
      return;
    }

    setSaving(true);
    setError(null);

    const fullName = `[crm_data] ${pipelineName.trim()}`;
    const fullDescription = pipelineDescription.trim() || "crm_data workstream pipeline";

    if (editingPipeline) {
      const result = await updatePipeline(editingPipeline.id, {
        name: fullName,
        description: fullDescription,
        steps: selectedSteps,
      });
      if (result.success) {
        const updated = await getClientPipelines(clientId);
        const crmDataPipelines = updated.filter(
          (p) => p.name.startsWith("[crm_data]") || p.description?.includes("crm_data")
        );
        setPipelines(crmDataPipelines);
        closeForm();
      } else {
        setError(result.error || "Failed to update pipeline");
      }
    } else {
      const result = await createPipeline(clientId, {
        name: fullName,
        description: fullDescription,
        steps: selectedSteps,
      });
      if (result.success) {
        const updated = await getClientPipelines(clientId);
        const crmDataPipelines = updated.filter(
          (p) => p.name.startsWith("[crm_data]") || p.description?.includes("crm_data")
        );
        setPipelines(crmDataPipelines);
        closeForm();
      } else {
        setError(result.error || "Failed to create pipeline");
      }
    }

    setSaving(false);
  }

  async function handleDelete(pipelineId: string) {
    if (!confirm("Are you sure you want to delete this pipeline?")) return;

    const result = await deletePipeline(pipelineId);
    if (result.success) {
      setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
    }
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

  const showForm = isCreating || editingPipeline;

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
                Enrichment Pipelines
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {client.company_name} - Build enrichment workflows for CRM Data
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pipelines</CardTitle>
                <CardDescription>
                  Manage enrichment pipelines for CRM Data
                </CardDescription>
              </div>
              <Button onClick={openCreateForm} size="sm">
                + New Pipeline
              </Button>
            </CardHeader>
            <CardContent>
              {pipelines.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">
                  No pipelines yet. Create one to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {pipelines.map((pipeline) => (
                    <div
                      key={pipeline.id}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-md hover:border-zinc-400 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                            {pipeline.name.replace("[crm_data] ", "")}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1">
                            {pipeline.steps.length} steps: {pipeline.steps.join(" → ")}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditForm(pipeline)}
                            className="p-1 text-zinc-400 hover:text-zinc-600"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(pipeline.id)}
                            className="p-1 text-zinc-400 hover:text-red-600"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Builder */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingPipeline ? "Edit Pipeline" : "Create Pipeline"}</CardTitle>
                <CardDescription>
                  Select and order workflow steps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Pipeline Name
                  </label>
                  <input
                    type="text"
                    value={pipelineName}
                    onChange={(e) => setPipelineName(e.target.value)}
                    placeholder="e.g., Standard Enrichment"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
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
                    placeholder="Brief description"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Available Workflows
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md p-2">
                    {workflows.map((w) => (
                      <label
                        key={w.slug}
                        className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSteps.includes(w.slug)}
                          onChange={() => toggleStep(w.slug)}
                          className="rounded"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{w.name}</span>
                        <span className="text-xs text-zinc-400 ml-auto">{w.type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedSteps.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Step Order
                    </label>
                    <div className="space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-md p-2">
                      {selectedSteps.map((slug, index) => {
                        const workflow = workflows.find((w) => w.slug === slug);
                        return (
                          <div
                            key={slug}
                            className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded"
                          >
                            <span className="text-xs font-mono text-zinc-400 w-6">{index + 1}.</span>
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                              {workflow?.name || slug}
                            </span>
                            <button
                              onClick={() => moveStep(index, "up")}
                              disabled={index === 0}
                              className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveStep(index, "down")}
                              disabled={index === selectedSteps.length - 1}
                              className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? "Saving..." : editingPipeline ? "Update Pipeline" : "Create Pipeline"}
                  </Button>
                  <Button onClick={closeForm} variant="outline">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
