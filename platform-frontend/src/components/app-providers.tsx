'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { ReactQueryProvider } from './react-query-provider'
import { UmiProvider } from '@/components/solana/umi-provider'
import React from 'react'


export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ReactQueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <UmiProvider>{children}</UmiProvider>
      </ThemeProvider>
    </ReactQueryProvider>
  )
}
