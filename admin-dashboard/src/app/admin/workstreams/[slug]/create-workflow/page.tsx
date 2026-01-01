"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkflow } from "@/app/actions";

export default function CreateWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const workstreamSlug = params.slug as string;

  const displayName = workstreamSlug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Form state
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"SYNC" | "ASYNC">("SYNC");
  const [modalSenderFn, setModalSenderFn] = useState("");
  const [modalReceiverFn, setModalReceiverFn] = useState("");
  const [requiresClay, setRequiresClay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    const generatedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_");
    setSlug(generatedSlug);
  }, [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createWorkflow({
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      modal_sender_fn: modalSenderFn.trim() || undefined,
      modal_receiver_fn: type === "ASYNC" ? modalReceiverFn.trim() || undefined : undefined,
      workstream_slug: workstreamSlug,
      requires_clay: requiresClay,
    });

    if (result.success) {
      router.push(`/admin/workstreams/${workstreamSlug}/workflows`);
    } else {
      setError(result.error || "Failed to create workflow");
      setSaving(false);
    }
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
                Create New Enrichment Workflow
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {displayName} workstream
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
            <CardDescription>
              Define a new enrichment workflow for the {displayName} workstream
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Enrich Person via Waterfall in Clay"
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g., enrich_person_via_waterfall_in_clay"
                  className="font-mono"
                />
                <p className="text-xs text-zinc-500">
                  Auto-generated from name. Used as unique identifier.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this workflow does"
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "SYNC" | "ASYNC")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="SYNC">SYNC - Immediate response</option>
                  <option value="ASYNC">ASYNC - Webhook callback</option>
                </select>
                <p className="text-xs text-zinc-500">
                  SYNC workflows return results immediately. ASYNC workflows use webhooks for results.
                </p>
              </div>

              {/* Requires Clay Checkbox */}
              <div className="flex items-center gap-3 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <input
                  type="checkbox"
                  id="requiresClay"
                  checked={requiresClay}
                  onChange={(e) => setRequiresClay(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300"
                />
                <div>
                  <Label htmlFor="requiresClay" className="cursor-pointer font-medium">
                    Requires Clay
                  </Label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Check if this workflow requires a Clay webhook URL to be configured per client
                  </p>
                </div>
              </div>

              {/* Modal Sender Function */}
              <div className="space-y-2">
                <Label htmlFor="modalSenderFn">
                  {type === "SYNC" ? "Modal Run Function" : "Modal Sender Function"} (optional)
                </Label>
                <Input
                  id="modalSenderFn"
                  value={modalSenderFn}
                  onChange={(e) => setModalSenderFn(e.target.value)}
                  placeholder="e.g., run_enrichment"
                  className="font-mono"
                />
                <p className="text-xs text-zinc-500">
                  The Modal function name to execute this workflow
                </p>
              </div>

              {/* Modal Receiver Function (only for ASYNC) */}
              {type === "ASYNC" && (
                <div className="space-y-2">
                  <Label htmlFor="modalReceiverFn">Modal Receiver Function (optional)</Label>
                  <Input
                    id="modalReceiverFn"
                    value={modalReceiverFn}
                    onChange={(e) => setModalReceiverFn(e.target.value)}
                    placeholder="e.g., receive_enrichment_callback"
                    className="font-mono"
                  />
                  <p className="text-xs text-zinc-500">
                    The Modal function that receives webhook callbacks
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <Link href={`/admin/workstreams/${workstreamSlug}`}>
                  <Button variant="ghost" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Workflow"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
