import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETE Curriculum Mapper",
  description:
    "Map the SHAPE America 2017 Initial PETE Standards and components across the courses of a physical education teacher education program. Upload a plan of study and review an AI-suggested matching.",
  authors: [{ name: "Yongjin Lee", url: "https://yongjin.info" }],
  metadataBase: new URL("https://curriculum.yongjin.info"),
  openGraph: {
    title: "PETE Curriculum Mapper",
    description: "Free tool for PETE faculty: upload your plan of study and map the SHAPE America Initial PETE Standards across your courses.",
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
