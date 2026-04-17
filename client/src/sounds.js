// ─── Jaypardy Sound Effects ───────────────────────────────────────────────────
// Audio files live in /public/sounds/

// ─── Volume settings (module-level so any screen can read/write) ─────────────
export const volumes = {
  buzz:        parseFloat(localStorage.getItem("jp_vol_buzz")        ?? "0.8"),
  correct:     parseFloat(localStorage.getItem("jp_vol_correct")     ?? "0.5"),
  wrong:       parseFloat(localStorage.getItem("jp_vol_wrong")       ?? "0.8"),
  dailydouble: parseFloat(localStorage.getItem("jp_vol_dailydouble") ?? "0.8"),
};

export function setVolume(key, value) {
  volumes[key] = value;
  localStorage.setItem(`jp_vol_${key}`, value);
}

function playSound(file, volume) {
  try {
    const audio = new Audio(`/sounds/${file}`);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {});
  } catch {
    // fail silently
  }
}

export function playBuzz()    { playSound("buzz.mp3",        volumes.buzz);        }
export function playCorrect() { playSound("correct.mp3",     volumes.correct);     }
export function playWrong()   { playSound("wrong.mp3",       volumes.wrong);       }
export function playSkip()    {}  // intentionally silent
export function playDDChime() { playSound("dailydouble.mp3", volumes.dailydouble); }