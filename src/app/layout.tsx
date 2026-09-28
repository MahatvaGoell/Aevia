import type { Metadata } from "next";
import { Big_Shoulders, DM_Mono, Hanken_Grotesk, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({ variable: "--nf-display", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Hanken_Grotesk({ variable: "--nf-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const serif = Playfair_Display({ variable: "--nf-serif", subsets: ["latin"], weight: ["500", "600"] });
const mono = DM_Mono({ variable: "--nf-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Aevia Study Planner",
  description: "Aevia turns your subjects, deadlines and exam dates into a day-by-day study plan.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
