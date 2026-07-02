import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { DevHmrRecovery } from "@/components/DevHmrRecovery";
import { AppDataProvider } from "@/providers/AppDataProvider";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lahans Insentif Reguler 2026",
  description: "Prototype Skema Insentif Reguler - Plan 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${jakarta.variable} ${mono.variable} font-[family-name:var(--font-jakarta)] antialiased`}
      >
        <DevHmrRecovery />
        <AppDataProvider>
          <AppShell>{children}</AppShell>
        </AppDataProvider>
      </body>
    </html>
  );
}
