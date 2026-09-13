import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-provider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ORBIT — Personal AI Operating System',
  description: 'A private personal AI agent for managing projects, tasks, ideas, research, and productivity.',
  manifest: '/manifest.json',
  applicationName: 'ORBIT',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ORBIT',
  },
  openGraph: {
    title: 'ORBIT — Personal AI Operating System',
    description: 'A private personal AI agent for managing projects, tasks, ideas, research, and productivity.',
    type: 'website',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
};

export const metadataViewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('orbit-theme');if(t){const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light')}}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
