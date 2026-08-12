import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Map, LayoutDashboard, Bot, Star, Flame, Award, Wifi, WifiOff } from 'lucide-react';
import ChatView from './components/ChatView.jsx';
import ProgressListView from './components/ProgressListView.jsx';
import DashboardView from './components/DashboardView.jsx';
import { api } from './services/api.js';

const TABS = [
  { id: 'chat', label: 'Assistant', icon: MessageCircle },
  { id: 'roadmaps', label: 'Feuilles de route', icon: Map },
  { id: 'dashboard', label: 'Admin', icon: LayoutDashboard },
];

export default function App() {
  const [tab, setTab] = useState('chat');
  const [user, setUser] = useState(null);
  const [kb, setKb] = useState(null);
  const [mode, setMode] = useState({ online: false, label: '' });

  const refreshUser = async () => {
    try {
      setUser(await api.getUser());
    } catch {}
  };

  useEffect(() => {
    refreshUser();
    api.knowledgeStats().then(setKb).catch(() => {});
  }, []);

  const handleXpGained = () => refreshUser();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-green-400/15 bg-black/90 backdrop-blur-md">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-300 text-black">
            <Bot size={22} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">MANOA</div>
            <div className="text-[11px] text-green-200/70">Matrix AI Technician</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-black'
                  : 'text-green-100/80 hover:bg-green-500/15 hover:text-white'
              }`}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </nav>

        {mode.label && (
          <div
            className={`mx-3 mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
              mode.online
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
            }`}
            title={mode.label}
          >
            {mode.online ? <Wifi size={13} className="shrink-0" /> : <WifiOff size={13} className="shrink-0" />}
            <span className="truncate">{mode.label}</span>
          </div>
        )}

        <div className="mx-3 mb-4 rounded-2xl border border-green-400/25 bg-green-400/10 p-3">
          {user && (
            <>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm font-bold text-green-300">
                  <Star size={14} /> {user.xp} XP
                </span>
                <span className="flex items-center gap-1 text-xs text-rose-300">
                  <Flame size={13} /> {user.streak || 0}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-400 to-lime-300"
                  animate={{ width: `${Math.min(((user.xp % 100) / 100) * 100, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Award size={13} className="text-amber-400" />
                <span className="text-xs text-green-100">Niveau {user.level}</span>
              </div>
              {user.badges?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.badges.slice(0, 3).map((b) => (
                    <span key={b} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          {kb && (
            <div className="mt-2 border-t border-green-400/15 pt-2 text-[11px] text-green-200/60">
              {kb.documents} docs · {kb.chunks} fragments · {kb.embedded ? 'IA embarquee' : 'recherche locale'}
            </div>
          )}
        </div>
      </aside>

      <main className={`ml-60 flex-1 ${tab === 'chat' ? 'chat-bg' : ''}`}>
        <div className={tab === 'chat' ? 'w-full pt-6' : 'mx-auto max-w-5xl pt-6'}>
          {tab === 'chat' && <ChatView onXpGained={handleXpGained} onModeChange={setMode} />}
          {tab === 'roadmaps' && <ProgressListView onXpGained={handleXpGained} />}
          {tab === 'dashboard' && <DashboardView />}
        </div>
      </main>
    </div>
  );
}
