import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Plus, Star } from 'lucide-react';
import { api } from '../services/api.js';
import RoadmapView from './RoadmapView.jsx';

export default function ProgressListView({ onXpGained }) {
  const [entries, setEntries] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [user, setUser] = useState(null);

  const refresh = async () => {
    const [p, u] = await Promise.all([api.getProgress(), api.getUser()]);
    setEntries(p.reverse());
    setUser(u);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mes feuilles de route</h1>
          <p className="text-sm text-slate-400">Reprenez vos parcours d'apprentissage</p>
        </div>
        {user && (
          <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2">
            <span className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2.5 py-1 text-sm font-bold text-orange-300">
              <Star size={13} /> {user.xp} XP
            </span>
            <span className="text-sm text-slate-300">Niv. {user.level}</span>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <Map className="mx-auto text-blue-400" size={40} />
          <p className="mt-3 text-slate-300">Aucune feuille de route pour le moment.</p>
          <p className="text-sm text-slate-500">Posez une question "comment faire..." dans le chat pour en creer une.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const done = entry.steps.filter((s) => s.completed).length;
            const pct = Math.round((done / entry.steps.length) * 100);
            return (
              <div key={entry.id} className="glass overflow-hidden rounded-2xl">
                <button
                  onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Plus size={18} className={`transition-transform ${openId === entry.id ? 'rotate-45' : ''}`} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-slate-100">{entry.title}</span>
                    <span className="block text-xs text-slate-400">
                      {done}/{entry.steps.length} etapes · {entry.question}
                    </span>
                  </span>
                  <span className="w-20">
                    <span className="mb-1 block text-right text-xs font-bold text-blue-300">{pct}%</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                </button>
                <AnimatePresence>
                  {openId === entry.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-blue-500/10"
                    >
                      <div className="p-4">
                        <RoadmapView entry={entry} onXpGained={onXpGained} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
