import { FilterState } from '@/types';
import { FilterX, ChevronDown, ChevronRight, Briefcase, Zap, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import * as Collapsible from '@radix-ui/react-collapsible';

// Helper for collapsible sections
const FilterSection = ({
    title,
    icon: Icon,
    children,
    defaultOpen = true,
    count = 0
}: {
    title: string;
    icon: any;
    children: React.ReactNode;
    defaultOpen?: boolean;
    count?: number;
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="mb-4">
            <Collapsible.Trigger className="flex items-center w-full group py-2 px-1 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider transition-colors">
                {isOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                <span className="flex-1 text-left flex items-center gap-2">
                    <Icon className="h-3 w-3" />
                    {title}
                </span>
                {count > 0 && (
                    <span className="bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded text-[10px] min-w-[16px] text-center border border-blue-800/50">
                        {count}
                    </span>
                )}
            </Collapsible.Trigger>
            <Collapsible.Content className="mt-1 space-y-2 pl-3">
                {children}
            </Collapsible.Content>
        </Collapsible.Root>
    );
};

interface FilterPanelProps {
    filters: FilterState;
    setFilters: (filters: FilterState) => void;
    metadata: {
        industries: string[];
        sizes: string[];
        revenueRanges: string[];
        fundingRanges: string[];
    };
}

export function FilterPanel({ filters, setFilters, metadata }: FilterPanelProps) {

    const toggleArrayFilter = (key: keyof FilterState, value: string) => {
        const current = filters[key] as string[];
        const next = current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value];
        setFilters({ ...filters, [key]: next });
    };

    const clearAll = () => {
        setFilters({
            industries: [],
            sizes: [],
            searchQuery: '',
            isNewInRole: false,
            isWorkedAtCustomer: false,
            isRecentlyFunded: false,
            revenueRanges: [],
            fundingRanges: [],
            titleSearch: ''
        });
    };

    const activeCount =
        filters.industries.length +
        filters.sizes.length +
        filters.revenueRanges.length +
        filters.fundingRanges.length +
        (filters.isNewInRole ? 1 : 0) +
        (filters.isWorkedAtCustomer ? 1 : 0) +
        (filters.isRecentlyFunded ? 1 : 0) +
        (filters.titleSearch ? 1 : 0);

    return (
        <div className="w-64 flex-shrink-0 border-r border-gray-800 h-full overflow-y-auto bg-[#0a0a0a] p-4 text-sm">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-medium text-gray-200">Filters</h2>
                {activeCount > 0 && (
                    <button
                        onClick={clearAll}
                        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                    >
                        <FilterX className="h-3 w-3" />
                        Clear
                    </button>
                )}
            </div>

            {/* Signals */}
            <FilterSection title="Signals" icon={Zap} defaultOpen={true}>
                <div className="space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={filters.isNewInRole}
                            onChange={(e) => setFilters({ ...filters, isNewInRole: e.target.checked })}
                            className="mt-0.5 rounded border-gray-700 bg-[#111] checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                        />
                        <span className="text-gray-400 group-hover:text-gray-200 transition-colors">New in Role</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={filters.isWorkedAtCustomer}
                            onChange={(e) => setFilters({ ...filters, isWorkedAtCustomer: e.target.checked })}
                            className="mt-0.5 rounded border-gray-700 bg-[#111] checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                        />
                        <span className="text-gray-400 group-hover:text-gray-200 transition-colors">Former Customer</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={filters.isRecentlyFunded}
                            onChange={(e) => setFilters({ ...filters, isRecentlyFunded: e.target.checked })}
                            className="mt-0.5 rounded border-gray-700 bg-[#111] checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                        />
                        <span className="text-gray-400 group-hover:text-gray-200 transition-colors">Recently Funded</span>
                    </label>
                </div>
            </FilterSection>

            {/* Company Filters */}
            <FilterSection title="Company" icon={Briefcase} defaultOpen={true} count={filters.industries.length + filters.sizes.length}>
                {/* Industries */}
                <div className="mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-2 uppercase">Industry</div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-800">
                        {metadata.industries.map(ind => (
                            <label key={ind} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filters.industries.includes(ind)}
                                    onChange={() => toggleArrayFilter('industries', ind)}
                                    className="rounded border-gray-700 bg-[#111] checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:ring-offset-0 h-3 w-3"
                                />
                                <span className="text-gray-400 group-hover:text-gray-200 truncate text-xs">{ind}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Size */}
                <div className="mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-2 uppercase">Size</div>
                    <div className="space-y-1.5">
                        {metadata.sizes.map(size => (
                            <label key={size} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filters.sizes.includes(size)}
                                    onChange={() => toggleArrayFilter('sizes', size)}
                                    className="rounded border-gray-700 bg-[#111] checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:ring-offset-0 h-3 w-3"
                                />
                                <span className="text-gray-400 group-hover:text-gray-200 truncate text-xs">{size}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </FilterSection>

            <FilterSection title="Person" icon={User} defaultOpen={true}>
                <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 mb-1 uppercase">Title Search</div>
                    <input
                        type="text"
                        value={filters.titleSearch}
                        onChange={(e) => setFilters({ ...filters, titleSearch: e.target.value })}
                        placeholder="e.g. Founder, VP"
                        className="w-full bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                    />
                </div>
            </FilterSection>

        </div>
    );
}
