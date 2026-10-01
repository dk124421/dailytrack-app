import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "DailyTrack - Personal Habit & Activity Tracker",
  description: "Track your daily habits, build streaks, and visualize your progress with DailyTrack.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DailyTrack",
  },
  openGraph: {
    title: "DailyTrack",
    description: "Simple personal habit & activity tracker",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-dvh bg-neutral-50 antialiased">
        <ServiceWorkerRegistration />
        <AuthProvider>
          <div className="mx-auto max-w-[600px] min-h-dvh relative">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
