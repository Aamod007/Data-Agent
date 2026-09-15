"use client";

import { create } from "zustand";
import type { AgentKind, Dataset } from "@/lib/types";

export type InspectorTabType = "overview" | "eda" | "schema";

type WorkspaceState = {
  datasets: Dataset[];
  activeDatasetId: string | null;
  leftSidebarOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTabType;
  selectedAgent: AgentKind;
  autoRoute: boolean;
  setDatasets: (datasets: Dataset[]) => void;
  setActive: (datasetId: string | null) => void;
  toggleLeftSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTabType) => void;
  setSelectedAgent: (agent: AgentKind) => void;
  setAutoRoute: (autoRoute: boolean) => void;
};

// Field-level comparison so a refresh returning identical data is a no-op.
const sameDatasets = (a: Dataset[], b: Dataset[]) =>
  a.length === b.length &&
  a.every((d, i) => {
    const e = b[i];
    return (
      d.id === e.id &&
      d.name === e.name &&
      d.stage === e.stage &&
      d.is_active === e.is_active &&
      d.shape[0] === e.shape[0] &&
      d.shape[1] === e.shape[1]
    );
  });

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  datasets: [],
  activeDatasetId: null,
  leftSidebarOpen: true,
  inspectorOpen: true,
  inspectorTab: "overview",
  selectedAgent: "analyst",
  autoRoute: true,
  setDatasets: (datasets) =>
    set((state) => {
      const activeDatasetId =
        state.activeDatasetId && datasets.some((d) => d.id === state.activeDatasetId)
          ? state.activeDatasetId
          : datasets.find((d) => d.is_active)?.id ?? datasets[0]?.id ?? null;

      // Returning the same state makes zustand skip notifying subscribers.
      // Without this every background refresh re-rendered the whole tree.
      if (
        activeDatasetId === state.activeDatasetId &&
        sameDatasets(state.datasets, datasets)
      ) {
        return state;
      }
      return { datasets, activeDatasetId };
    }),
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
