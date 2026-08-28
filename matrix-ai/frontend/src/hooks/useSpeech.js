import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recRef = useRef(null);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceSupported(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    const stopTimer = setTimeout(() => setVoiceSupported(true), 0);
    return () => {
      clearTimeout(stopTimer);
      try {
        rec.abort();
      } catch {}
    };
  }, []);

  const listen = useCallback((onResult) => {
    return new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve('');
      let done = false;
      const finish = (text) => {
        if (done) return;
        done = true;
        setListening(false);
        resolve(text);
      };
      rec.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript || '';
        finish(text);
        if (onResult) onResult(text);
      };
      rec.onerror = () => finish('');
      rec.onend = () => finish('');
      setListening(true);
      try {
        rec.start();
      } catch {
        finish('');
      }
    });
  }, []);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const speak = useCallback((text, { rate = 1 } = {}) => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'fr-FR';
      utter.rate = rate;
      const voice = speechSynthesis
        .getVoices()
        .find((v) => v.lang.toLowerCase().startsWith('fr'));
      if (voice) utter.voice = voice;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => {
        setSpeaking(false);
        resolve();
      };
      utter.onerror = () => {
        setSpeaking(false);
        resolve();
      };
      speechSynthesis.cancel();
      speechSynthesis.speak(utter);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { listening, speaking, voiceSupported, listen, stopListening, speak, stopSpeaking };
}
