import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/**
 * Inter is self-hosted from src/assets/fonts rather than pulled from Google,
 * so the web app and the generated PDFs render from the identical font files.
 */
const inter = localFont({
  src: [
    { path: "../assets/fonts/inter-400.woff", weight: "400", style: "normal" },
    { path: "../assets/fonts/inter-500.woff", weight: "500", style: "normal" },
    { path: "../assets/fonts/inter-600.woff", weight: "600", style: "normal" },
    { path: "../assets/fonts/inter-700.woff", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "LogiFlow — Invoices & Packing Lists",
    template: "%s · LogiFlow",
  },
  description:
    "Create commercial invoices and packing lists with customers, Incoterms and PDF export.",
};

export const viewport: Viewport = {
  themeColor: "#5d87ff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
