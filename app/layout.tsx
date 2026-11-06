import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Suspense } from "react";

import { PageBackdrop } from "@/components/page-backdrop";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { WaterCursor } from "@/components/water-cursor";
import { getCurrentUser, isVisitor } from "@/lib/session";
import { getStoriesByAuthor } from "@/lib/store";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HistorAI — When I was your age",
    template: "%s · HistorAI",
  },
  description:
    "Youth ripples joining elder currents — seniors answer real questions and AI turns the answers into readable stories.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, visitor] = await Promise.all([getCurrentUser(), isVisitor()]);
  const tourTrack = user ? user.role : visitor ? "visitor" : null;
  const myStoriesCount =
    user?.role === "river"
      ? (await getStoriesByAuthor(user.id)).filter((story) => story.status !== "published")
          .length
      : 0;  

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="relative flex min-h-screen flex-col">
        <Suspense fallback={null}>
          <TutorialProvider track={tourTrack}>
            <PageBackdrop />
            <WaterCursor />
            <a
              href="#main"
              className="ripple sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ocean focus:px-4 focus:py-2 focus:text-lg focus:font-semibold focus:text-white"
            >
              Skip to content
            </a>
            <SiteHeader user={user ? { id: user.id, name: user.name, role: user.role } : null} />
            <div className="flex w-full flex-1 gap-6">
              <SiteNav
                user={user ? { id: user.id, name: user.name, role: user.role } : null}
                myStoriesCount={myStoriesCount}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <main id="main" className="flex flex-1 flex-col">
                  {children}
                </main>
                <SiteFooter />
              </div>
            </div>
          </TutorialProvider>
        </Suspense>
      </body>
    </html>
  );
}
