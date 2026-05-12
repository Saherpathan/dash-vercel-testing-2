import React, { useEffect, useState } from 'react';
import { formatCurrency, formatCompactNumber } from '../lib/utils';
import { ArrowUpRight, Clock, Hash, Coins, Loader2, User } from 'lucide-react';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { fetchAgentData } from '../services/apiService';

export const AuditLog: React.FC = () => {
  const { filters } = useDashboardFilters();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch raw rows for the selected timespan
        const rawData = await fetchAgentData(filters.timespan);
        
        /**
         * AGGREGATION LOGIC
         * We group raw BigQuery rows by session_id to show a high-level audit.
         */
        const grouped = rawData.reduce((acc: any, curr: any) => {
          const sId = curr.session_id || curr.id || 'unknown_session';
          if (!acc[sId]) {
            acc[sId] = {
              id: sId,
              userId: curr.user_id || 'anonymous_user',
              startTime: curr.timestamp,
              totalTurns: 0,
              totalTokens: 0,
              cost: 0
            };
          }
          acc[sId].totalTurns += 1;
          acc[sId].totalTokens += Number(curr.total_tokens || curr.tokens || 0);
          acc[sId].cost = acc[sId].totalTokens * 0.000002;
          return acc;
        }, {});

        setSessions(Object.values(grouped)); 
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters.timespan]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col justify-center items-center h-64 text-zinc-500 bg-brand-card/10 rounded-xl border border-brand-border border-dashed">
        <Loader2 className="animate-spin mb-3 text-brand-primary" size={24} />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Aggregating Session Data...</span>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10">
      <div className="rounded-xl border border-brand-border bg-brand-card overflow-hidden shadow-2xl">
        <div className="border-b border-brand-border bg-zinc-900/30 p-4 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
            Audit Logs: Context Inflation Tracking
          </h3>
          <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded font-mono text-brand-primary">
            ACTIVE_SESSIONS: {sessions.length}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/50">
                <HeaderCell label="Internal Session ID" icon={<Hash size={12} />} />
                <HeaderCell label="User Identity" icon={<User size={12} />} />
                <HeaderCell label="Start Time" icon={<Clock size={12} />} />
                <HeaderCell label="Turns" />
                <HeaderCell label="Tokens" icon={<Coins size={12} />} />
                <HeaderCell label="Cost (est)" />
                <HeaderCell label="" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    No session data found for this timespan
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-brand-primary/[0.02] transition-colors group">
                    <td className="px-4 py-3 text-[11px] font-mono text-zinc-400 select-all truncate max-w-[120px]">
                      {session.id}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-300">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
                        {session.userId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-zinc-500">
                      {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-medium text-zinc-300">
                      {session.totalTurns}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-zinc-400">
                      {formatCompactNumber(session.totalTokens)}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-emerald-500/80 font-bold">
                      {formatCurrency(session.cost)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-brand-primary hover:border-brand-primary/50 transition-all">
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const HeaderCell: React.FC<{ label: string; icon?: React.ReactNode }> = ({ label, icon }) => (
  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">
    <div className="flex items-center gap-1.5">
      {icon} {label}
    </div>
  </th>
);
