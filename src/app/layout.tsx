import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareTrace — Every insight, backed by evidence",
  description: "A synthetic women's health history organizer powered by Snowflake and open-weight Llama.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
