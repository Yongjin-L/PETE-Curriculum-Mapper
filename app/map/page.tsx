import type { Metadata } from "next";
import { Mapper } from "@/components/Mapper";

export const metadata: Metadata = { title: "Map · PETE Curriculum Mapper" };

export default function MapPage() {
  return <Mapper />;
}
