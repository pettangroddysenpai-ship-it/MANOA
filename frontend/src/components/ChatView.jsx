import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Volume2, Bot, User } from 'lucide-react';
import Robot from './Robot.jsx';
import RoadmapView from './RoadmapView.jsx';
import StickmanCanvas from './StickmanCanvas.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { api } from '../services/api.js';

const SUGGESTIONS = [
  'Comment configurer PPPoE sur MikroTik ?',
  'Comment depanner une panne Internet ?',
  'Comment verifier l\'architecture POP - Provider Edge ?',
  'Comment utiliser Winbox ?',
];

export default function ChatView({ onXpGained }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [roadmapEntries, setRoadmapEntries] = useState({});
  const [activeScene, setActiveScene] = useState({ scene: 'inspection', app: '', title: '' });
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
      setMessages((m) => [...m, { role: 'assistant', content: res.text, sources: res.sources, type: res.type }]);
      if (res.roadmap) {
        const saved = await api.saveRoadmap(q, res.roadmap);
        setRoadmapEntries((e) => ({ ...e, [saved.id]: saved }));
        setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, roadmapId: saved.id } : msg)));
        const first = res.roadmap.steps[0];
        setActiveScene({ scene: first.scene || 'inspection', app: first.app || '', title: first.title });
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
    <div className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col gap-5 px-4 pb-4 lg:flex-row">
      <div className="order-2 flex min-h-0 flex-1 flex-col lg:order-1 lg:w-3/5">
        <div className="mb-2 flex flex-wrap justify-center gap-2">
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'glass text-slate-100'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                      <button
                        onClick={() => speakAnswer(msg.content)}
                        className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-1 text-blue-300 hover:bg-blue-500/25"
                      >
                        <Volume2 size={12} /> Ecouter
                      </button>
                      {msg.sources?.length > 0 && (
                        <span className="text-slate-500">Sources: {msg.sources.slice(0, 2).map((s) => s.title).join(', ')}</span>
                      )}
                    </div>
                  )}
                  {msg.roadmapId && roadmapEntries[msg.roadmapId] && (
                    <div className="mt-3">
                      <RoadmapView entry={roadmapEntries[msg.roadmapId]} onXpGained={onXpGained} onStepOpen={setActiveScene} />
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

        <div className="mt-3">
          <div className="glass flex items-center gap-2 rounded-2xl p-2">
            <button
              onClick={handleMic}
              disabled={!voiceSupported}
              title={voiceSupported ? 'Parler' : 'Voix non supportee'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                listening ? 'animate-pulse bg-rose-500 text-white' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/40'
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

      <div className="order-1 flex min-h-[280px] w-full flex-col gap-3 lg:order-2 lg:h-auto lg:w-2/5">
        <div className="glass flex h-1/2 items-center justify-center rounded-2xl py-3">
          <Robot
            talking={speaking}
            speaking={speaking}
            size={160}
            message={
              busy
                ? 'Je cherche dans la documentation Matrix...'
                : speaking
                  ? 'Je reponds...'
                  : activeScene.title || 'Posez-moi une question !'
            }
          />
        </div>
        <div className="h-1/2 min-h-[220px]">
          <StickmanCanvas scene={activeScene.scene} app={activeScene.app} title={activeScene.title} />
        </div>
      </div>
    </div>
  );
}
