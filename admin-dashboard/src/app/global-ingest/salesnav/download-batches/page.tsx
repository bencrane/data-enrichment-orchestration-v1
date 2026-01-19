'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSalesNavBatchInfo, downloadSalesNavBatchAsCsv } from '@/app/actions';

export default function DownloadSalesNavBatchesPage() {
  const [batchInfo, setBatchInfo] = useState<{
    total_records: number;
    total_batches: number;
    batch_size: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingBatch, setDownloadingBatch] = useState<number | null>(null);
  const [downloadResults, setDownloadResults] = useState<Record<number, string>>({});

  useEffect(() => {
    async function fetchInfo() {
      const info = await getSalesNavBatchInfo();
      setBatchInfo(info);
      setLoading(false);
    }
    fetchInfo();
  }, []);

  const handleDownload = async (batchNumber: number) => {
    setDownloadingBatch(batchNumber);
    setDownloadResults(prev => ({ ...prev, [batchNumber]: '' }));

    try {
      const result = await downloadSalesNavBatchAsCsv(batchNumber);

      if (result.success && result.csv) {
        // Create blob and trigger download
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || `batch_${batchNumber}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setDownloadResults(prev => ({
          ...prev,
          [batchNumber]: `✓ Downloaded ${result.record_count?.toLocaleString()} records`
        }));
      } else {
        setDownloadResults(prev => ({
          ...prev,
          [batchNumber]: `✗ ${result.error}`
        }));
      }
    } catch (e) {
      setDownloadResults(prev => ({
        ...prev,
        [batchNumber]: `✗ ${e}`
      }));
    } finally {
      setDownloadingBatch(null);
    }
  };

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 text-sm text-zinc-500 mb-2">
            <Link href="/" className="hover:text-zinc-300">Dashboard</Link>
            <span>/</span>
            <Link href="/global-ingest" className="hover:text-zinc-300">Global Ingest</Link>
            <span>/</span>
            <span className="text-zinc-300">Download SalesNav Batches</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Download SalesNav Batches</h1>
          <p className="text-sm text-zinc-500 mt-1">Download records as CSV files (10,000 per batch)</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-zinc-600 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-zinc-500">Loading...</p>
          </div>
        ) : batchInfo && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{formatNumber(batchInfo.total_records)}</div>
                <div className="text-sm text-zinc-500">Total Records</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-400">{batchInfo.total_batches}</div>
                <div className="text-sm text-zinc-500">Total Batches</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-zinc-400">{formatNumber(batchInfo.batch_size)}</div>
                <div className="text-sm text-zinc-500">Records per Batch</div>
              </div>
            </div>

            {/* Batch List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-white">Batches</h2>
              </div>
              
              <div className="divide-y divide-zinc-800">
                {Array.from({ length: batchInfo.total_batches }, (_, i) => {
                  const isLastBatch = i === batchInfo.total_batches - 1;
                  const recordsInBatch = isLastBatch
                    ? batchInfo.total_records - (i * batchInfo.batch_size)
                    : batchInfo.batch_size;
                  const isDownloading = downloadingBatch === i;
                  const result = downloadResults[i];

                  return (
                    <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-800/30">
                      <div>
                        <div className="font-medium text-white">Batch #{i}</div>
                        <div className="text-sm text-zinc-500">
                          {formatNumber(recordsInBatch)} records
                          <span className="mx-2">•</span>
                          Rows {formatNumber(i * batchInfo.batch_size + 1)} - {formatNumber(i * batchInfo.batch_size + recordsInBatch)}
                        </div>
                        {result && (
                          <div className={`text-sm mt-1 ${
                            result.startsWith('✓') ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {result}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDownload(i)}
                        disabled={isDownloading}
                        className={`px-4 py-2 rounded font-medium transition-colors ${
                          isDownloading
                            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-500'
                        }`}
                      >
                        {isDownloading ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-zinc-400 border-t-white rounded-full"></span>
                            Downloading...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
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
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" x2="12" y1="15" y2="3" />
                            </svg>
                            Download CSV
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

