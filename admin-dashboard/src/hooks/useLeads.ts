import { useState, useEffect, useCallback } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { Lead, FilterState } from '@/types';

export function useLeads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Distinct values for filters
    const [industries, setIndustries] = useState<string[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);
    const [revenueRanges, setRevenueRanges] = useState<string[]>([]);
    const [fundingRanges, setFundingRanges] = useState<string[]>([]);

    const fetchLeads = useCallback(async (filters?: FilterState) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('final_leads')
                .select('*');

            if (filters) {
                if (filters.industries.length > 0) {
                    query = query.in('company_industry', filters.industries);
                }
                if (filters.sizes.length > 0) {
                    query = query.in('company_size_bucket', filters.sizes);
                }
                if (filters.revenueRanges.length > 0) {
                    query = query.in('company_revenue_range', filters.revenueRanges);
                }
                if (filters.fundingRanges.length > 0) {
                    query = query.in('company_funding_range', filters.fundingRanges);
                }
                if (filters.isNewInRole) {
                    query = query.eq('is_new_in_role', true);
                }
                if (filters.isWorkedAtCustomer) {
                    query = query.eq('is_worked_at_customer', true);
                }
                if (filters.isRecentlyFunded) {
                    query = query.eq('is_recently_funded', true);
                }
                if (filters.titleSearch) {
                    query = query.ilike('person_title', `%${filters.titleSearch}%`);
                }
                if (filters.searchQuery) {
                    // Complex OR condition for text search across multiple fields
                    // Note: Supabase/PostgREST syntax for OR is a bit tricky with ILIKE across columns.
                    // Using .or() with ilike syntax.
                    const search = filters.searchQuery;
                    query = query.or(`person_full_name.ilike.%${search}%,company_name.ilike.%${search}%,company_domain.ilike.%${search}%`);
                }
            }

            const { data, error: err } = await query;

            if (err) throw err;
            setLeads(data || []);

        } catch (err: any) {
            console.error('Error fetching leads:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMetadata = useCallback(async () => {
        try {
            // Fetch distinct values for filters. 
            // Note: Supabase doesn't support SELECT DISTINCT nicely in client without a function or grouping tricks usually,
            // but for small datasets we can fetch specific columns and dedup in JS, 
            // or attempt .select('company_industry').

            // However, standard strategy for dynamic filters: fetch all unique values.

            const { data: allData, error } = await supabase
                .from('final_leads')
                .select('company_industry, company_size_bucket, company_revenue_range, company_funding_range');

            if (error) throw error;

            if (allData) {
                const ind = Array.from(new Set(allData.map(d => d.company_industry).filter(Boolean))) as string[];
                const siz = Array.from(new Set(allData.map(d => d.company_size_bucket).filter(Boolean))) as string[];
                const rev = Array.from(new Set(allData.map(d => d.company_revenue_range).filter(Boolean))) as string[];
                const fund = Array.from(new Set(allData.map(d => d.company_funding_range).filter(Boolean))) as string[];

                setIndustries(ind.sort());
                setSizes(siz.sort()); // Ideally custom sort order for ranges
                setRevenueRanges(rev.sort());
                setFundingRanges(fund.sort());
            }

        } catch (err) {
            console.error('Error fetching metadata', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchMetadata();
        fetchLeads();
    }, [fetchMetadata, fetchLeads]);

    return { leads, loading, error, fetchLeads, metadata: { industries, sizes, revenueRanges, fundingRanges } };
}
