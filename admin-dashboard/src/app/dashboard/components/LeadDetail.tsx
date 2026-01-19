import { Lead } from '@/types';
import { X, Linkedin, ExternalLink, Building2, MapPin, Users, DollarSign, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface LeadDetailProps {
    lead: Lead | null;
    onClose: () => void;
}

export function LeadDetail({ lead, onClose }: LeadDetailProps) {
    if (!lead) return null;

    return (
        <div className="w-[400px] border-l border-gray-800 bg-[#0a0a0a] flex flex-col h-full overflow-hidden shadow-xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-start bg-[#0a0a0a] z-10">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{lead.person_full_name}</h2>
                    <p className="text-sm text-gray-400 mt-1">{lead.person_title}</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-gray-500 hover:text-white hover:bg-gray-800"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-800">

                {/* Actions */}
                <div className="flex gap-3 mb-8">
                    {lead.person_linkedin_url && (
                        <a href={lead.person_linkedin_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button variant="outline" className="w-full bg-[#111] border-gray-700 text-gray-300 hover:text-white hover:border-gray-500">
                                <Linkedin className="mr-2 h-4 w-4 text-[#0077b5]" />
                                LinkedIn
                            </Button>
                        </a>
                    )}
                    {lead.company_website && (
                        <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button variant="outline" className="w-full bg-[#111] border-gray-700 text-gray-300 hover:text-white hover:border-gray-500">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Website
                            </Button>
                        </a>
                    )}
                </div>

                {/* Person Section */}
                <section className="mb-8">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Person Details</h3>

                    <div className="space-y-4">
                        {lead.is_new_in_role && (
                            <div className="bg-green-900/20 border border-green-900/50 rounded p-3 flex items-start gap-3">
                                <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                <div>
                                    <p className="text-green-400 text-sm font-medium">New in Role</p>
                                    {lead.person_current_job_start_date && (
                                        <p className="text-green-500/70 text-xs mt-0.5">Started {lead.person_current_job_start_date}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {lead.person_location && (
                            <div className="flex items-start gap-3 text-sm">
                                <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                                <span className="text-gray-300">{lead.person_location}</span>
                            </div>
                        )}

                        {lead.person_summary && (
                            <div className="text-sm text-gray-400 leading-relaxed border-l-2 border-gray-800 pl-3">
                                {lead.person_summary}
                            </div>
                        )}
                    </div>
                </section>

                {/* Company Section */}
                <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Company Information</h3>

                    <div className="bg-[#111] rounded-lg border border-gray-800 p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            {lead.company_logo_url ? (
                                <img src={lead.company_logo_url} alt={lead.company_name || 'Company'} className="h-10 w-10 rounded bg-white object-contain p-1" />
                            ) : (
                                <div className="h-10 w-10 rounded bg-gray-800 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-gray-500" />
                                </div>
                            )}
                            <div>
                                <h4 className="font-semibold text-white">{lead.company_name}</h4>
                                <a href={lead.company_domain ? `https://${lead.company_domain}` : '#'} target="_blank" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                    {lead.company_domain}
                                </a>
                            </div>
                        </div>

                        {lead.company_description && (
                            <p className="text-xs text-gray-400 leading-relaxed">
                                {lead.company_description}
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800/50">
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase mb-0.5">Industry</div>
                                <div className="text-xs text-gray-200">{lead.company_industry}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase mb-0.5">Size</div>
                                <div className="text-xs text-gray-200">{lead.company_size_bucket}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase mb-0.5">Revenue</div>
                                <div className="text-xs text-gray-200">{lead.company_revenue_range || '--'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase mb-0.5">Funding</div>
                                <div className="text-xs text-gray-200">{lead.company_funding_range || '--'}</div>
                            </div>
                        </div>

                        {lead.company_technologies && lead.company_technologies.length > 0 && (
                            <div className="pt-2">
                                <div className="text-[10px] text-gray-500 uppercase mb-2">Technologies</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {lead.company_technologies.slice(0, 8).map(tech => (
                                        <Badge key={tech} variant="secondary" className="text-[10px] bg-gray-800 text-gray-300 hover:bg-gray-700 font-normal px-1.5 py-0">
                                            {tech}
                                        </Badge>
                                    ))}
                                    {lead.company_technologies.length > 8 && (
                                        <span className="text-[10px] text-gray-500 flex items-center">+{lead.company_technologies.length - 8} more</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
}
