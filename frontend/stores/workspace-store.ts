"use client";

import { create } from "zustand";
import type { Dataset } from "@/lib/types";

export type InspectorTabType = "overview" | "eda" | "schema";

type WorkspaceState = {
  datasets: Dataset[];
  activeDatasetId: string | null;
  leftSidebarOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTabType;
  selectedAgent: string;
  autoRoute: boolean;
  setDatasets: (datasets: Dataset[]) => void;
  setActive: (datasetId: string | null) => void;
  toggleLeftSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTabType) => void;
  setSelectedAgent: (agent: string) => void;
  setAutoRoute: (autoRoute: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  datasets: [],
  activeDatasetId: null,
  leftSidebarOpen: true,
  inspectorOpen: true,
  inspectorTab: "overview",
  selectedAgent: "analyst",
  autoRoute: true,
  setDatasets: (datasets) =>
    set((state) => ({
      datasets,
      activeDatasetId:
        state.activeDatasetId && datasets.some((d) => d.id === state.activeDatasetId)
          ? state.activeDatasetId
          : datasets.find((d) => d.is_active)?.id ?? datasets[0]?.id ?? null,
    })),
  setActive: (activeDatasetId) => set({ activeDatasetId }),
  toggleLeftSidebar: () =>
    set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
  setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
  toggleInspector: () =>
    set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab, inspectorOpen: true }),
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
  setAutoRoute: (autoRoute) => set({ autoRoute }),
}));
