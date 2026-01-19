export interface Lead {
    id: string;
    batch_item_id?: string;
    person_id?: string;
    company_id?: string;

    // Person Fields
    person_first_name?: string | null;
    person_last_name?: string | null;
    person_full_name: string;
    person_email?: string | null;
    person_linkedin_url?: string | null;
    person_title?: string | null;
    person_headline?: string | null;
    person_location?: string | null;
    person_summary?: string | null;
    person_current_job_start_date?: string | null;

    // Company Fields
    company_name?: string | null;
    company_domain?: string | null;
    company_linkedin_url?: string | null;
    company_website?: string | null;
    company_logo_url?: string | null;
    company_description?: string | null;
    company_industry?: string | null;
    company_industries?: string[] | null;
    company_subindustries?: string[] | null;
    company_size_bucket?: string | null;
    company_employee_count?: number | null;
    company_city?: string | null;
    company_state?: string | null;
    company_country?: string | null;
    company_revenue_range?: string | null;
    company_funding_range?: string | null;
    company_founded_year?: number | null;
    company_type?: string | null;
    company_business_stage?: string | null;
    company_technologies?: string[] | null;

    // Signal Indicators
    is_new_in_role?: boolean | null;
    is_recently_funded?: boolean | null;
    is_worked_at_customer?: boolean | null;

    created_at?: string;
    updated_at?: string;
}

export interface FilterState {
    industries: string[];
    sizes: string[];
    searchQuery: string;
    isNewInRole: boolean;
    isWorkedAtCustomer: boolean;
    isRecentlyFunded: boolean;
    revenueRanges: string[];
    fundingRanges: string[];
    titleSearch: string;
}
