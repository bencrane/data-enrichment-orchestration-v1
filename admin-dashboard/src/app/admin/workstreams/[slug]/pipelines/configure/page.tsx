"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWorkflowsByWorkstream,
  getWorkstreamPipelines,
  createWorkstreamPipeline,
  updatePipeline,
  setActivePipeline,
  getPipelineById,
  EnrichmentWorkflow,
  EnrichmentPipeline,
} from "@/app/actions";

export default function ConfigurePipelinePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workstreamSlug = params.slug as string;
  const editPipelineId = searchParams.get("edit");

  const displayName = workstreamSlug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [setAsActive, setSetAsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const workflowsData = await getWorkflowsByWorkstream(workstreamSlug);
      setWorkflows(workflowsData);

      // If editing, load the pipeline data
      if (editPipelineId) {
        const pipeline = await getPipelineById(editPipelineId);
        if (pipeline) {
          setPipelineName(pipeline.name);
          setPipelineDescription(pipeline.description || "");
          setSteps(pipeline.steps);
          setSetAsActive(pipeline.is_active);
          setIsEditing(true);
        }
      }

      setLoading(false);
    }
    loadData();
  }, [workstreamSlug, editPipelineId]);

  function addStep(slug: string) {
    if (!steps.includes(slug)) {
      setSteps([...steps, slug]);
    }
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newSteps = [...steps];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  }

  function getWorkflowBySlug(slug: string) {
    return workflows.find((w) => w.slug === slug);
  }

  async function handleSave() {
    if (!pipelineName.trim()) {
      setError("Please enter a pipeline name");
      return;
    }
    if (steps.length === 0) {
      setError("Please add at least one workflow step");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing && editPipelineId) {
        const result = await updatePipeline(editPipelineId, {
          name: pipelineName.trim(),
          description: pipelineDescription.trim() || undefined,
          steps,
        });
        if (!result.success) {
          setError(result.error || "Failed to update pipeline");
          setSaving(false);
          return;
        }
        if (setAsActive) {
          await setActivePipeline(editPipelineId, workstreamSlug, null);
        }
      } else {
        const result = await createWorkstreamPipeline(workstreamSlug, {
          name: pipelineName.trim(),
          description: pipelineDescription.trim() || undefined,
          steps,
          is_active: setAsActive,
        });
        if (!result.success) {
          setError(result.error || "Failed to create pipeline");
          setSaving(false);
          return;
        }
      }

      router.push(`/admin/workstreams/${workstreamSlug}/pipelines`);
    } catch {
      setError("An unexpected error occurred");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/workstreams/${workstreamSlug}/pipelines`}
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
                {isEditing ? "Edit Pipeline" : "Create Pipeline"}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {displayName} workstream
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-5xl">
        {/* Pipeline Details */}
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Pipeline Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder="e.g., Full Lead Enrichment"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={pipelineDescription}
                  onChange={(e) => setPipelineDescription(e.target.value)}
                  placeholder="e.g., Complete enrichment flow"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="setActive"
                checked={setAsActive}
                onChange={(e) => setSetAsActive(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300"
              />
              <Label htmlFor="setActive" className="text-sm font-normal cursor-pointer">
                Set as active default for this workstream
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Available Workflows */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Available Workflows</CardTitle>
              <CardDescription>Click to add to pipeline</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {workflows.length === 0 ? (
                <p className="text-sm text-zinc-500 py-6 text-center">
                  No workflows available.{" "}
                  <Link href={`/admin/workstreams/${workstreamSlug}/workflows`} className="text-blue-600 hover:underline">
                    Create one first
                  </Link>
                </p>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {workflows.map((workflow) => {
                    const isAdded = steps.includes(workflow.slug);
                    return (
                      <button
                        key={workflow.slug}
                        onClick={() => addStep(workflow.slug)}
                        disabled={isAdded}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          isAdded
                            ? "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 opacity-50"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                            {workflow.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              workflow.type === "SYNC"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                            }`}
                          >
                            {workflow.type}
                          </span>
                        </div>
                        <code className="text-xs text-zinc-400 font-mono">{workflow.slug}</code>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Steps */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                Pipeline Steps
                {steps.length > 0 && (
                  <span className="ml-2 text-zinc-400 font-normal">({steps.length})</span>
                )}
              </CardTitle>
              <CardDescription>Drag or use arrows to reorder</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {steps.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg p-10 text-center min-h-[200px] flex items-center justify-center">
                  <p className="text-sm text-zinc-500">
                    No steps added yet. Click workflows on the left to add them.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((slug, index) => {
                    const workflow = getWorkflowBySlug(slug);
                    return (
                      <div
                        key={`${slug}-${index}`}
                        className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                      >
                        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 block truncate">
                            {workflow?.name || slug}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => moveStep(index, "up")}
                            disabled={index === 0}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
                          </button>
                          <button
                            onClick={() => moveStep(index, "down")}
                            disabled={index === steps.length - 1}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                          </button>
                          <button
                            onClick={() => removeStep(index)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 rounded ml-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <Link href={`/admin/workstreams/${workstreamSlug}/pipelines`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={saving || !pipelineName.trim() || steps.length === 0}
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Pipeline"}
          </Button>
        </div>
      </main>
    </div>
  );
}
