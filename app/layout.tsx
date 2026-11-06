import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETE Curriculum Mapper",
  description:
    "Map key topics, textbook chapters and SHAPE America standards across the courses of a physical education teacher education program.",
  authors: [{ name: "Yongjin Lee", url: "https://yongjin.info" }],
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
