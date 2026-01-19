"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getVcPortfolioCompanies, getVcFirmStats } from "@/app/actions";

type VcStat = {
  id: string;
  name: string;
  record_count: number;
  data_quality: "clean" | "bad" | "unknown";
};

type PortfolioCompany = {
  id: string;
  vc_name: string;
  data_quality: "clean" | "bad" | "unknown";
  company_name: string | null;
  website_domain: string | null;
  crunchbase_url: string | null;
  logo_url: string | null;
  status: string | null;
  founded_date: string | null;
  description_short: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  employee_count: string | null;
  linkedin_url: string | null;
  revenue_range: string | null;
  funding_total: string | null;
  equity_funding: string | null;
  categories: string | null;
};

export default function VcPortfolioBrowsePage() {
  const [vcStats, setVcStats] = useState<VcStat[]>([]);
  const [companies, setCompanies] = useState<PortfolioCompany[]>([]);
  const [selectedVc, setSelectedVc] = useState<string>("all");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [statsResult, companiesResult] = await Promise.all([
        getVcFirmStats(),
        getVcPortfolioCompanies(),
      ]);

      if (statsResult.error) {
        setError(statsResult.error);
      } else {
        setVcStats(statsResult.data);
      }

      if (companiesResult.error) {
        setError(companiesResult.error);
      } else {
        setCompanies(companiesResult.data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (selectedVc !== "all" && c.vc_name !== selectedVc) return false;
      if (filterQuality !== "all" && c.data_quality !== filterQuality) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.company_name?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.website_domain?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [companies, selectedVc, filterQuality, searchQuery]);

  const qualityCounts = useMemo(() => {
    const counts = { clean: 0, bad: 0, unknown: 0 };
    companies.forEach((c) => counts[c.data_quality]++);
    return counts;
  }, [companies]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Loading portfolio data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              Home
            </Link>
            <span>/</span>
            <Link href="/global-ingest" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              Global Ingest
            </Link>
            <span>/</span>
            <Link href="/global-ingest/vc-portfolios" className="hover:text-zinc-700 dark:hover:text-zinc-200">
              VC Portfolios
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Browse</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            VC Portfolio Companies
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {companies.length.toLocaleString()} total records
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🟢</span>
              <div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {qualityCounts.clean.toLocaleString()}
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-500">Clean Records</div>
              </div>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔴</span>
              <div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {qualityCounts.bad.toLocaleString()}
                </div>
                <div className="text-sm text-red-600 dark:text-red-500">Bad Records (Malformed)</div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚪</span>
              <div>
                <div className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
                  {qualityCounts.unknown.toLocaleString()}
                </div>
                <div className="text-sm text-zinc-500">Unknown</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* VC Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Filter by VC
              </label>
              <select
                value={selectedVc}
                onChange={(e) => setSelectedVc(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm"
              >
                <option value="all">All VCs ({vcStats.length})</option>
                {vcStats.map((vc) => (
                  <option key={vc.id} value={vc.name}>
                    {vc.data_quality === "clean" ? "🟢 " : vc.data_quality === "bad" ? "🔴 " : "⚪ "}
                    {vc.name} ({vc.record_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Quality Filter */}
            <div className="w-[200px]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Data Quality
              </label>
              <select
                value={filterQuality}
                onChange={(e) => setFilterQuality(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm"
              >
                <option value="all">All</option>
                <option value="clean">🟢 Clean Only</option>
                <option value="bad">🔴 Bad Only</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company name, city, domain..."
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Showing {filteredCompanies.length.toLocaleString()} of {companies.length.toLocaleString()} records
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">VC</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Company</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Website</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Founded</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Description</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">City</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">State</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Country</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Employees</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Revenue</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Total Funding</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Equity Funding</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Categories</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">LinkedIn</th>
                  <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 text-xs">Crunchbase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredCompanies.slice(0, 500).map((company) => (
                  <tr
                    key={company.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      company.data_quality === "bad"
                        ? "bg-red-50/50 dark:bg-red-900/10"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-xs">
                      {company.data_quality === "clean" ? (
                        <span title="Clean data">🟢</span>
                      ) : company.data_quality === "bad" ? (
                        <span title="Malformed data">🔴</span>
                      ) : (
                        <span title="Unknown">⚪</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium text-xs">
                      {company.vc_name}
                    </td>
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100 text-xs">
                      {company.company_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[120px] truncate">
                      {company.website_domain ? (
                        <a href={`https://${company.website_domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {company.website_domain}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.status || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.founded_date || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[200px] truncate" title={company.description_short || ""}>
                      {company.description_short || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[100px] truncate">
                      {company.city || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[80px] truncate">
                      {company.state || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[80px] truncate">
                      {company.country || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.employee_count || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.revenue_range || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.funding_total || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.equity_funding || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[150px] truncate" title={company.categories || ""}>
                      {company.categories || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs max-w-[200px] truncate">
                      {company.linkedin_url ? (
                        <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" title={company.linkedin_url}>
                          {company.linkedin_url}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 text-xs">
                      {company.crunchbase_url ? (
                        <a href={company.crunchbase_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCompanies.length > 500 && (
            <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-500 text-center">
              Showing first 500 of {filteredCompanies.length.toLocaleString()} results. Use filters to narrow down.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

