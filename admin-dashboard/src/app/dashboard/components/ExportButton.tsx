import { Download } from 'lucide-react';
import Papa from 'papaparse';
import { Lead } from '@/types';
import { Button } from "@/components/ui/button"

interface ExportButtonProps {
    leads: Lead[];
}

export function ExportButton({ leads }: ExportButtonProps) {
    const handleExport = () => {
        const dataToExport = leads.map(lead => ({
            'Full Name': lead.person_full_name,
            'Email': lead.person_email || '',
            'Title': lead.person_title || '',
            'LinkedIn': lead.person_linkedin_url || '',
            'Company': lead.company_name,
            'Domain': lead.company_domain,
            'Industry': lead.company_industry,
            'Size': lead.company_size_bucket,
            'New in Role': lead.is_new_in_role ? 'Yes' : 'No',
            'Former Customer': lead.is_worked_at_customer ? 'Yes' : 'No'
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs bg-[#111] border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            onClick={handleExport}
            disabled={leads.length === 0}
        >
            <Download className="mr-2 h-3 w-3" />
            Export
        </Button>
    );
}
