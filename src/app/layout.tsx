import type { Metadata } from "next";
import {
  Archivo,
  Barlow,
  Barlow_Condensed,
  Figtree,
  Geist,
  Geist_Mono,
  Hanken_Grotesk,
  Overpass,
  Overpass_Mono,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import "./designs.css";
import { DESIGN_BOOT, DesignSwitcher } from "@/components/design-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { ProgressSync } from "@/components/progress-sync";
import { DesignShell } from "@/components/shells/design-shell";
import { getDesign, OWN_LAYOUT } from "@/lib/design";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Faces for the redesign candidates (see designs.css).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});
const overpass = Overpass({ variable: "--font-overpass", subsets: ["latin"] });
const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin"],
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});
const fontVars = [
  archivo,
  barlow,
  barlowCondensed,
  overpass,
  overpassMono,
  hanken,
  figtree,
  sourceSans,
  sourceSerif,
]
  .map((f) => f.variable)
  .join(" ");

const comparingDesigns = process.env.NODE_ENV !== "production";

export const metadata: Metadata = {
  title: "QuantPrep — Quant Interview Practice",
  description:
    "Practice quant interview problems and play interactive market-making games.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const design = await getDesign();
  return (
    <html
      lang="en"
      data-design={comparingDesigns ? design : undefined}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fontVars} h-full antialiased`}
    >
      {comparingDesigns && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: DESIGN_BOOT }} />
        </head>
      )}
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ProgressSync />
          {/* Skip link — invisible until it takes keyboard focus, then pinned
              above the sticky navbar so the ~7 nav tab stops can be bypassed. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:border focus:border-accent/30 focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          {comparingDesigns && <DesignSwitcher />}
          {OWN_LAYOUT.has(design) ? (
            <DesignShell design={design}>{children}</DesignShell>
          ) : (
            <>
              <Navbar />
              {/* The app sits in an inset panel so the ambient light reads as
              coming from behind the product rather than washing over it. */}
              <div className="site-shell mx-auto w-full max-w-[96rem] flex-1 px-3 pb-6 pt-3 sm:px-4">
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="site-main h-full rounded-[1.75rem] border border-border/70 bg-surface/40 px-4 py-6 backdrop-blur-sm focus:outline-none sm:px-6 sm:py-7"
                >
                  {children}
                </main>
              </div>
              <footer className="site-footer pb-8 text-center text-2xs uppercase tracking-[0.18em] text-muted">
                QuantPrep
              </footer>
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
