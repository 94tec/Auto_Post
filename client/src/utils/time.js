export const toMs = (ts) => {
    if (!ts) return 0;
    if (ts?.toDate)    return ts.toDate().getTime();
    if (ts?._seconds)  return ts._seconds * 1000;
    if (ts?.seconds)   return ts.seconds * 1000;
    const d = new Date(ts);
    return isNaN(d) ? 0 : d.getTime();
};