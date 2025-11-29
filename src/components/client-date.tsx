'use client';

import { useEffect, useState } from 'react';

export function ClientDate({ date }: { date: string | Date }) {
    const [formattedDate, setFormattedDate] = useState<string>('');

    useEffect(() => {
        setFormattedDate(new Date(date).toLocaleString());
    }, [date]);

    if (!formattedDate) {
        return <span className="text-muted-foreground animate-pulse">...</span>;
    }

    return <span>{formattedDate}</span>;
}
