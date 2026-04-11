'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { ReactQueryProvider } from './react-query-provider'
import { EvmProvider } from '@/components/ethereum/evm-provider'
import React from 'react'


export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ReactQueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <EvmProvider>{children}</EvmProvider>
      </ThemeProvider>
    </ReactQueryProvider>
  )
}
