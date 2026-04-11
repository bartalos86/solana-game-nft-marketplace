"use client";

import { EthProvider } from "@/components/eth/eth-provider";
import React from "react";

export function AppProviders({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <EthProvider>{children}</EthProvider>;
}
