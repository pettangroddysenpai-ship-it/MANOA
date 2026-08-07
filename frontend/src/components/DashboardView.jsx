import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Users, FileText, Database, Flame, Trophy, BookOpen, Lock } from 'lucide-react';
import { api } from '../services/api.js';

const ADMIN_KEY = 'manoa_admin_token';

export default function DashboardView() {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_KEY) || '');
  const [stats, setStats] = useState(null);
  const [chats, setChats] = useState([]);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(!localStorage.getItem(ADMIN_KEY));

  const load = async (t) => {
    setError('');
    try {
      const [s, c] = await Promise.all([api.adminStats(t), api.adminChats(t)]);
      setStats(s);
      setChats(c);
      localStorage.setItem(ADMIN_KEY, t);
      setShowLogin(false);
    } catch (e) {
      setError(e.message);
      setShowLogin(true);
    }
  };

  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showLogin) {
    return (
      <div className="mx-auto mt-24 w-full max-w-sm">
        <div className="glass rounded-3xl p-8 text-center">
          <Lock className="mx-auto text-blue-400" size={36} />
          <h2 className="mt-3 text-xl font-bold text-slate-100">Espace Admin</h2>
          <p className="mt-1 text-sm text-slate-400">Entrez le mot de passe administrateur (defaut: manoa-admin)</p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && token && load(token)}
            placeholder="Mot de passe"
            className="mt-4 w-full rounded-xl border border-blue-500/30 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-400"
          />
          {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          <button
            onClick={() => token && load(token)}
            className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const cards = stats && [
    { label: 'Chats aujourdhui', value: stats.chatsToday, icon: Flame, color: 'from-orange-500 to-rose-500' },
    { label: 'Chats total', value: stats.chatsTotal, icon: MessageSquare, color: 'from-blue-500 to-cyan-500' },
    { label: 'Utilisateurs', value: stats.users, icon: Users, color: 'from-emerald-500 to-teal-500' },
    { label: 'Documents', value: stats.documents, icon: FileText, color: 'from-violet-500 to-fuchsia-500' },
    { label: 'Docs connaissances', value: stats.knowledge?.documents ?? 0, icon: BookOpen, color: 'from-amber-500 to-orange-500' },
    { label: 'Fragments', value: stats.knowledge?.chunks ?? 0, icon: Database, color: 'from-sky-500 to-indigo-500' },
    { label: 'XP distribuee', value: stats.xpTotal ?? 0, icon: Trophy, color: 'from-yellow-500 to-amber-600' },
    { label: 'Base', value: stats.db === 'firestore' ? 'Firestore' : 'Locale', icon: Database, color: 'from-slate-500 to-slate-700' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Tableau de bord</h1>
        <button
          onClick={() => {
            localStorage.removeItem(ADMIN_KEY);
            setShowLogin(true);
            setToken('');
          }}
          className="text-xs text-slate-400 hover:text-rose-400"
        >
          Deconnexion
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4"
          >
            <div className={`inline-flex rounded-xl bg-gradient-to-br ${c.color} p-2.5 text-white`}>
              <c.icon size={18} />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-100">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="glass mt-8 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-200">Dernieres conversations</h2>
        {chats.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune conversation pour le moment.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {chats.map((c) => (
              <div key={c.id} className="rounded-xl bg-slate-900/60 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-blue-300">{c.userName}</span>
                  <span>{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <p className="mt-1 text-sm text-slate-200">
                  <span className="text-slate-400">Q: </span>
                  {c.question}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                  <span className="text-slate-500">R: </span>
                  {c.answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
