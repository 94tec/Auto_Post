/**
 * AlertsPanel.jsx
 * ─────────────────────────────────────────────────────────────
 * Drop-in alerts & notifications pane for admin panels.
 *
 * DEPENDENCIES:
 *   npm install framer-motion   (optional – gracefully degrades)
 *
 * USAGE:
 *   import AlertsPane from './components/AlertsPane';
 *
 *   <AlertsPane />                          ← mock data
 *   <AlertsPane alerts={alerts}
 *               onDismiss={id => ...}
 *               onAction={(id, action) => ...} />
 *
 * ALERT SHAPE:
 *   {
 *     id:        string | number,           // unique key
 *     type:      'critical'|'warning'|'info'|'success'|'security',
 *     title:     string,
 *     desc:      string,
 *     time:      string,                    // display string, e.g. "2m ago"
 *     read:      boolean,
 *     actions?:  [{ label:string, variant:'primary'|'ghost'|'danger' }],
 *     meta?:     { ip?:string, userId?:string, email?:string },
 *   }
 *
 * CALLBACKS:
 *   onDismiss(id)              – called when user dismisses alert
 *   onAction(id, actionLabel)  – called when user clicks an alert action
 *   onMarkAllRead()            – called when user marks all as read
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useMemo } from "react";

/* ── Design tokens ─────────────────────────────────────────── */
const T = {
    bg:       "var(--alp-bg,       #0B0E14)",
    surface:  "var(--alp-surface,  #111620)",
    surface2: "var(--alp-surface2, #161B26)",
    surface3: "var(--alp-surface3, #1C2230)",
    border:   "var(--alp-border,   rgba(255,255,255,0.07))",
    border2:  "var(--alp-border2,  rgba(255,255,255,0.12))",
    text1:    "var(--alp-text1,    #E8EAF0)",
    text2:    "var(--alp-text2,    rgba(232,234,240,0.55))",
    text3:    "var(--alp-text3,    rgba(232,234,240,0.28))",
    indigo:   "#818CF8",
    teal:     "#2DD4BF",
    amber:    "#F59E0B",
    green:    "#34D399",
    red:      "#F87171",
    purple:   "#A78BFA",
};

/* ── Alert type config ──────────────────────────────────────── */
const TYPE_CONFIG = {
    critical: {
        color:    T.red,
        bg:       "rgba(248,113,113,0.10)",
        border:   "rgba(248,113,113,0.20)",
        label:    "Critical",
        Icon: () => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#F87171" strokeWidth="1.5"/>
                <path d="M8 5v3" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.75" fill="#F87171"/>
            </svg>
        ),
    },
    warning: {
        color:    T.amber,
        bg:       "rgba(245,158,11,0.10)",
        border:   "rgba(245,158,11,0.20)",
        label:    "Warning",
        Icon: () => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14.5 13.5H1.5L8 2z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6.5v3" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#F59E0B"/>
            </svg>
        ),
    },
    info: {
        color:    T.indigo,
        bg:       "rgba(129,140,248,0.10)",
        border:   "rgba(129,140,248,0.20)",
        label:    "Info",
        Icon: () => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#818CF8" strokeWidth="1.5"/>
                <path d="M8 7v4" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="5" r="0.75" fill="#818CF8"/>
            </svg>
        ),
    },
    success: {
        color:    T.green,
        bg:       "rgba(52,211,153,0.10)",
        border:   "rgba(52,211,153,0.18)",
        label:    "Success",
        Icon: () => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#34D399" strokeWidth="1.5"/>
                <path d="M5 8l2.5 2.5L11 6" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    security: {
        color:    T.purple,
        bg:       "rgba(167,139,250,0.10)",
        border:   "rgba(167,139,250,0.20)",
        label:    "Security",
        Icon: () => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L3 4.5v4C3 11.5 5.5 14 8 14s5-2.5 5-5.5v-4L8 2z" stroke="#A78BFA" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M6 8l1.5 1.5L10.5 6" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
};

/* ── Mock data ──────────────────────────────────────────────── */
let _mockId = 0;
const mk = (type, title, desc, time, read = false, actions = [], meta = {}) =>
    ({ id: ++_mockId, type, title, desc, time, read, actions, meta });

const MOCK_ALERTS = [
    mk("critical",  "Suspicious login attempt",
        "5 failed logins from unrecognised IP in 2 minutes",
        "2m ago", false,
        [{ label:"Block IP", variant:"danger" }, { label:"View logs", variant:"ghost" }],
        { ip:"41.223.10.8", email:"d.k@freelance.io" }),

    mk("security",  "New admin role granted",
        "Tom Nguyen was promoted to Admin by Alex Lee",
        "1h ago", false,
        [{ label:"Review", variant:"primary" }],
        { userId:"b7a1e", email:"t.nguyen@startup.io" }),

    mk("warning",   "Approval queue growing",
        "3 users waiting > 4 hours — SLA at risk",
        "2h ago", false,
        [{ label:"Go to queue", variant:"primary" }]),

    mk("info",      "Bulk import completed",
        "48 users imported via CSV — 46 active, 2 skipped",
        "Yesterday", true,
        [{ label:"View report", variant:"ghost" }]),

    mk("success",   "Email verification rate 98%",
        "Highest rate recorded this quarter",
        "2d ago", true),

    mk("warning",   "Export requested",
        "Full user roster export was requested",
        "2d ago", true,
        [{ label:"View request", variant:"ghost" }],
        { email:"a.lee@acme.com" }),

    mk("info",      "Monthly report ready",
        "April 2025 user activity report is available to download",
        "3d ago", true,
        [{ label:"Download", variant:"primary" }]),

    mk("security",  "Password changed",
        "Admin password was changed from a new device",
        "4d ago", true,
        [],
        { ip:"102.89.23.4", email:"a.lee@acme.com" }),
];

/* ── Helper components ──────────────────────────────────────── */

function FilterPill({ label, count, active, onClick }) {
    return (
        <button onClick={onClick} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer",
            fontFamily:"inherit", fontSize:11, fontWeight:600,
            background: active ? T.surface3 : "transparent",
            color: active ? T.text1 : T.text3,
            transition:"all 0.15s",
        }}>
            {label}
            {count > 0 && (
                <span style={{
                    background: active ? T.indigo : T.surface3,
                    color: active ? "#fff" : T.text3,
                    borderRadius:8, padding:"1px 6px", fontSize:10,
                }}>{count}</span>
            )}
        </button>
    );
}

