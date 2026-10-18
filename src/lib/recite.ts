import { useEffect, useState } from 'react';

export type ReciteVoice = { voice: SpeechSynthesisVoice; script: 'deva' | 'ml' };

/**
 * Sanskrit is read best by a Sanskrit/Hindi/Marathi voice from Devanagari;
 * a Malayalam voice reading the Malayalam script is the next best.
 */
function pick(voices: SpeechSynthesisVoice[]): ReciteVoice | null {
  const by = (re: RegExp) => voices.find((v) => re.test(v.lang));
  const deva = by(/^sa/i) ?? by(/^hi/i) ?? by(/^mr/i) ?? by(/^ne/i);
  if (deva) return { voice: deva, script: 'deva' };
  const ml = by(/^ml/i);
  if (ml) return { voice: ml, script: 'ml' };
  return null;
}

export function useReciteVoice() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voice, setVoice] = useState<ReciteVoice | null>(() => (supported ? pick(speechSynthesis.getVoices()) : null));
  useEffect(() => {
    if (!supported) return;
    const update = () => setVoice(pick(speechSynthesis.getVoices()));
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, [supported]);
  return voice;
}

/** Speaks each line in turn, reporting which line is being recited. Returns a stop function. */
export function recite(
  lines: string[],
  v: ReciteVoice,
  onLine: (i: number) => void,
  onEnd: () => void,
) {
  speechSynthesis.cancel();
  let stopped = false;
  lines.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v.voice;
    u.lang = v.voice.lang;
    u.rate = 0.72;
    u.pitch = 0.92;
    u.onstart = () => !stopped && onLine(i);
    if (i === lines.length - 1) {
      u.onend = () => !stopped && onEnd();
      u.onerror = () => !stopped && onEnd();
    }
    speechSynthesis.speak(u);
  });
  return () => {
    stopped = true;
    speechSynthesis.cancel();
    onEnd();
  };
}
