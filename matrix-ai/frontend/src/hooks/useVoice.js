import { useCallback, useRef, useState } from 'react';

export function useVoice() {
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(() => {
    return typeof navigator !== 'undefined'
      && navigator.mediaDevices
      && typeof MediaRecorder !== 'undefined';
  });
  const [error, setError] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {};

      recorder.start();
      setRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone refuse. Autorisez l\'acces dans les parametres du navigateur.');
      } else if (err.name === 'NotFoundError') {
        setError('Aucun microphone detecte.');
      } else {
        setError('Impossible d\'accder au microphone.');
      }
      setVoiceSupported(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setRecording(false);
        resolve('');
        return;
      }

      recorder.onstop = async () => {
        setRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 100) {
          resolve('');
          return;
        }

        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          const res = await fetch('/api/voice', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erreur de transcription');
          resolve(data.text || '');
        } catch (err) {
          setError(err.message || 'Echec de la transcription');
          resolve('');
        }
      };

      recorder.stop();
    });
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
      utter.onend = () => { setSpeaking(false); resolve(); };
      utter.onerror = () => { setSpeaking(false); resolve(); };
      speechSynthesis.cancel();
      speechSynthesis.speak(utter);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return {
    recording,
    speaking,
    voiceSupported,
    error,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
  };
}
