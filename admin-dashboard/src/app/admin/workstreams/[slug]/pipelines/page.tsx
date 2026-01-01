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
  getWorkstreamPipelines,
  setActivePipeline,
  deletePipeline,
  EnrichmentPipeline,
} from "@/app/actions";

export default function ViewPipelinesPage() {
  const params = useParams();
  const workstreamSlug = params.slug as string;

  const displayName = workstreamSlug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const [pipelines, setPipelines] = useState<EnrichmentPipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [workstreamSlug]);

  async function fetchData() {
    setLoading(true);
    const data = await getWorkstreamPipelines(workstreamSlug);
    setPipelines(data);
    setLoading(false);
  }

  async function handleSetActive(pipelineId: string) {
    await setActivePipeline(pipelineId, workstreamSlug, null);
    await fetchData();
  }

  async function handleDelete(pipelineId: string) {
    if (!confirm("Are you sure you want to delete this pipeline?")) return;
    await deletePipeline(pipelineId);
    await fetchData();
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
              href={`/admin/workstreams/${workstreamSlug}`}
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
                Saved Pipelines
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {displayName} workstream
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">All Pipelines</CardTitle>
                <CardDescription>
                  {pipelines.length} pipeline{pipelines.length !== 1 ? "s" : ""} saved
                </CardDescription>
              </div>
              <Link href={`/admin/workstreams/${workstreamSlug}/pipelines/configure`}>
                <Button size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                  New Pipeline
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pipelines.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500 mb-4">No pipelines created yet.</p>
                <Link href={`/admin/workstreams/${workstreamSlug}/pipelines/configure`}>
                  <Button variant="outline">Create your first pipeline</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className={`p-4 border rounded-lg ${
                      pipeline.is_active
                        ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {pipeline.name}
                          </span>
                          {pipeline.is_active && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        {pipeline.description && (
                          <p className="text-sm text-zinc-500 mb-2">{pipeline.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {pipeline.steps.map((step, idx) => (
                            <span key={idx} className="inline-flex items-center">
                              <code className="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded">
                                {step}
                              </code>
                              {idx < pipeline.steps.length - 1 && (
                                <span className="mx-1 text-zinc-400">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!pipeline.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActive(pipeline.id)}
                          >
                            Set Active
                          </Button>
                        )}
                        <Link href={`/admin/workstreams/${workstreamSlug}/pipelines/configure?edit=${pipeline.id}`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pipeline.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
