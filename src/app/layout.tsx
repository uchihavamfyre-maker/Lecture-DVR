import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lecture DVR — Capture the signal",
  description: "Live lecture capture with AI-filtered academic signals and instant lecture recovery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
