const PgBtn = ({ children, onClick, disabled, active }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`min-w-[30px] h-[30px] px-1.5 rounded-[8px] text-[12px] font-medium
      border transition-all duration-150
      ${active
            ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300 font-bold'
            : 'bg-transparent border-white/9 text-white/38 hover:bg-white/6 hover:text-white/65'}
      disabled:opacity-20 disabled:cursor-default`}
    >
        {children}
    </button>
);

export function Pagination({ page, total, count, from, to, onPage }) {
    if (!count || total <= 1) return null;

    const nums = [];
    if (total <= 6) {
        for (let i = 1; i <= total; i++) nums.push(i);
    } else {
        nums.push(1);
        if (page > 3) nums.push('…');
        for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) nums.push(i);
        if (page < total - 2) nums.push('…');
        nums.push(total);
    }

    return (
        <div className="flex items-center justify-between pt-3">
      <span className="text-[11px] text-white/28 tabular-nums">
        {from}–{to} of {count}
      </span>
            <div className="flex items-center gap-1">
                <PgBtn onClick={() => onPage(page - 1)} disabled={page === 1}>‹</PgBtn>
                {nums.map((n, i) =>
                    n === '…'
                        ? <span key={`d${i}`} className="text-[12px] text-white/20 px-1">…</span>
                        : <PgBtn key={n} active={n === page} onClick={() => onPage(n)}>{n}</PgBtn>
                )}
                <PgBtn onClick={() => onPage(page + 1)} disabled={page === total}>›</PgBtn>
            </div>
        </div>
    );
}