import type { Metadata } from "next";
import { SharedView } from "@/components/SharedView";

export const metadata: Metadata = {
  title: "Shared curriculum map · PETE Curriculum Mapper",
  description: "A view-only curriculum map shared from PETE Curriculum Mapper.",
  robots: { index: false, follow: false },
};

export default function ViewPage() {
  return <SharedView />;
}
