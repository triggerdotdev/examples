"use client";

import { createContext, useContext } from "react";

export type VisualizationElementKeyResolver = (element: object) => string;

export const VisualizationElementKeyContext =
  createContext<VisualizationElementKeyResolver>(() => "visualization:unknown");

export function useVisualizationElementKey(element: object): string {
  return useContext(VisualizationElementKeyContext)(element);
}
