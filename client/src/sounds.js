// ─── Jaypardy Sound Effects ───────────────────────────────────────────────────
// Audio files live in /public/sounds/

function playSound(file) {
  try {
    const audio = new Audio(`/sounds/${file}`);
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch {
    // fail silently
  }
}

export function playBuzz()    { playSound("buzz.mp3");    }
export function playCorrect() { playSound("correct.mp3"); }
export function playWrong()   { playSound("wrong.mp3");   }
export function playSkip()    {}  // intentionally silent

// ─── Daily Double chime (Web Audio API — no file needed) ─────────────────────
export function playDDChime() {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const t  = ctx.currentTime + i * 0.18;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    // fail silently
  }
}