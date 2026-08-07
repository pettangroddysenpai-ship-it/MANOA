import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Volume2, Bot, User } from 'lucide-react';
import Robot from './Robot.jsx';
import RoadmapView from './RoadmapView.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { api } from '../services/api.js';

const SUGGESTIONS = [
  'Comment configurer PPPoE sur MikroTik ?',
  'Comment depanner une panne Internet ?',
  'Que signifie une LED LOS qui clignote ?',
  'Comment creer un VLAN 20 ?',
];

export default function ChatView({ onXpGained }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [roadmapEntries, setRoadmapEntries] = useState({});
  const { listening, speaking, voiceSupported, listen, stopListening, speak, stopSpeaking } = useSpeech();
  const bottomRef = useRef(null);
  const [helloSpoken, setHelloSpoken] = useState(false);

  useEffect(() => {
    if (!helloSpoken && !speaking) {
      setHelloSpoken(true);
      setTimeout(() => speak('Bonjour ! Je suis MANOA, votre assistant telecom Matrix. Comment puis-je vous aider ?'), 600);
    }
  }, [helloSpoken, speaking, speak]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await api.chat(q);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.text, sources: res.sources, type: res.type, roadmapId: res.roadmap ? null : null },
      ]);
      if (res.roadmap) {
        const saved = await api.saveRoadmap(q, res.roadmap);
        setRoadmapEntries((e) => ({ ...e, [saved.id]: saved }));
        setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, roadmapId: saved.id } : msg)));
      }
      if (onXpGained) onXpGained();
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Erreur: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const handleMic = async () => {
    if (listening) {
      stopListening();
      return;
    }
    stopSpeaking();
    const text = await listen();
    if (text) await send(text);
  };

  const speakAnswer = async (content) => {
    stopSpeaking();
    await speak(content);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-8">
      <div className="flex justify-center pt-2">
        <Robot talking={speaking} speaking={speaking} size={170} message={busy ? 'Je cherche dans la documentation Matrix...' : speaking ? 'Je reponds...' : null} />
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="glass rounded-full px-3 py-1.5 text-xs text-blue-200 transition hover:bg-blue-500/20"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
                  <Bot size={16} />
                </span>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-blue-600 text-white' : 'glass text-slate-100'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                    <button onClick={() => speakAnswer(msg.content)} className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-1 text-blue-300 hover:bg-blue-500/25">
                      <Volume2 size={12} /> Ecouter
                    </button>
                    {msg.sources?.length > 0 && (
                      <span className="text-slate-500">
                        Sources: {msg.sources.slice(0, 2).map((s) => s.title).join(', ')}
                      </span>
                    )}
                  </div>
                )}
                {msg.roadmapId && roadmapEntries[msg.roadmapId] && (
                  <div className="mt-3">
                    <RoadmapView entry={roadmapEntries[msg.roadmapId]} onXpGained={onXpGained} />
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600">
                  <User size={16} />
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="flex gap-1">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-blue-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                />
              ))}
            </span>
            MANOA reflechit...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-4 mt-6">
        <div className="glass flex items-center gap-2 rounded-2xl p-2">
          <button
            onClick={handleMic}
            disabled={!voiceSupported}
            title={voiceSupported ? 'Parler' : 'Voix non supportee'}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/40'
            } ${!voiceSupported ? 'opacity-40' : ''}`}
          >
            {listening ? <Square size={16} /> : <Mic size={18} />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={listening ? 'Je vous ecoute...' : 'Posez votre question telecom...'}
            className="flex-1 bg-transparent px-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
