import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SearchBarProps {
    onSearch: (value: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
    const [value, setValue] = useState('');

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            onSearch(value);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [value, onSearch]);

    return (
        <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-800 rounded-md leading-5 bg-[#0a0a0a] text-gray-300 placeholder-gray-600 focus:outline-none focus:bg-[#111] focus:ring-1 focus:ring-gray-700 focus:border-gray-700 sm:text-sm transition-colors duration-200"
                placeholder="Search people, companies, domains..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
            />
        </div>
    );
}
