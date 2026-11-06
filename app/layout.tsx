import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETE Curriculum Mapper",
  description:
    "Map key topics, textbook chapters and SHAPE America standards across the courses of a physical education teacher education program.",
  authors: [{ name: "Yongjin Lee", url: "https://yongjin.info" }],
  metadataBase: new URL("https://curriculum.yongjin.info"),
  openGraph: {
    title: "PETE Curriculum Mapper",
    description: "Free tool for PETE faculty: map key topics, textbook chapters and SHAPE America standards across your program's courses.",
    url: "https://curriculum.yongjin.info",
    siteName: "PETE Curriculum Mapper",
    type: "website",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