function ActionButton({ label, variant, onClick }) {
    const styles = {
        primary: { background:`linear-gradient(135deg,${T.amber},#E07B00)`, color:"#1a0e00", border:"none" },
        ghost:   { background:"transparent", color:T.text2, border:`1px solid ${T.border2}` },
        danger:  { background:"rgba(248,113,113,0.12)", color:T.red, border:`1px solid rgba(248,113,113,0.22)` },
    };
    return (
        <button onClick={onClick} style={{
            padding:"5px 12px", borderRadius:8, cursor:"pointer",
            fontSize:11, fontWeight:600, fontFamily:"inherit",
            transition:"all 0.12s", ...styles[variant] ?? styles.ghost,
        }}>{label}</button>
    );
}

function MetaTag({ label, value }) {
    return (
        <span style={{
            display:"inline-flex", alignItems:"center", gap:4,
            background: T.surface3, borderRadius:6, padding:"2px 8px",
            fontSize:10, color:T.text3, fontFamily:"monospace",
        }}>
      <span style={{ color:T.text3, fontFamily:"inherit" }}>{label}:</span>
      <span style={{ color:T.text2 }}>{value}</span>
    </span>
    );
}

/** Single alert row */
function AlertRow({ alert, onDismiss, onAction }) {
    const cfg = TYPE_CONFIG[alert.type] ?? TYPE_CONFIG.info;
    const [visible, setVisible] = useState(true);
    const [expanded, setExpanded] = useState(false);

    const handleDismiss = useCallback((e) => {
        e.stopPropagation();
        setVisible(false);
        setTimeout(() => onDismiss?.(alert.id), 280);
    }, [alert.id, onDismiss]);

    if (!visible) return null;

    const hasMeta    = alert.meta && Object.keys(alert.meta).length > 0;
    const hasActions = alert.actions?.length > 0;

    return (
        <div
            onClick={() => setExpanded(p => !p)}
            style={{
                display:"flex", gap:13, padding:"14px 16px",
                borderBottom:`1px solid ${T.border}`,
                background: alert.read ? "transparent" : cfg.bg,
                transition:"background 0.2s",
                cursor:"pointer",
                position:"relative",
                animation:"alpSlideIn 0.22s ease both",
            }}
        >
            {/* unread bar */}
            {!alert.read && (
                <div style={{
                    position:"absolute", left:0, top:"20%", bottom:"20%",
                    width:3, borderRadius:"0 3px 3px 0",
                    background: cfg.color,
                }}/>
            )}

            {/* icon */}
            <div style={{
                width:34, height:34, borderRadius:10, flexShrink:0,
                background: cfg.bg, border:`1px solid ${cfg.border}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                marginTop:1,
            }}>
                <cfg.Icon/>
            </div>

            {/* content */}
            <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                            display:"flex", alignItems:"center", gap:7, marginBottom:3, flexWrap:"wrap"
                        }}>
              <span style={{
                  fontSize:12, fontWeight:600, color:T.text1, letterSpacing:"-0.1px",
              }}>{alert.title}</span>
                            <span style={{
                                fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                                color: cfg.color, background: cfg.bg,
                                border:`1px solid ${cfg.border}`, borderRadius:5,
                                padding:"1px 6px",
                            }}>{cfg.label}</span>
                        </div>
                        <p style={{ fontSize:12, color:T.text2, margin:0, lineHeight:1.5 }}>
                            {alert.desc}
                        </p>
                    </div>

                    <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                        <span style={{ fontSize:10, color:T.text3, fontFamily:"monospace" }}>{alert.time}</span>
                        <button
                            onClick={handleDismiss}
                            title="Dismiss"
                            style={{
                                width:22, height:22, borderRadius:6, border:`1px solid ${T.border}`,
                                background:"transparent", cursor:"pointer", display:"flex",
                                alignItems:"center", justifyContent:"center",
                                color:T.text3, fontSize:14, lineHeight:1, fontFamily:"inherit",
                                transition:"all 0.12s",
                            }}
                        >×</button>
                    </div>
                </div>

                {/* expanded: meta + actions */}
                {expanded && (hasMeta || hasActions) && (
                    <div style={{ marginTop:10, animation:"alpExpand 0.18s ease both" }}>
                        {hasMeta && (
                            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:hasMeta && hasActions ? 10 : 0 }}>
                                {alert.meta.ip    && <MetaTag label="IP"     value={alert.meta.ip}/>}
                                {alert.meta.email && <MetaTag label="email"  value={alert.meta.email}/>}
                                {alert.meta.userId&& <MetaTag label="uid"    value={alert.meta.userId}/>}
                            </div>
                        )}
                        {hasActions && (
                            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                                {alert.actions.map((a, i) => (
                                    <ActionButton key={i} label={a.label} variant={a.variant}
                                                  onClick={(e) => { e.stopPropagation(); onAction?.(alert.id, a.label); }}/>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────── */
export default function AlertsPanel({
                                       alerts: externalAlerts,
                                       onDismiss,
                                       onAction,
                                       onMarkAllRead,
                                   }) {
    const [internalAlerts, setInternalAlerts] = useState(MOCK_ALERTS);
    const [filter, setFilter] = useState("all");
    const [sortNewest, setSortNewest] = useState(true);

    const alerts = externalAlerts ?? internalAlerts;

    /* Inject CSS keyframes once */
    useEffect(() => {
        if (document.getElementById("alp-keyframes")) return;
        const s = document.createElement("style");
        s.id = "alp-keyframes";
        s.textContent = `
      @keyframes alpSlideIn {
        from { opacity:0; transform:translateX(-6px) }
        to   { opacity:1; transform:translateX(0)    }
      }
      @keyframes alpExpand {
        from { opacity:0; transform:translateY(-4px) }
        to   { opacity:1; transform:translateY(0)    }
      }
      @keyframes alpPulse {
        0%,100% { opacity:1 } 50% { opacity:0.35 }
      }
      .alp-row-btn:hover { background: rgba(255,255,255,0.03) !important; }
    `;
        document.head.appendChild(s);
    }, []);

    const handleDismiss = useCallback((id) => {
        if (externalAlerts) { onDismiss?.(id); return; }
        setInternalAlerts(prev => prev.filter(a => a.id !== id));
    }, [externalAlerts, onDismiss]);

    const handleMarkAllRead = useCallback(() => {
        if (externalAlerts) { onMarkAllRead?.(); return; }
        setInternalAlerts(prev => prev.map(a => ({ ...a, read:true })));
    }, [externalAlerts, onMarkAllRead]);

    /* Derived counts */
    const counts = useMemo(() => ({
        all:      alerts.length,
        critical: alerts.filter(a => a.type === "critical" || a.type === "security").length,
        warning:  alerts.filter(a => a.type === "warning").length,
        info:     alerts.filter(a => a.type === "info" || a.type === "success").length,
        unread:   alerts.filter(a => !a.read).length,
    }), [alerts]);

    /* Filtered + sorted */
    const visible = useMemo(() => {
        let list = [...alerts];
        if (filter === "critical") list = list.filter(a => a.type === "critical" || a.type === "security");
        if (filter === "warning")  list = list.filter(a => a.type === "warning");
        if (filter === "info")     list = list.filter(a => a.type === "info" || a.type === "success");
        if (filter === "unread")   list = list.filter(a => !a.read);
        if (!sortNewest) list.reverse();
        return list;
    }, [alerts, filter, sortNewest]);

    const FILTERS = [
        { id:"all",      label:"All",      count: counts.all      },
        { id:"unread",   label:"Unread",   count: counts.unread   },
        { id:"critical", label:"Critical", count: counts.critical },
        { id:"warning",  label:"Warning",  count: counts.warning  },
        { id:"info",     label:"Info",     count: counts.info     },
    ];

    return (
        <section style={{ fontFamily:"'DM Sans', system-ui, sans-serif", color: T.text1 }}>

            {/* ── Header ── */}
            <div style={{
                display:"flex", alignItems:"flex-start", justifyContent:"space-between",
                marginBottom:18, flexWrap:"wrap", gap:12,
            }}>
                <div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <h2 style={{ fontSize:15, fontWeight:600, color:T.text1, margin:0, letterSpacing:"-0.2px" }}>
                            Alerts
                        </h2>
                        {counts.unread > 0 && (
                            <span style={{
                                display:"flex", alignItems:"center", gap:5,
                                background:"rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.22)",
                                borderRadius:20, padding:"3px 9px", fontSize:11, fontWeight:600, color:T.red,
                            }}>
                <span style={{
                    width:6, height:6, borderRadius:"50%", background:T.red,
                    animation:"alpPulse 2s infinite",
                }}/>
                                {counts.unread} unread
              </span>
                        )}
                    </div>
                    <p style={{ fontSize:11, color:T.text3, margin:"3px 0 0" }}>
                        System notifications & security events
                    </p>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {counts.unread > 0 && (
                        <button onClick={handleMarkAllRead} style={{
                            padding:"6px 14px", borderRadius:8, border:`1px solid ${T.border2}`,
                            background:"transparent", color:T.text2, fontSize:11, fontWeight:600,
                            fontFamily:"inherit", cursor:"pointer", transition:"all 0.12s",
                        }}>Mark all read</button>
                    )}
                    <button
                        onClick={() => setSortNewest(p => !p)}
                        title="Toggle sort order"
                        style={{
                            padding:"6px 10px", borderRadius:8, border:`1px solid ${T.border}`,
                            background:"transparent", color:T.text3, fontSize:11,
                            fontFamily:"inherit", cursor:"pointer", transition:"all 0.12s",
                        }}>
                        {sortNewest ? "Newest ↓" : "Oldest ↑"}
                    </button>
                </div>
            </div>

            {/* ── Filter pills ── */}
            <div style={{
                display:"flex", gap:2, overflowX:"auto", marginBottom:14,
                background: T.surface, border:`1px solid ${T.border}`,
                borderRadius:14, padding:5,
            }}>
                {FILTERS.map(f => (
                    <FilterPill key={f.id} label={f.label} count={f.count}
                                active={filter === f.id} onClick={() => setFilter(f.id)}/>
                ))}
            </div>

            {/* ── Summary strip ── */}
            <div style={{
                display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14,
            }}>
                {[
                    { label:"Critical / Security", count: counts.critical, color: T.red    },
                    { label:"Warnings",            count: counts.warning,  color: T.amber  },
                    { label:"Info / Success",      count: counts.info,     color: T.indigo },
                ].map(s => (
                    <div key={s.label} style={{
                        background: T.surface, border:`1px solid ${T.border}`, borderRadius:12,
                        padding:"12px 14px", animation:"alpSlideIn 0.3s ease both",
                    }}>
                        <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.1em", color:T.text3, marginBottom:6 }}>{s.label}</div>
                        <div style={{ fontSize:22, fontWeight:600, color:s.color, letterSpacing:"-0.3px", fontFamily:"monospace" }}>
                            {s.count}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Alert list ── */}
            {visible.length === 0 ? (
                <div style={{
                    display:"flex", flexDirection:"column", alignItems:"center", gap:10,
                    padding:"52px 20px",
                    background: T.surface, border:`1px solid ${T.border}`, borderRadius:16,
                }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke={T.border2} strokeWidth="1.5"/>
                        <path d="M9 12l2 2 4-4" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p style={{ fontSize:13, color:T.text3, margin:0 }}>
                        {filter === "all" ? "No alerts — all clear." : `No ${filter} alerts.`}
                    </p>
                    {filter !== "all" && (
                        <button onClick={() => setFilter("all")} style={{
                            fontSize:11, color:T.indigo, background:"transparent", border:"none",
                            cursor:"pointer", fontFamily:"inherit",
                        }}>Show all alerts</button>
                    )}
                </div>
            ) : (
                <div style={{
                    background: T.surface, border:`1px solid ${T.border}`,
                    borderRadius:16, overflow:"hidden",
                }}>
                    {visible.map((a, i) => (
                        <AlertRow
                            key={a.id}
                            alert={a}
                            onDismiss={handleDismiss}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}

            {/* ── Footer ── */}
            {visible.length > 0 && (
                <div style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    marginTop:12, flexWrap:"wrap", gap:8,
                }}>
          <span style={{ fontSize:10, color:T.text3, fontFamily:"monospace" }}>
            {visible.length} of {alerts.length} alerts
          </span>
                    <button style={{
                        fontSize:11, color:T.text3, background:"transparent", border:"none",
                        cursor:"pointer", fontFamily:"inherit",
                    }}>
                        View full event log →
                    </button>
                </div>
            )}

        </section>
    );
}