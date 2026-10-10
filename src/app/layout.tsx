import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "CareTrace",
  description: "A synthetic women's health history organizer powered by Snowflake and open-weight Llama.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={body.variable}><body>{children}</body></html>;
}
