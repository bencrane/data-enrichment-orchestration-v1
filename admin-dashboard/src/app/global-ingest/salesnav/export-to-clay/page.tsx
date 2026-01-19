'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface BatchInfo {
  batch_number: number;
  record_count: number;
  sent_count: number;
  status: 'pending' | 'in_progress' | 'completed';
  first_sent: string | null;
  last_sent: string | null;
}

interface BatchStatus {
  total_records: number;
  sent_records: number;
  unsent_records: number;
  batches: BatchInfo[];
  next_batch_number: number;
}

interface BatchConfig {
  webhook_url: string;
}

const BATCH_SIZE = 25000;
const RATE_LIMIT = 9;
const NUM_BATCHES = 10; // Batches 0-9

export default function SalesNavExportToClayPage() {
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Webhook URLs per batch (saved in localStorage)
  const [batchConfigs, setBatchConfigs] = useState<Record<number, BatchConfig>>({});
  
  // Sending state per batch
  const [sendingBatch, setSendingBatch] = useState<number | null>(null);
  const [sendResults, setSendResults] = useState<Record<number, string>>({});

  // Load saved configs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('salesnav_batch_configs');
    if (saved) {
      try {
        setBatchConfigs(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save configs to localStorage
  const saveConfig = (batchNum: number, webhookUrl: string) => {
    const newConfigs = { ...batchConfigs, [batchNum]: { webhook_url: webhookUrl } };
    setBatchConfigs(newConfigs);
    localStorage.setItem('salesnav_batch_configs', JSON.stringify(newConfigs));
  };

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        'https://bencrane--data-enrichment-workers-get-salesnav-batch-status.modal.run',
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (data.success) {
        setStatus(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (e) {
      setError(`Failed to fetch status: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const sendBatch = async (batchNumber: number) => {
    const config = batchConfigs[batchNumber];
    if (!config?.webhook_url?.trim()) {
      setSendResults(prev => ({ ...prev, [batchNumber]: '✗ No webhook URL configured' }));
      return;
    }

    setSendingBatch(batchNumber);
    setSendResults(prev => ({ ...prev, [batchNumber]: '' }));

    try {
      const response = await fetch(
        'https://bencrane--data-enrichment-workers-send-salesnav-batch-to-clay.modal.run',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_number: batchNumber,
            webhook_url: config.webhook_url.trim(),
            batch_size: BATCH_SIZE,
            rate_limit: RATE_LIMIT,
          }),
        }
      );
      const data = await response.json();

      if (data.success) {
        const isTest = data.is_test_batch;
        setSendResults(prev => ({
          ...prev,
          [batchNumber]: isTest
            ? `✓ TEST sent ${data.records_sent} records (no permanent marking)`
            : `✓ Sent ${data.records_sent}/${data.records_fetched} records`
        }));
        setTimeout(fetchStatus, 2000);
      } else {
        setSendResults(prev => ({ ...prev, [batchNumber]: `✗ ${data.error}` }));
      }
    } catch (e) {
      setSendResults(prev => ({ ...prev, [batchNumber]: `✗ ${e}` }));
    } finally {
      setSendingBatch(null);
    }
  };

  const formatNumber = (n: number) => n.toLocaleString();

  // Get batch status from server data
  const getBatchStatus = (batchNum: number): BatchInfo | null => {
    return status?.batches.find(b => b.batch_number === batchNum) || null;
  };

  const getStatusBadge = (batchNum: number) => {
    const batchInfo = getBatchStatus(batchNum);
    if (!batchInfo) {
      return <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-500">Not Started</span>;
    }
    switch (batchInfo.status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded bg-green-900/50 text-green-400">Completed ({batchInfo.sent_count})</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs rounded bg-yellow-900/50 text-yellow-400">In Progress ({batchInfo.sent_count})</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded bg-zinc-700 text-zinc-400">Pending</span>;
    }
  };

  const estimatedTimePerBatch = Math.round(BATCH_SIZE / RATE_LIMIT / 60);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 text-sm text-zinc-500 mb-2">
            <Link href="/" className="hover:text-zinc-300">Dashboard</Link>
            <span>/</span>
            <Link href="/global-ingest" className="hover:text-zinc-300">Global Ingest</Link>
            <span>/</span>
            <Link href="/global-ingest/salesnav" className="hover:text-zinc-300">SalesNav</Link>
            <span>/</span>
            <span className="text-zinc-300">Export to Clay</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Export SalesNav Data to Clay</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-zinc-600 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-zinc-500">Loading batch status...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
            {error}
          </div>
        ) : status && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{formatNumber(status.total_records)}</div>
                <div className="text-sm text-zinc-500">Total Records</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">{formatNumber(status.sent_records)}</div>
                <div className="text-sm text-zinc-500">Sent to Clay</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-amber-400">{formatNumber(status.unsent_records)}</div>
                <div className="text-sm text-zinc-500">Unsent</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-400">{Math.ceil(status.unsent_records / BATCH_SIZE)}</div>
                <div className="text-sm text-zinc-500">Batches Remaining</div>
              </div>
            </div>

            {/* Batch Cards */}
            <div className="space-y-4">
              {Array.from({ length: NUM_BATCHES }, (_, i) => i).map(batchNum => {
                const isTestBatch = batchNum === 0;
                const config = batchConfigs[batchNum];
                const result = sendResults[batchNum];
                const isSending = sendingBatch === batchNum;
                
                return (
                  <div
                    key={batchNum}
                    className={`bg-zinc-900 border rounded-lg p-5 ${
                      isTestBatch ? 'border-amber-700/50' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start gap-6">
                      {/* Batch Info */}
                      <div className="w-32 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xl font-bold ${isTestBatch ? 'text-amber-400' : 'text-white'}`}>
                            Batch #{batchNum}
                          </span>
                        </div>
                        {isTestBatch ? (
                          <div className="text-xs text-amber-500 mt-1">TEST (10 records)</div>
                        ) : (
                          <div className="text-xs text-zinc-500 mt-1">{formatNumber(BATCH_SIZE)} records</div>
                        )}
                        <div className="mt-2">
                          {getStatusBadge(batchNum)}
                        </div>
                      </div>

                      {/* Webhook URL Input */}
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">Clay Webhook URL</label>
                        <input
                          type="text"
                          value={config?.webhook_url || ''}
                          onChange={(e) => saveConfig(batchNum, e.target.value)}
                          placeholder="https://api.clay.com/v3/sources/webhook/..."
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                        {result && (
                          <div className={`mt-2 text-sm ${
                            result.startsWith('✓') ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {result}
                          </div>
                        )}
                      </div>

                      {/* Send Button */}
                      <div className="shrink-0">
                        <button
                          onClick={() => sendBatch(batchNum)}
                          disabled={isSending || !config?.webhook_url?.trim()}
                          className={`px-5 py-2 rounded font-medium transition-colors ${
                            isSending || !config?.webhook_url?.trim()
                              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                              : isTestBatch
                                ? 'bg-amber-600 text-white hover:bg-amber-500'
                                : 'bg-blue-600 text-white hover:bg-blue-500'
                          }`}
                        >
                          {isSending ? (
                            <span className="flex items-center gap-2">
                              <span className="animate-spin h-4 w-4 border-2 border-zinc-400 border-t-white rounded-full"></span>
                              Sending...
                            </span>
                          ) : isTestBatch ? (
                            'Test (10 records)'
                          ) : (
                            'Send Batch'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info */}
            <div className="mt-8 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">How it works</h3>
              <ul className="text-sm text-zinc-500 space-y-1">
                <li>• <strong className="text-amber-400">Batch #0</strong> is a TEST batch — sends only 10 records and does NOT mark them as sent</li>
                <li>• <strong className="text-zinc-300">Batches #1-9</strong> are real batches — send {formatNumber(BATCH_SIZE)} records each at {RATE_LIMIT}/sec (~{estimatedTimePerBatch} min)</li>
                <li>• Webhook URLs are saved in your browser — configure once, send anytime</li>
                <li>• Each batch can go to a different Clay table by using different webhook URLs</li>
                <li>• Real batches mark records with <code className="text-zinc-400">sent_to_clay_at</code> timestamp</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
