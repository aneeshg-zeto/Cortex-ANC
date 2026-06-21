import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';

import { AuthProvider } from '@/components/auth-provider';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-display',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cortex — Single Brain Platform',
  description:
    'AI-native company platform connecting every business tool into one intelligent system.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeInitScript = `(function(){try{var t=localStorage.getItem('cortex-theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');}catch(e){}})();`;

  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${instrumentSerif.variable} ${jetbrains.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Script id="cortex-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
