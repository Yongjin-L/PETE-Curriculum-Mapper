"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/plan";

/** Primary call to action: "Start mapping", or "Continue your map" when this browser already has one. */
export function ContinueLink({ className }: { className?: string }) {
  const [courses, setCourses] = useState(0);
  useEffect(() => {
    try {
      const plan = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      setCourses(Array.isArray(plan?.courses) ? plan.courses.length : 0);
    } catch {
      /* no saved map */
    }
  }, []);
  return (
    <Link href="/map" className={className}>
      {courses > 0 ? `Continue your map (${courses} course${courses === 1 ? "" : "s"}) →` : "Start mapping, free →"}
    </Link>
  );
}
