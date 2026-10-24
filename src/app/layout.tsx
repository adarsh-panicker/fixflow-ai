// src/app/layout.tsx
'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/NotificationToast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isAuthPage = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/accept-invitation',
    '/register',
    '/unauthorized',
  ].some((path) => pathname?.startsWith(path));

  return (
    <html lang="en" className="dark">
      <head>
        <title>FixFlow AI — Inventory-Aware IT Diagnostics Workbench</title>
        <meta
          name="description"
          content="Enterprise IT troubleshooting workbench grounding AI diagnostics in registered asset inventories and infrastructure dependencies."
        />
        <meta name="author" content="Adarsh Panicker" />
        <meta name="copyright" content="Copyrighted © 2026 Adarsh Panicker. All rights reserved." />
        <link rel="icon" href="/logo.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen flex antialiased">
        <ToastProvider>
          {isAuthPage ? (
            <div className="min-h-screen w-full bg-slate-950 flex flex-col">
              {children}
            </div>
          ) : (
            <>
              {/* Mobile backdrop */}
              {isSidebarOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-hidden="true"
                />
              )}

              {/* Navigation Sidebar */}
              <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
                <main className="flex-1 overflow-y-auto bg-slate-900/60 flex flex-col justify-between">
                  <div className="p-4 lg:p-6 flex-1">
                    <div className="max-w-7xl mx-auto space-y-6">
                      {children}
                    </div>
                  </div>
                  <Footer />
                </main>
              </div>
            </>
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
