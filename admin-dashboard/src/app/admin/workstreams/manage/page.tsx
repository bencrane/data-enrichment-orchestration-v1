"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDataIngestionWorkstreams,
  createDataIngestionWorkstream,
  updateDataIngestionWorkstream,
  deleteDataIngestionWorkstream,
  DataIngestionWorkstream,
  CreateWorkstreamInput,
} from "@/app/actions";

export default function WorkstreamsPage() {
  const router = useRouter();
  const [workstreams, setWorkstreams] = useState<DataIngestionWorkstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedWorkstream, setSelectedWorkstream] =
    useState<DataIngestionWorkstream | null>(null);
  const [formData, setFormData] = useState<CreateWorkstreamInput>({
    slug: "",
    name: "",
    description: "",
    icon: "",
    color: "",
    table_name: "",
    route_path: "",
    is_active: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkstreams();
  }, []);

  async function loadWorkstreams() {
    setLoading(true);
    const data = await getDataIngestionWorkstreams();
    setWorkstreams(data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      slug: "",
      name: "",
      description: "",
      icon: "",
      color: "",
      table_name: "",
      route_path: "",
      is_active: true,
    });
    setError(null);
  }

  function openCreate() {
    resetForm();
    setIsCreateOpen(true);
  }

  function openEdit(workstream: DataIngestionWorkstream) {
    setSelectedWorkstream(workstream);
    setFormData({
      slug: workstream.slug,
      name: workstream.name,
      description: workstream.description || "",
      icon: workstream.icon || "",
      color: workstream.color || "",
      table_name: workstream.table_name || "",
      route_path: workstream.route_path || "",
      is_active: workstream.is_active,
    });
    setError(null);
    setIsEditOpen(true);
  }

  function openDelete(workstream: DataIngestionWorkstream) {
    setSelectedWorkstream(workstream);
    setIsDeleteOpen(true);
  }

  async function handleCreate() {
    if (!formData.slug || !formData.name) {
      setError("Slug and Name are required");
      return;
    }

    setSaving(true);
    const result = await createDataIngestionWorkstream(formData);
    setSaving(false);

    if (result.success) {
      setIsCreateOpen(false);
      loadWorkstreams();
    } else {
      setError(result.error || "Failed to create workstream");
    }
  }

  async function handleUpdate() {
    if (!selectedWorkstream) return;

    if (!formData.name) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    const { slug, ...updateData } = formData;
    const result = await updateDataIngestionWorkstream(
      selectedWorkstream.slug,
      updateData
    );
    setSaving(false);

    if (result.success) {
      setIsEditOpen(false);
      loadWorkstreams();
    } else {
      setError(result.error || "Failed to update workstream");
    }
  }

  async function handleDelete() {
    if (!selectedWorkstream) return;

    setSaving(true);
    const result = await deleteDataIngestionWorkstream(selectedWorkstream.slug);
    setSaving(false);

    if (result.success) {
      setIsDeleteOpen(false);
      loadWorkstreams();
    } else {
      setError(result.error || "Failed to delete workstream");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/workstreams"
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
                Manage Workstreams
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Register and configure data ingestion workstreams
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Registered Workstreams</CardTitle>
              <CardDescription>
                {workstreams.length} workstream
                {workstreams.length !== 1 ? "s" : ""} registered
              </CardDescription>
            </div>
            <Button onClick={openCreate}>+ Register Workstream</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-zinc-500">Loading...</div>
            ) : workstreams.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                No workstreams registered yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workstreams.map((ws) => (
                    <TableRow
                      key={ws.slug}
                      className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        router.push(`/admin/workstreams/${ws.slug}`);
                      }}
                    >
                      <TableCell>{ws.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {ws.slug}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-zinc-500">
                        {ws.table_name || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-zinc-500">
                        {ws.route_path || "-"}
                      </TableCell>
                      <TableCell>
                        {ws.color ? (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${ws.color}-100 text-${ws.color}-700 dark:bg-${ws.color}-900/30 dark:text-${ws.color}-400`}
                          >
                            {ws.color}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            ws.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {ws.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(ws);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(ws);
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Workstream</DialogTitle>
            <DialogDescription>
              Add a new data ingestion workstream to the registry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (unique identifier) *</Label>
              <Input
                id="slug"
                placeholder="e.g., linkedin_sales_nav"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display Name *</Label>
              <Input
                id="name"
                placeholder="e.g., LinkedIn Sales Navigator"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this workstream"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="table_name">Table Name</Label>
                <Input
                  id="table_name"
                  placeholder="e.g., client_linkedin_data"
                  value={formData.table_name}
                  onChange={(e) =>
                    setFormData({ ...formData, table_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="route_path">Route Path</Label>
                <Input
                  id="route_path"
                  placeholder="e.g., linkedin-data"
                  value={formData.route_path}
                  onChange={(e) =>
                    setFormData({ ...formData, route_path: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  placeholder="e.g., linkedin"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData({ ...formData, icon: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="e.g., blue"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Workstream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Workstream</DialogTitle>
            <DialogDescription>
              Update workstream: {selectedWorkstream?.slug}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-table_name">Table Name</Label>
                <Input
                  id="edit-table_name"
                  value={formData.table_name}
                  onChange={(e) =>
                    setFormData({ ...formData, table_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-route_path">Route Path</Label>
                <Input
                  id="edit-route_path"
                  value={formData.route_path}
                  onChange={(e) =>
                    setFormData({ ...formData, route_path: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-icon">Icon</Label>
                <Input
                  id="edit-icon"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData({ ...formData, icon: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Input
                  id="edit-color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Workstream</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedWorkstream?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
