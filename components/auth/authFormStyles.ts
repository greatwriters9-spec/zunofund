export function authFieldClass(hasError: boolean, theme: "light" | "dark" = "light") {
  if (theme === "dark") {
    return `w-full rounded-2xl border bg-zinc-900 px-5 py-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-600 focus:ring-2 focus:ring-yellow-500/20 ${
      hasError
        ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
        : "border-zinc-700 focus:border-yellow-500"
    }`;
  }

  return `w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-all duration-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-[#D4AF37]/15 ${
    hasError
      ? "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.15)]"
      : "border-zinc-200 focus:border-[#D4AF37]/60"
  }`;
}

export function authLabelClass(theme: "light" | "dark" = "light") {
  return theme === "dark"
    ? "mb-3 block text-sm text-zinc-400"
    : "mb-2 block text-sm font-medium text-zinc-800";
}
