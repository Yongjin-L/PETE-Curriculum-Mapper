import raw from "@/public/data/dataset.json";
import type { Component, Dataset, Standard } from "./types";

export const dataset = raw as unknown as Dataset;
export const DATASET_SOURCE = dataset.source;

/** Standards and components with lookups. */
export interface Library {
  standards: Standard[];
  components: Component[];
  componentById: Map<string, Component>;
  standardById: Map<string, Standard>;
  componentsByStandard: Map<string, Component[]>;
}

let cached: Library | null = null;

export function getLibrary(): Library {
  if (cached) return cached;
  const componentsByStandard = new Map<string, Component[]>();
  for (const c of dataset.components) {
    const list = componentsByStandard.get(c.standard_id) ?? [];
    list.push(c);
    componentsByStandard.set(c.standard_id, list);
  }
  cached = {
    standards: dataset.standards,
    components: dataset.components,
    componentById: new Map(dataset.components.map((c) => [c.component_id, c])),
    standardById: new Map(dataset.standards.map((s) => [s.standard_id, s])),
    componentsByStandard,
  };
  return cached;
}

/** "3.b Progressive, sequential content" */
export const componentTitle = (c: Component) => `${c.component_id} ${c.label}`;

/** "Standard 3: Planning and Implementation" */
export const standardTitle = (s: Standard) => `Standard ${s.standard_no}: ${s.title}`;
