import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "./store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataAnalyzer",
  description: "Análisis y limpieza de datos CSV",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ colorScheme: 'light' }}
    >
      <body className="min-h-screen w-full flex flex-col" style={{ backgroundColor: '#f8f9fb', color: '#111318' }}>
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
