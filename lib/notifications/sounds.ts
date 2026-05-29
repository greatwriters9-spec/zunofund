const ctxRef: { ctx: AudioContext | null } = { ctx: null };

/** Short synthetic cues — no mp3 latency; tweak frequencies per notification family. */
const PRESETS = {
  deposit: { frequency: 520, decay: 0.18 },
  withdrawal: { frequency: 360, decay: 0.2 },
  profit: { frequency: 660, decay: 0.16 },
  support: { frequency: 880, decay: 0.22 },
  admin: { frequency: 300, decay: 0.25 },
  neutral: { frequency: 600, decay: 0.15 },
} as const;

function cueFamily(type: string) {
  const t = type.toLowerCase();
  if (t.includes("deposit")) return PRESETS.deposit;
  if (t.includes("withdraw")) return PRESETS.withdrawal;
  if (
    t.includes("profit") ||
    t.includes("compound") ||
    t.includes("principal")
  )
    return PRESETS.profit;
  if (t.includes("support") || t.includes("ticket"))
    return PRESETS.support;
  return PRESETS.neutral;
}

function resumeContext(audioContext: AudioContext) {
  if (audioContext.state === "suspended") void audioContext.resume();
}

/** Investor-facing notification chirp derived from Postgres `notifications.type`. */
export function playInvestorNotificationSound(type?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (
      window as typeof window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;
    if (!AudioCtx) return;

    ctxRef.ctx ??= new AudioCtx();
    const audioContext = ctxRef.ctx;
    resumeContext(audioContext);

    const { frequency, decay } = cueFamily(type ?? "");
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  } catch {
    /* ignore autoplay failures */
  }
}

export function playAdminNotificationSound(theme?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (
      window as typeof window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;
    if (!AudioCtx) return;

    ctxRef.ctx ??= new AudioCtx();
    const audioContext = ctxRef.ctx;
    resumeContext(audioContext);

    const base =
      (theme ?? "").includes("withdraw")
        ? 280
        : (theme ?? "").includes("deposit")
          ? PRESETS.deposit.frequency
          : (theme ?? "").includes("ticket")
            ? 720
            : PRESETS.admin.frequency;

    const now = audioContext.currentTime;

    const playTone = (
      hz: number,
      offset: number,
      decay: number,
      vol: number,
    ) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(hz, now + offset);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(vol, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + decay);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + offset);
      osc.stop(now + offset + decay + 0.05);
    };

    playTone(base, 0, 0.16, 0.08);
    playTone(base * 1.32, 0.12, 0.14, 0.07);
  } catch {
    /* ignore autoplay failures */
  }
}
