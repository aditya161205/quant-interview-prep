import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { ProgressSync } from "@/components/progress-sync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuantPrep — Quant Interview Practice",
  description:
    "Practice quant interview problems and play interactive market-making games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ProgressSync />
          <Navbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
          <footer className="border-t border-border py-6 text-center text-xs text-muted">
            QuantPrep · MVP · Built for interview practice
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
