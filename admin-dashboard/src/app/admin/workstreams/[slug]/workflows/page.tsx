"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWorkflowsByWorkstream,
  updateWorkflow,
  deleteWorkflow,
  type EnrichmentWorkflow,
} from "@/app/actions";

export default function ViewWorkflowsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string>("");
  const [workflows, setWorkflows] = useState<EnrichmentWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingWorkflow, setEditingWorkflow] =
    useState<EnrichmentWorkflow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    type: "SYNC" as "SYNC" | "ASYNC",
    modal_sender_fn: "",
    modal_receiver_fn: "",
    requires_clay: true,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingWorkflow, setDeletingWorkflow] =
    useState<EnrichmentWorkflow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { slug: resolvedSlug } = await params;
      setSlug(resolvedSlug);
      const data = await getWorkflowsByWorkstream(resolvedSlug);
      setWorkflows(data);
      setLoading(false);
    }
    loadData();
  }, [params]);

  const displayName = slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const handleEditClick = (workflow: EnrichmentWorkflow) => {
    setEditingWorkflow(workflow);
    setEditForm({
      name: workflow.name,
      description: workflow.description || "",
      type: workflow.type,
      modal_sender_fn: workflow.modal_sender_fn || "",
      modal_receiver_fn: workflow.modal_receiver_fn || "",
      requires_clay: workflow.requires_clay ?? true,
    });
  };

  const handleEditSave = async () => {
    if (!editingWorkflow) return;
    setEditSaving(true);

    const result = await updateWorkflow(editingWorkflow.slug, {
      name: editForm.name,
      description: editForm.description || undefined,
      type: editForm.type,
      modal_sender_fn: editForm.modal_sender_fn || undefined,
      modal_receiver_fn: editForm.modal_receiver_fn || undefined,
      requires_clay: editForm.requires_clay,
    });

    if (result.success && result.workflow) {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.slug === editingWorkflow.slug ? result.workflow! : w
        )
      );
      setEditingWorkflow(null);
    } else {
      alert("Error updating workflow: " + result.error);
    }
    setEditSaving(false);
  };

  const handleDeleteClick = (workflow: EnrichmentWorkflow) => {
    setDeletingWorkflow(workflow);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingWorkflow) return;
    setDeleteLoading(true);

    const result = await deleteWorkflow(deletingWorkflow.slug);

    if (result.success) {
      setWorkflows((prev) =>
        prev.filter((w) => w.slug !== deletingWorkflow.slug)
      );
      setDeletingWorkflow(null);
    } else {
      alert("Error deleting workflow: " + result.error);
    }
    setDeleteLoading(false);
  };

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
              href={`/admin/workstreams/${slug}`}
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
                Existing Enrichment Workflows
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {displayName} workstream
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>
              Workflows assigned to the {displayName} workstream
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workflows.length === 0 ? (
              <p className="text-zinc-500 py-4">
                No workflows assigned to this workstream yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Clay</TableHead>
                    <TableHead>Functions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((workflow) => (
                    <TableRow key={workflow.slug}>
                      <TableCell>
                        <div className="font-medium">{workflow.name}</div>
                        {workflow.description && (
                          <div className="text-xs text-zinc-500 mt-1 max-w-[200px] truncate">
                            {workflow.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">
                          {workflow.slug}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            workflow.type === "SYNC"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          }`}
                        >
                          {workflow.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {workflow.requires_clay ? (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>
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
                          {workflow.type === "ASYNC" &&
                            workflow.modal_receiver_fn && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">
                                  recv:
                                </span>
                                <code className="text-xs font-mono text-orange-600 dark:text-orange-400">
                                  {workflow.modal_receiver_fn}
                                </code>
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm">
                        {new Date(workflow.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(workflow)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => handleDeleteClick(workflow)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingWorkflow}
        onOpenChange={(open) => !open && setEditingWorkflow(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>
              Update the workflow details. The slug cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-slug">Slug (read-only)</Label>
              <Input
                id="edit-slug"
                value={editingWorkflow?.slug || ""}
                disabled
                className="bg-zinc-100 dark:bg-zinc-800"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-type">Type</Label>
              <select
                id="edit-type"
                value={editForm.type}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    type: e.target.value as "SYNC" | "ASYNC",
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="SYNC">SYNC</option>
                <option value="ASYNC">ASYNC</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-sender">
                {editForm.type === "SYNC"
                  ? "Modal Run Function"
                  : "Modal Sender Function"}
              </Label>
              <Input
                id="edit-sender"
                value={editForm.modal_sender_fn}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, modal_sender_fn: e.target.value }))
                }
                placeholder="e.g., my_modal_function"
              />
            </div>
            {editForm.type === "ASYNC" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-receiver">Modal Receiver Function</Label>
                <Input
                  id="edit-receiver"
                  value={editForm.modal_receiver_fn}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      modal_receiver_fn: e.target.value,
                    }))
                  }
                  placeholder="e.g., my_receiver_function"
                />
              </div>
            )}
            <div className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <input
                type="checkbox"
                id="edit-requires-clay"
                checked={editForm.requires_clay}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, requires_clay: e.target.checked }))
                }
                className="w-4 h-4 rounded border-zinc-300"
              />
              <div>
                <Label htmlFor="edit-requires-clay" className="cursor-pointer font-medium text-sm">
                  Requires Clay
                </Label>
                <p className="text-xs text-zinc-500">
                  Requires Clay webhook URL per client
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingWorkflow(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingWorkflow}
        onOpenChange={(open) => !open && setDeletingWorkflow(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingWorkflow?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingWorkflow(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
