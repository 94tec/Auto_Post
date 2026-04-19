import { useState, useEffect } from 'react';

export function usePagination(items = [], perPage = 8) {
    const [page, setPage] = useState(1);
    const total = Math.ceil(items.length / perPage);
    const safePage = Math.max(1, Math.min(page, total || 1));
    const from = (safePage - 1) * perPage;

    // auto-clamp if items shrink
    useEffect(() => {
        if (safePage !== page) setPage(safePage);
    }, [safePage]);

    return {
        items:   items.slice(from, from + perPage),
        page:    safePage,
        total:   total || 1,
        count:   items.length,
        from:    items.length === 0 ? 0 : from + 1,
        to:      Math.min(from + perPage, items.length),
        setPage,
        reset:   () => setPage(1),
    };
}