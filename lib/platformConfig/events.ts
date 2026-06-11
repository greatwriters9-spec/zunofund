/** Fired after admin saves promotion/plan/announcement settings — triggers live client refresh. */
export const PLATFORM_CONFIG_CHANGED_EVENT = "tp:platform-config-changed";

export function notifyPlatformConfigChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLATFORM_CONFIG_CHANGED_EVENT));
}
