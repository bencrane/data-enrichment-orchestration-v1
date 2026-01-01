"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  EnrichmentWorkflow,
  getActiveWorkstreams,
  DataIngestionWorkstream,
} from "@/app/actions";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "_")
    .replace(/^-+|-+$/g, "");
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [workstreams, setWorkstreams] = useState<DataIngestionWorkstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<EnrichmentWorkflow | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [type, setType] = useState<"SYNC" | "ASYNC">("SYNC");
  const [description, setDescription] = useState("");
  const [senderFn, setSenderFn] = useState("");
  const [receiverFn, setReceiverFn] = useState("");
  const [workstreamSlug, setWorkstreamSlug] = useState<string>("global");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [workflowData, workstreamData] = await Promise.all([
      getWorkflows(),
      getActiveWorkstreams(),
    ]);
    setWorkflows(workflowData);
    setWorkstreams(workstreamData);
    setLoading(false);
  }

  async function fetchWorkflows() {
    const data = await getWorkflows();
    setWorkflows(data);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited && !editingWorkflow) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(slugify(value));
    setSlugEdited(true);
  }

  function resetForm() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setType("SYNC");
    setDescription("");
    setSenderFn("");
    setReceiverFn("");
    setWorkstreamSlug("global");
    setError(null);
  }

  function openEditModal(workflow: EnrichmentWorkflow) {
    setEditingWorkflow(workflow);
    setName(workflow.name);
    setSlug(workflow.slug);
    setType(workflow.type);
    setDescription(workflow.description || "");
    setSenderFn(workflow.modal_sender_fn || "");
    setReceiverFn(workflow.modal_receiver_fn || "");
    setError(null);
  }

  function closeModal() {
    setShowCreateForm(false);
    setEditingWorkflow(null);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError("Name and Slug are required");
      return;
    }

    if (!senderFn.trim()) {
      setError("Sender function name is required");
      return;
    }
    if (type === "ASYNC" && !receiverFn.trim()) {
      setError("Receiver function name is required for ASYNC workflows");
      return;
    }

    setSaving(true);
    setError(null);

    if (editingWorkflow) {
      // Update existing
      const result = await updateWorkflow(editingWorkflow.slug, {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        modal_sender_fn: senderFn.trim(),
        modal_receiver_fn: type === "ASYNC" ? receiverFn.trim() : undefined,
      });

      if (result.success) {
        closeModal();
        await fetchWorkflows();
      } else {
        setError(result.error || "Failed to update workflow");
      }
    } else {
      // Create new
      const result = await createWorkflow({
        name: name.trim(),
        slug: slug.trim(),
        type,
        description: description.trim() || undefined,
        modal_sender_fn: senderFn.trim(),
        modal_receiver_fn: type === "ASYNC" ? receiverFn.trim() : undefined,
      });

      if (result.success) {
        closeModal();
        await fetchWorkflows();
      } else {
        setError(result.error || "Failed to create workflow");
      }
    }

    setSaving(false);
  }

  async function handleDelete(workflowSlug: string) {
    if (!confirm(`Delete workflow "${workflowSlug}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(workflowSlug);
    const result = await deleteWorkflow(workflowSlug);

    if (result.success) {
      await fetchWorkflows();
    } else {
      alert(`Failed to delete: ${result.error}`);
    }

    setDeleting(null);
  }

  const isModalOpen = showCreateForm || editingWorkflow !== null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
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
                  Workflow Registry
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Register and manage enrichment workflows
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
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
                className="mr-2"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Register Workflow
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Create/Edit Form Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingWorkflow ? "Edit Workflow" : "Register New Workflow"}
                </CardTitle>
                <CardDescription>
                  {editingWorkflow
                    ? "Update workflow configuration"
                    : "Add a new enrichment workflow to the registry"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Clay Waterfall v1"
                      autoFocus
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="clay_waterfall_v1"
                      disabled={!!editingWorkflow}
                      className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      {editingWorkflow
                        ? "Slug cannot be changed after creation"
                        : "Used in blueprints to reference this workflow"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Type *
                    </label>
                    <Select value={type} onValueChange={(v) => setType(v as "SYNC" | "ASYNC")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SYNC">SYNC - Synchronous</SelectItem>
                        <SelectItem value="ASYNC">ASYNC - Asynchronous</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-zinc-500 mt-1">
                      SYNC: Immediate response. ASYNC: Callback-based.
                    </p>
                  </div>

                  {/* Modal Function Names */}
                  <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Modal Function Mapping
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        {type === "SYNC" ? "Run Function Name *" : "Sender Function Name *"}
                      </label>
                      <input
                        type="text"
                        value={senderFn}
                        onChange={(e) => setSenderFn(e.target.value)}
                        placeholder={type === "SYNC" ? "run_normalization" : "start_clay_request"}
                        className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        {type === "SYNC"
                          ? "The Modal function that runs and returns immediately"
                          : "The Modal function that initiates the async work"}
                      </p>
                    </div>
                    {type === "ASYNC" && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Receiver Function Name *
                        </label>
                        <input
                          type="text"
                          value={receiverFn}
                          onChange={(e) => setReceiverFn(e.target.value)}
                          placeholder="receive_clay_callback"
                          className="w-full px-3 py-2 font-mono text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                          The Modal function that receives the callback/webhook
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this workflow does..."
                      rows={3}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={saving} className="flex-1">
                      {saving
                        ? "Saving..."
                        : editingWorkflow
                        ? "Save Changes"
                        : "Register Workflow"}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Workflow List - No card wrapper */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Registered Workflows
          </h2>
          <p className="text-sm text-zinc-500">
            Available enrichment workflows that can be used in batch blueprints
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-zinc-500">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-zinc-500 mb-4">No workflows registered yet</p>
            <Button onClick={() => setShowCreateForm(true)}>
              Register Your First Workflow
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left py-3 px-4 font-medium text-zinc-500 text-sm">
                  Name
                </th>
                <th className="text-left py-3 px-4 font-medium text-zinc-500 text-sm">
                  Slug
                </th>
                <th className="text-left py-3 px-4 font-medium text-zinc-500 text-sm">
                  Type
                </th>
                <th className="text-left py-3 px-4 font-medium text-zinc-500 text-sm">
                  Functions
                </th>
                <th className="text-left py-3 px-4 font-medium text-zinc-500 text-sm">
                  Created
                </th>
                <th className="text-right py-3 px-4 font-medium text-zinc-500 text-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr
                  key={workflow.slug}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-4 px-4">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {workflow.name}
                    </div>
                    {workflow.description && (
                      <div className="text-xs text-zinc-500 mt-1 max-w-[200px] truncate">
                        {workflow.description}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">
                      {workflow.slug}
                    </code>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        workflow.type === "SYNC"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      }`}
                    >
                      {workflow.type}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      {workflow.modal_sender_fn && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">
                            {workflow.type === "SYNC" ? "run:" : "send:"}
                          </span>
                          <code className="text-xs font-mono text-green-600 dark:text-green-400">
                            {workflow.modal_sender_fn}
                          </code>
                        </div>
                      )}
                      {workflow.type === "ASYNC" && workflow.modal_receiver_fn && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">recv:</span>
                          <code className="text-xs font-mono text-orange-600 dark:text-orange-400">
                            {workflow.modal_receiver_fn}
                          </code>
                        </div>
                      )}
                      {!workflow.modal_sender_fn && (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-zinc-500 text-sm">
                    {new Date(workflow.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(workflow)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(workflow.slug)}
                      disabled={deleting === workflow.slug}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {deleting === workflow.slug ? "..." : "Delete"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
