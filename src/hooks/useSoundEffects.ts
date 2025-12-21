import { useCallback, useRef } from "react";

type SoundType = "success" | "error" | "beep" | "warning";

// Audio context for generating sounds
const createAudioContext = () => {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
};

export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "sine") => {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    },
    [getAudioContext]
  );

  const playSound = useCallback(
    (soundType: SoundType) => {
      switch (soundType) {
        case "success":
          // Rising success tone
          playTone(523.25, 0.1); // C5
          setTimeout(() => playTone(659.25, 0.1), 100); // E5
          setTimeout(() => playTone(783.99, 0.15), 200); // G5
          break;
        case "error":
          // Descending error tone
          playTone(392, 0.15, "square"); // G4
          setTimeout(() => playTone(311.13, 0.2, "square"), 150); // Eb4
          break;
        case "beep":
          // Simple beep
          playTone(880, 0.1); // A5
          break;
        case "warning":
          // Double beep warning
          playTone(587.33, 0.1, "triangle"); // D5
          setTimeout(() => playTone(587.33, 0.1, "triangle"), 150);
          break;
      }
    },
    [playTone]
  );

  return { playSound };
}
