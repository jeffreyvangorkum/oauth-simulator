'use client';

import { useEffect, useState } from 'react';

export function ClientDate({ date }: { date: string | Date }) {
    const [formattedDate, setFormattedDate] = useState<string>('');

    useEffect(() => {
        setFormattedDate(new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }));
    }, [date]);

    if (!formattedDate) {
        return <span className="text-muted-foreground animate-pulse">...</span>;
    }

    return <span>{formattedDate}</span>;
}
