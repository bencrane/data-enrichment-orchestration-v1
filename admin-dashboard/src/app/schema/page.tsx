"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ColumnInfo = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
};

const TABLES = [
  "clients",
  "batches",
  "batch_items",
  "workflow_states",
  "raw_apollo_data",
  "enrichment_registry",
  "enrichment_results",
];

export default function SchemaPage() {
  const [selectedTable, setSelectedTable] = useState<string>("batches");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchSchema() {
      setLoading(true);
      try {
        const res = await fetch(`/api/schema?table=${selectedTable}`);
        const data = await res.json();
        setColumns(data.columns || []);
      } catch (error) {
        console.error("Error fetching schema:", error);
        setColumns([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSchema();
  }, [selectedTable]);

  const formatSchema = () => {
    const lines = columns.map(
      (col) =>
        `${col.column_name}: ${col.udt_name}${col.is_nullable === "YES" ? " (nullable)" : ""}`
    );
    return `Table: ${selectedTable}\n${"─".repeat(40)}\n${lines.join("\n")}`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatSchema());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
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
                Table Schema Viewer
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Inspect database table structures
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex gap-4 mb-6">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {TABLES.map((table) => (
                <SelectItem key={table} value={table}>
                  {table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleCopy} variant="outline">
            {copied ? (
              <>
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
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
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
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Copy Schema
              </>
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">{selectedTable}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-zinc-500 py-8 text-center">Loading...</div>
            ) : columns.length === 0 ? (
              <div className="text-zinc-500 py-8 text-center">
                No columns found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="text-left py-3 px-4 font-medium text-zinc-500">
                        Column
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-zinc-500">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-zinc-500">
                        Nullable
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-zinc-500">
                        Default
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col) => (
                      <tr
                        key={col.column_name}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <td className="py-3 px-4 font-mono text-zinc-900 dark:text-zinc-100">
                          {col.column_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                          {col.udt_name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              col.is_nullable === "YES"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            }`}
                          >
                            {col.is_nullable === "YES" ? "nullable" : "required"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-zinc-500 max-w-[200px] truncate">
                          {col.column_default || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
