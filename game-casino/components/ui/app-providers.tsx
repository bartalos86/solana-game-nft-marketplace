"use client";

import { UmiProvider } from "@/components/solana/umi-provider";
import React from "react";

export function AppProviders({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UmiProvider>{children}</UmiProvider>;
}
