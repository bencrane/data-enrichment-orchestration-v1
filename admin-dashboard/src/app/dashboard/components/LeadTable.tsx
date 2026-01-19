import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import { Linkedin, ExternalLink, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

interface LeadTableProps {
    leads: Lead[];
    onSelectLead: (lead: Lead) => void;
    selectedLeadId?: string;
}

type SortField = 'person_full_name' | 'company_name' | 'person_title' | 'company_industry' | 'company_size_bucket';

export function LeadTable({ leads, onSelectLead, selectedLeadId }: LeadTableProps) {
    const [sortField, setSortField] = useState<SortField>('person_full_name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const sortedLeads = [...leads].sort((a, b) => {
        const valA = (a[sortField] || '').toString().toLowerCase();
        const valB = (b[sortField] || '').toString().toLowerCase();

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const Th = ({ field, children, className }: { field: SortField, children: React.ReactNode, className?: string }) => (
        <th
            className={cn(
                "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 hover:bg-[#151515] transition-colors select-none",
                className
            )}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortField === field && (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                )}
            </div>
        </th>
    );

    return (
        <div className="w-full overflow-auto bg-[#0a0a0a]">
            <table className="w-full border-collapse text-left whitespace-nowrap">
                <thead className="bg-[#0a0a0a] border-b border-gray-800 sticky top-0 z-10">
                    <tr>
                        <Th field="person_full_name" className="pl-6 w-1/5">Person</Th>
                        <Th field="person_title" className="w-1/5">Title</Th>
                        <Th field="company_name" className="w-1/5">Company</Th>
                        <Th field="company_industry" className="w-1/6">Industry</Th>
                        <Th field="company_size_bucket" className="w-1/6">Size</Th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Signals</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {sortedLeads.map((lead) => (
                        <tr
                            key={lead.id}
                            onClick={() => onSelectLead(lead)}
                            className={cn(
                                "group hover:bg-[#111] cursor-pointer transition-colors border-l-2",
                                selectedLeadId === lead.id
                                    ? "bg-[#111] border-l-blue-500"
                                    : "bg-[#0a0a0a] border-l-transparent"
                            )}
                        >
                            <td className="px-4 py-3 pl-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <span className={cn("text-sm font-medium", selectedLeadId === lead.id ? "text-blue-400" : "text-gray-200")}>
                                            {lead.person_full_name}
                                        </span>
                                        {lead.person_linkedin_url && (
                                            <a
                                                href={lead.person_linkedin_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-[10px] text-gray-600 hover:text-[#0077b5] flex items-center gap-1 mt-0.5"
                                            >
                                                <Linkedin className="h-3 w-3" />
                                                LinkedIn
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3 max-w-[200px] truncate text-sm text-gray-400" title={lead.person_title || ''}>
                                {lead.person_title}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {lead.company_logo_url && (
                                        <img src={lead.company_logo_url} alt="" className="h-4 w-4 rounded-sm object-contain bg-white/10" />
                                    )}
                                    <span className="text-sm text-gray-300">{lead.company_name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                                {lead.company_industry}
                            </td>
                            <td className="px-4 py-3">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-900 border border-gray-800 text-gray-400">
                                    {lead.company_size_bucket}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex gap-1.5">
                                    {lead.is_new_in_role && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/20 text-green-400 border border-green-900/30" title="New in Role">
                                            New
                                        </span>
                                    )}
                                    {lead.is_worked_at_customer && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/20 text-blue-400 border border-blue-900/30" title="Former Customer">
                                            Alumni
                                        </span>
                                    )}
                                    {lead.is_recently_funded && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-900/20 text-purple-400 border border-purple-900/30" title="Recently Funded">
                                            $$$
                                        </span>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {sortedLeads.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                                No leads found matching your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
