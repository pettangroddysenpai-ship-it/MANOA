import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Volume2, Bot, User, Youtube } from 'lucide-react';
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

export default function ChatView({ onXpGained, onModeChange }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [roadmapEntries, setRoadmapEntries] = useState({});
  const [activeScene, setActiveScene] = useState({ scene: 'inspection', app: '', title: '' });
  const [mode, setModeState] = useState({
    online: typeof navigator !== 'undefined' ? navigator.onLine : false,
    label: typeof navigator !== 'undefined' && navigator.onLine ? 'Mode en ligne' : 'Mode hors ligne',
  });
  const { listening, speaking, voiceSupported, listen, stopListening, speak, stopSpeaking } = useSpeech();
  const bottomRef = useRef(null);
  const robotRef = useRef(null);
  const [robotSize, setRobotSize] = useState(450);
  const [helloSpoken, setHelloSpoken] = useState(false);

  useEffect(() => {
    const el = robotRef.current;
    if (!el) return;
    const update = () => setRobotSize(Math.max(220, Math.min(450, el.clientWidth - 24)));
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const reportMode = (m) => {
    setModeState(m);
    if (onModeChange) onModeChange(m);
  };

  useEffect(() => {
    const onOnline = () => reportMode({ online: true, label: 'Mode en ligne' });
    const onOffline = () => reportMode({ online: false, label: 'Mode hors ligne' });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
      const providers = res.providers || [];
      const onlineProviders = providers.filter((p) => p === 'openai' || p === 'gemini');
      const localProviders = providers.filter((p) => p === 'ollama');
      reportMode({
        online: onlineProviders.length > 0,
        label: onlineProviders.length > 0
          ? `Mode en ligne: ${onlineProviders.join(' + ')}`
          : localProviders.length > 0
            ? `Mode local: ${localProviders.join(' + ')}`
            : 'Mode hors ligne: documents locaux',
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.text, sources: res.sources, type: res.type, videos: res.videos }]);
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
    <div className="flex h-[calc(100vh-1.5rem)] w-full max-w-none flex-col gap-5 overflow-x-hidden px-4 pb-4 lg:flex-row lg:pr-[2cm]">
      <div className="order-2 flex min-h-0 flex-1 flex-col lg:order-1 lg:max-w-[58%]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              mode.online
                ? 'border-emerald-400/40 bg-white/80 text-emerald-700'
                : 'border-amber-400/40 bg-white/80 text-amber-700'
            }`}
            title={mode.label}
          >
            {mode.label}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="glass rounded-full px-3 py-1.5 text-xs font-medium text-green-800 transition hover:bg-green-500/20"
              >
                {s}
              </button>
            ))}
          </div>
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                    <Bot size={16} />
                  </span>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                      msg.role === 'user' ? 'bg-green-600 text-white' : 'glass text-neutral-800'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
                      <button
                        onClick={() => speakAnswer(msg.content)}
                        className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 font-medium text-green-700 hover:bg-green-500/25"
                      >
                        <Volume2 size={12} /> Ecouter
                      </button>
                      {msg.sources?.length > 0 && (
                        <span className="text-neutral-500">Sources: {msg.sources.slice(0, 2).map((s) => s.title).join(', ')}</span>
                      )}
                      {msg.videos?.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                            <Youtube size={13} /> Tutoriels video recommandes
                          </div>
                          {msg.videos.map((v) => (
                            <a
                              key={v.id}
                              href={v.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-white/70 px-3 py-2 text-xs text-green-800 transition hover:border-rose-400/40 hover:bg-rose-500/10"
                            >
                              <Youtube size={14} className="mt-0.5 shrink-0 text-rose-400" />
                              <span className="min-w-0">
                                <span className="block truncate">{v.title}</span>
                                <span className="block text-neutral-500">{v.channel}</span>
                              </span>
                            </a>
                          ))}
                        </div>
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white">
                    <User size={16} />
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {busy && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-green-500"
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
                listening ? 'animate-pulse bg-rose-500 text-white' : 'bg-green-500/15 text-green-700 hover:bg-green-500/30'
              } ${!voiceSupported ? 'opacity-40' : ''}`}
            >
              {listening ? <Square size={16} /> : <Mic size={18} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={listening ? 'Je vous ecoute...' : 'Posez votre question telecom...'}
              className="flex-1 bg-transparent px-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-500"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white transition hover:bg-green-500 disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      </div>

      <StickmanCanvas scene={activeScene.scene} app={activeScene.app} title={activeScene.title} />
      <div ref={robotRef} className="mascot-container">
        <Robot
          talking={speaking}
          speaking={speaking}
          size={robotSize}
          message={
            busy
              ? 'Je cherche dans la documentation Matrix...'
              : speaking
                ? 'Je reponds...'
                : activeScene.title || 'Posez-moi une question !'
          }
        />
      </div>
    </div>
  );
}
