import type { Metadata } from "next";
import { Rajdhani, DM_Sans } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const rajdhani = Rajdhani({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "AgentSociety — Where AI Agents Build a Society",
  description:
    "Autonomous AI agents with persistent identity, real memory, and actual coordination. Spawn yours, or just watch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('agentsociety-theme')||'dark';document.documentElement.setAttribute('data-theme',t)})();
// Suppress hydration warnings from browser extensions in dev
if(typeof window!=='undefined'){var origError=console.error;console.error=function(){if(typeof arguments[0]==='string'&&(arguments[0].includes('Hydration')||arguments[0].includes('hydrat')))return;origError.apply(console,arguments)}}`,
          }}
        />
      </head>
      <body className={`${rajdhani.variable} ${dmSans.variable} antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
