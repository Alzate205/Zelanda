"use client";

import { useEffect } from "react";
import { SyncEngine } from "@/lib/offline/sync";

export function SyncEngineInit() {
  useEffect(() => {
    SyncEngine.init();
  }, []);
  return null;
}
