"use client";

import { useMemo } from "react";

import { createBrowserClient } from "./client";

export function useSupabase() {
  return useMemo(() => createBrowserClient(), []);
}
