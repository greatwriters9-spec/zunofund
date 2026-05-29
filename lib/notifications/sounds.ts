/** In-app notification sounds served from /public/sounds/notifications. */

export const NOTIFICATION_SOUND_URLS = {
  /** universfield-new-notification-040 — P2P trades, chat, disputes */
  p2p: "/sounds/notifications/p2p.mp3",
  /** dragon-studio-new-notification-3 — general platform alerts */
  generalA: "/sounds/notifications/general-a.mp3",
  /** universfield-new-notification-014 — general platform alerts (alternate) */
  generalB: "/sounds/notifications/general-b.mp3",
} as const;

const ALL_URLS = Object.values(NOTIFICATION_SOUND_URLS);

let unlocked = false;

function isP2pNotificationType(type: string): boolean {
  const t = type.toLowerCase();
  return t.startsWith("p2p_") || t.includes("p2p");
}

function generalSoundUrl(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("deposit")) return NOTIFICATION_SOUND_URLS.generalA;
  if (t.includes("withdraw")) return NOTIFICATION_SOUND_URLS.generalB;
  if (
    t.includes("profit") ||
    t.includes("compound") ||
    t.includes("principal") ||
    t.includes("bonus")
  ) {
    return NOTIFICATION_SOUND_URLS.generalA;
  }
  if (t.includes("support") || t.includes("ticket") || t.includes("reply")) {
    return NOTIFICATION_SOUND_URLS.generalB;
  }
  return t.length % 2 === 0
    ? NOTIFICATION_SOUND_URLS.generalA
    : NOTIFICATION_SOUND_URLS.generalB;
}

export function notificationSoundUrlForType(
  type?: string | null,
): string {
  const t = (type ?? "").trim();
  if (isP2pNotificationType(t)) return NOTIFICATION_SOUND_URLS.p2p;
  return generalSoundUrl(t);
}

/** Prime audio after a user gesture so later realtime inserts can play. */
export function unlockNotificationAudio(): void {
  if (typeof window === "undefined" || unlocked) return;
  unlocked = true;

  for (const src of ALL_URLS) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.001;
    const playPromise = audio.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          unlocked = false;
        });
    }
  }
}

export function playNotificationSound(type?: string | null): void {
  if (typeof window === "undefined") return;

  const src = notificationSoundUrlForType(type);
  const audio = new Audio(src);
  audio.volume = 0.88;
  void audio.play().catch(() => {
    /* autoplay blocked until unlockNotificationAudio runs */
  });
}

/** Investor / merchant `notifications` row insert. */
export function playInvestorNotificationSound(type?: string | null): void {
  playNotificationSound(type);
}

/** Admin desk `admin_notifications` row insert. */
export function playAdminNotificationSound(type?: string | null): void {
  playNotificationSound(type);
}
