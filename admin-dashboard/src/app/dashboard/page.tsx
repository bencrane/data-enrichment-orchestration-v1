"use client"

import { useState, useEffect } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { LeadTable } from '@/app/dashboard/components/LeadTable';
import { LeadDetail } from '@/app/dashboard/components/LeadDetail';
import { FilterPanel } from '@/app/dashboard/components/FilterPanel';
import { SearchBar } from '@/app/dashboard/components/SearchBar';
import { ExportButton } from '@/app/dashboard/components/ExportButton';
import { FilterState, Lead } from '@/types';
import { Loader2 } from 'lucide-react';

const emptyFilters: FilterState = {
    industries: [],
    sizes: [],
    searchQuery: '',
    isNewInRole: false,
    isWorkedAtCustomer: false,
    isRecentlyFunded: false,
    revenueRanges: [],
    fundingRanges: [],
    titleSearch: ''
};

export default function DashboardPage() {
    const [filters, setFilters] = useState<FilterState>(emptyFilters);
    const { leads, loading, error, fetchLeads, metadata } = useLeads();
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // Re-fetch when filters change
    useEffect(() => {
        fetchLeads(filters);
    }, [filters, fetchLeads]);

    // Handle outside click or close of detail panel
    const handleCloseDetail = () => {
        setSelectedLead(null);
    };

    const handleSearch = (query: string) => {
        setFilters(prev => ({ ...prev, searchQuery: query }));
    };

    return (
        <div className="flex h-screen w-full bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden">

            {/* Sidebar Filters */}
            <FilterPanel
                filters={filters}
                setFilters={setFilters}
                metadata={metadata}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Top Header */}
                <header className="flex-shrink-0 border-b border-gray-800 bg-[#0a0a0a] px-6 py-3 flex items-center justify-between z-20">
                    <div className="flex items-center gap-4 flex-1">
                        <SearchBar onSearch={handleSearch} />
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-gray-500 font-medium">
                            {leads.length} Leads Found
                        </div>
                        <ExportButton leads={leads} />
                    </div>
                </header>

                {/* Table Content */}
                <div className="flex-1 overflow-hidden relative flex">
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
                        {error ? (
                            <div className="p-8 text-center text-red-400 text-sm">
                                Error loading leads: {error}
                            </div>
                        ) : (
                            <LeadTable
                                leads={leads}
                                onSelectLead={setSelectedLead}
                                selectedLeadId={selectedLead?.id}
                            />
                        )}
                    </div>

                    {/* Detail Panel Slide-over */}
                    {selectedLead && (
                        <LeadDetail lead={selectedLead} onClose={handleCloseDetail} />
                    )}
                </div>

            </div>
        </div>
    );
}
