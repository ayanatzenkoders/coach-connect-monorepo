import type { Metadata } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['600', '700'] });
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Coach Connect Operations',
  description: 'Admin and support panel for Coach Connect',
  robots: { index: false, follow: false }, // an internal tool: keep it out of search engines
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
