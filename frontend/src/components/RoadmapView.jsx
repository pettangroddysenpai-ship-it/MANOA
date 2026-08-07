import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Check, ChevronDown, Play, Terminal, Star, Award, Flame } from 'lucide-react';
import { api } from '../services/api.js';

const STEP_ICON = { info: Play, run: Terminal, quiz: Star };

export default function RoadmapView({ entry, onXpGained }) {
  const initialSteps = entry.steps.map((s) => ({ ...s, completed: !!s.completed }));
  const [steps, setSteps] = useState(initialSteps);
  const [openIndex, setOpenIndex] = useState(initialSteps.findIndex((s) => !s.completed));
  const [quizChoice, setQuizChoice] = useState(null);
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xpFlash, setXpFlash] = useState(null);

  const isUnlocked = (i) => i === 0 || steps[i - 1].completed;

  const flash = (text) => {
    setXpFlash(text);
    setTimeout(() => setXpFlash(null), 2600);
  };

  const answerQuiz = (stepIndex, choice) => {
    const step = steps[stepIndex];
    if (!step.quiz) return;
    if (choice === step.quiz.answerIndex) {
      setQuizChoice(choice);
      setWrong(false);
      completeStep(stepIndex);
    } else {
      setWrong(true);
      setQuizChoice(choice);
    }
  };

  const completeStep = async (stepIndex) => {
    if (busy || steps[stepIndex].completed) return;
    setBusy(true);
    try {
      const res = await api.completeStep(entry.id, stepIndex);
      setSteps((prev) => prev.map((s, i) => (i === stepIndex ? { ...s, completed: true } : s)));
      flash(`+${res.xpEarned} XP`);
      if (res.allDone) flash(`Roadmap terminee ! +${res.xpEarned} XP`);
      if (onXpGained) onXpGained(res.user);
      setOpenIndex((prev) => {
        const next = prev + 1;
        return next < steps.length ? next : prev;
      });
    } catch (e) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const allDone = steps.every((s) => s.completed);
  const doneCount = steps.filter((s) => s.completed).length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-slate-100">
          <Award className="text-amber-400" size={26} />
          {entry.title}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-sm text-slate-300">
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-300">
            {doneCount}/{steps.length} etapes
          </span>
          <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-300">
            <Flame size={12} className="mr-1 inline" />
            serie
          </span>
        </div>
        <div className="mx-auto mt-3 h-2 w-56 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
            animate={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence>
        {xpFlash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-6 top-6 z-50 rounded-xl bg-amber-500 px-4 py-2 font-bold text-slate-900 shadow-lg"
          >
            {xpFlash}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1">
        {steps.map((step, i) => {
          const unlocked = isUnlocked(i);
          const completed = step.completed;
          const Icon = STEP_ICON[step.type] || Play;
          return (
            <div key={i}>
              {i > 0 && (
                <div className={`mx-auto h-5 w-0.5 ${steps[i - 1].completed ? 'bg-emerald-400' : 'bg-slate-700'}`} />
              )}
              <motion.button
                layout
                onClick={() => unlocked && setOpenIndex(openIndex === i ? null : i)}
                disabled={!unlocked}
                whileTap={unlocked ? { scale: 0.97 } : {}}
                className={`w-full rounded-2xl border p-3 text-left transition-all ${
                  openIndex === i
                    ? 'border-blue-400 bg-blue-500/15'
                    : completed
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : unlocked
                        ? 'border-blue-400/40 bg-blue-500/5 hover:bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800/40 opacity-55'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      completed
                        ? 'bg-emerald-500 text-white'
                        : unlocked
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {completed ? <Check size={20} /> : unlocked ? <Icon size={18} /> : <Lock size={16} />}
                  </span>
                  <span className="flex-1">
                    <span className={`block font-semibold ${completed ? 'text-emerald-300' : 'text-slate-100'}`}>
                      {step.title}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {completed ? 'Terminee' : unlocked ? 'Cliquez pour ouvrir' : 'Verrouillee'}
                    </span>
                  </span>
                  {unlocked && (
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                    />
                  )}
                </div>
              </motion.button>

              <AnimatePresence>
                {openIndex === i && unlocked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="glass mt-2 rounded-2xl p-4">
                      <p className="text-sm leading-relaxed text-slate-200">{step.description}</p>

                      {step.commands?.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {step.commands.map((cmd, ci) => (
                            <div key={ci} className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-cyan-300">
                              <Terminal size={12} className="mr-2 inline" />
                              {cmd}
                            </div>
                          ))}
                        </div>
                      )}

                      {step.quiz && (
                        <div className="mt-3 rounded-xl bg-slate-900/70 p-3">
                          <p className="mb-2 text-sm font-medium text-slate-100">{step.quiz.question}</p>
                          <div className="space-y-1.5">
                            {step.quiz.options.map((opt, oi) => {
                              const chosen = quizChoice === oi;
                              const isRight = step.completed && oi === step.quiz.answerIndex;
                              return (
                                <button
                                  key={oi}
                                  disabled={step.completed}
                                  onClick={() => answerQuiz(i, oi)}
                                  className={`block w-full rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                                    isRight
                                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                                      : chosen && !step.completed
                                        ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-400'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {wrong && <p className="mt-2 text-xs text-rose-400">Mauvaise reponse, essayez encore !</p>}
                        </div>
                      )}

                      {!step.completed && step.type !== 'quiz' && (
                        <button
                          onClick={() => completeStep(i)}
                          disabled={busy}
                          className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {busy ? '...' : 'Terminer cette etape (+25 XP)'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {allDone && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-6 flex flex-col items-center rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 text-center"
        >
          <Award size={40} className="text-amber-400" />
          <p className="mt-2 text-lg font-bold text-amber-300">Feuille de route terminee !</p>
          <p className="text-sm text-slate-300">+50 XP bonus. Bravo, vous progressez comme un pro.</p>
        </motion.div>
      )}
    </div>
  );
}
