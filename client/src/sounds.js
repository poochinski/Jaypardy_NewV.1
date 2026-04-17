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

export function playDDChime() { playSound("dailydouble.mp3"); }