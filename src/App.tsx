import { useEffect, useState, useRef } from 'react';
import { fetchSessions, fetchDiff, type Session, type SessionEntry } from './api';
import {
  History,
  Search as SearchIcon,
  GitBranch,
  Clock,
  ChevronRight,
  Terminal,
  Zap,
  CornerDownRight,
  Database,
  ExternalLink,
  ChevronDown,
  X
} from 'lucide-react';
import { DiffView } from './components/DiffView.tsx';

interface GroupedEntry {
  id: string;
  action: string;
  count: number;
  results: string[];
  lastTimestamp: string;
  originalEntries: SessionEntry[];
}

/**
 * Minimalist Status Renderer (Brand Alignment)
 */
function StatusResult({ result }: { result: string }) {
  // Parse common result formats like "14 ok, 0 drift, 0 missing"
  const okMatch = result.match(/(\d+)\s+ok/i);
  const driftMatch = result.match(/(\d+)\s+drift/i);
  const missingMatch = result.match(/(\d+)\s+missing/i);

  if (!okMatch && !driftMatch && !missingMatch) {
    return <span className="text-slate-400 italic lowercase">{result.toLowerCase()}</span>;
  }

  const results = [
    { count: okMatch?.[1] || '0', label: 'ok', color: 'text-emerald-500' },
    { count: driftMatch?.[1] || '0', label: 'drift', color: 'text-amber-500' },
    { count: missingMatch?.[1] || '0', label: 'missing', color: 'text-rose-500' }
  ];

  return (
    <div className="flex items-center gap-4 font-mono font-black tracking-tight text-[11.5px] lowercase">
      {results.map((r, i) => (
        <span key={i} className="flex items-center gap-1.5 translate-y-[0.5px]">
          <span className={r.color}>{r.count}</span>
          <span className="text-slate-500 opacity-50 font-bold">{r.label}</span>
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [diffData, setDiffData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [showRawLogs, setShowRawLogs] = useState(false);

  const diffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await fetchSessions();
      setSessions(data);
      if (data.length > 0) handleSelectSession(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSession(s: Session) {
    setSelectedSession(s);
    setDiffData(null);
    setExpandedGroupId(null);
    if (s.metadata?.commit && s.metadata.commit !== 'none') {
      try {
        const diff = await fetchDiff(s.metadata.commit);
        setDiffData(diff);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function scrollToDiff() {
    diffRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Group consecutive identical actions (like "verify")
   */
  function groupEntries(entries: SessionEntry[]): GroupedEntry[] {
    const grouped: GroupedEntry[] = [];
    entries.forEach((e) => {
      const last = grouped[grouped.length - 1];
      // Only group if action is identical (e.g., repetitive verify)
      if (last && last.action === e.action && e.action.includes('verify')) {
        last.count++;
        last.results.push(e.result);
        last.lastTimestamp = e.timestamp;
        last.originalEntries.push(e);
      } else {
        grouped.push({
          id: `${e.timestamp}-${e.action}`,
          action: e.action,
          count: 1,
          results: [e.result],
          lastTimestamp: e.timestamp,
          originalEntries: [e]
        });
      }
    });
    return grouped;
  }

  const filteredSessions = sessions.filter(s =>
    s.entries.some(e =>
      e.action?.toLowerCase().includes(search.toLowerCase()) ||
      e.result?.toLowerCase().includes(search.toLowerCase())
    ) ||
    s.metadata?.branch?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full text-slate-200 overflow-hidden font-sans selection:bg-orange-500/30 bg-[#06060b]">
      <aside className="w-80 flex flex-col glass border-r border-white/5 z-20">
        <header className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/5 overflow-hidden">
              <img src="/mythos-logo-v2.png" alt="Mythos" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter text-white uppercase italic leading-none">Mythos Orb</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Local Dashboard</p>
            </div>
          </div>

          <div className="relative group">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#cc785c] transition-colors" />
            <input
              type="text"
              placeholder="Search history..."
              className="w-full bg-white/5 border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-[#cc785c]/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredSessions.map(s => (
            <button
              key={s.id}
              onClick={() => handleSelectSession(s)}
              className={`w-full group text-left px-4 py-4 rounded-xl transition-all duration-200 border ${selectedSession?.id === s.id
                  ? 'session-active border-transparent glass-card shadow-xl translate-x-1'
                  : 'border-transparent hover:bg-white/5 hover:translate-x-1'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock size={10} className="text-slate-500" />
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-slate-400 transition-colors">
                    {new Date((s.timestamp_start || '').replace('∣', '')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {s.metadata?.branch && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#cc785c]/10 text-[#cc785c] border border-[#cc785c]/20 text-[9px] font-mono leading-none">
                    <GitBranch size={8} />
                    {s.metadata.branch?.split('/').pop()}
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate mb-3">
                {s.entries[0]?.action || 'Passive Observation'}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Zap size={10} className="text-amber-500" />
                    <span>{s.entries.length} steps</span>
                  </div>
                  {s.metadata?.commit && s.metadata.commit !== 'none' && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 border border-white/5 px-1.5 py-0.5 rounded bg-white/5">
                      <Database size={10} className="text-[#cc785c]" />
                      <span className="font-mono">{s.metadata.commit.slice(0, 7)}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden z-10 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#cc785c]/5 blur-[120px] pointer-events-none" />

        {!selectedSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-6 animate-fade-in font-mono">
            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
              <History size={40} strokeWidth={1} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-1">Observation Deck</p>
              <p className="text-xs text-slate-600 tracking-wide">Select a session from the timeline</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden animate-fade-in relative">

            <div className={`absolute top-0 right-0 h-full w-[450px] bg-[#0c0c14] border-l border-white/5 shadow-2xl z-50 transition-transform duration-300 transform ${showRawLogs ? 'translate-x-0' : 'translate-x-full'}`}>
              <header className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-[#cc785c]" />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Memory Source</h3>
                </div>
                <button onClick={() => setShowRawLogs(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                  <X size={16} />
                </button>
              </header>
              <div className="p-6 overflow-y-auto h-[calc(100%-80px)] custom-scrollbar">
                <pre className="text-[12px] font-mono text-slate-400 bg-black/40 p-4 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed">
                  {selectedSession.rawContent || 'No raw data available'}
                </pre>
              </div>
            </div>

            <header className="p-8 pb-6 flex items-center justify-between z-10 sticky top-0 bg-[#06060b]/80 backdrop-blur-md">
              <div className="space-y-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="px-2 py-0.5 rounded bg-[#cc785c]/10 text-[#cc785c] border border-[#cc785c]/20 text-[10px] font-bold tracking-widest uppercase">
                    Session Log
                  </div>
                  <ChevronRight size={14} className="text-slate-700" />
                  <h2 className="text-xl font-black tracking-tight text-white leading-none">
                    {selectedSession.entries[0]?.action?.split(':')[0] || 'Unknown Origin'}
                  </h2>
                </div>
                <div className="flex items-center gap-6 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-slate-600" />
                    <span>{new Date((selectedSession.timestamp_start || '').replace('∣', '')).toLocaleString()}</span>
                  </div>
                  {selectedSession.metadata?.timestamp_end && (
                    <div className="flex items-center gap-2 font-mono text-[#cc785c]/80">
                      <ChevronRight size={12} className="text-slate-700" />
                      <span>Finished AT {new Date(selectedSession.metadata.timestamp_end).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setShowRawLogs(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:border-white/10 transition-all">
                  <Terminal size={14} />
                  Raw Logs
                </button>
                {selectedSession.metadata?.commit && (
                  <button onClick={scrollToDiff} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#cc785c] text-white text-xs font-black shadow-lg shadow-orange-900/30 hover:bg-[#e09070] transition-all uppercase tracking-widest translate-y-[-1px] active:translate-y-0">
                    <ExternalLink size={14} strokeWidth={3} />
                    View Diff
                  </button>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-8 pb-32 space-y-12 custom-scrollbar min-h-0">
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#cc785c]/80">Execution Trace</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-[#cc785c]/20 to-transparent" />
                </div>

                <div className="grid gap-2">
                  {groupEntries(selectedSession.entries).map((g, idx) => (
                    <div key={g.id} className={`group relative glass-card rounded-2xl transition-all hover:bg-white/[0.04] overflow-hidden ${expandedGroupId === g.id ? 'border-[#cc785c]/30 ring-1 ring-[#cc785c]/10' : ''}`}>
                      <button
                        onClick={() => setExpandedGroupId(expandedGroupId === g.id ? null : g.id)}
                        className="w-full text-left p-4 flex items-start gap-5"
                      >
                        <div className="flex flex-col items-center gap-2 mt-1">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all ${expandedGroupId === g.id ? 'bg-[#cc785c] border-[#cc785c] text-white' : 'bg-slate-800 border-slate-700 text-slate-400 group-hover:border-[#cc785c]/50 group-hover:text-white'}`}>
                            {idx + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-bold text-slate-100 leading-snug">{g.action}</h4>
                              {g.count > 1 && (
                                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-bold uppercase tracking-widest">
                                  {g.count}x Repeats
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-mono text-slate-600">{(g.lastTimestamp || '').replace('∣', '').trim()}</span>
                              <ChevronDown size={14} className={`text-slate-600 transition-transform ${expandedGroupId === g.id ? 'rotate-180 text-[#cc785c]' : ''}`} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 leading-relaxed truncate">
                            <CornerDownRight size={10} className="text-slate-700 flex-shrink-0" />
                            <StatusResult result={g.results[g.results.length - 1]} />
                          </div>
                        </div>
                      </button>

                      <div className={`accordion-content px-4 pb-4 ${expandedGroupId === g.id ? 'accordion-expanded' : ''}`}>
                        <div className="ml-10 pt-2 space-y-4">
                          <div className="h-px bg-white/5 w-full" />
                          <div className="space-y-1.5">
                            {g.results.map((res, ridx) => (
                              <div key={ridx} className="flex items-center gap-3 p-2 rounded bg-black/20 border border-white/5">
                                <div className="text-[9px] font-bold min-w-[34px] uppercase tracking-tighter opacity-60">Result</div>
                                <StatusResult result={res} />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded bg-[#cc785c]/5 border border-[#cc785c]/10 text-[10px] text-[#cc785c] font-bold uppercase tracking-widest">
                            <ShieldCheck size={12} />
                            All entries verified & drift-mapped
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Diffs Section */}
              <section className="space-y-6" ref={diffRef}>
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#cc785c]/80 flex items-center gap-2">
                    <span>diff @</span>
                    <span className="text-white lowercase bg-white/5 px-1.5 py-0.5 rounded">
                      {selectedSession.metadata?.commit?.slice(0, 7) || 'HEAD'}
                    </span>
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-[#cc785c]/20 to-transparent" />
                </div>

                <div className="rounded-2xl border border-white/5 overflow-hidden glass-card shadow-2xl min-h-[500px]">
                  {loading ? (
                    <div className="h-[500px] flex items-center justify-center text-slate-500 italic text-sm animate-pulse">Syncing diff buffer...</div>
                  ) : diffData ? (
                    <div className="animate-fade-in">
                      <DiffView diffText={diffData} />
                    </div>
                  ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center text-slate-700 gap-4 opacity-50 bg-black/20">
                      <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                        <History size={32} strokeWidth={1} className="text-slate-600" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-bold tracking-wide uppercase text-slate-500">No Diff Snapshot</p>
                        <p className="text-[11px] max-w-[240px] text-slate-600 leading-relaxed">
                          This session didn't record a commit hash. Use <code>chat</code> or <code>dream</code> to generate state changes.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ShieldCheck({ size }: { size: number }) {
  return <Zap size={size} />;
}
