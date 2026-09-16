// Thin fetch wrapper around the FastAPI backend (http://localhost:8000).
// ponytail: every method is one fetch — no caching, no state. The server is the
// single source of truth; if you want a cache, add a zustand selector over the
// store, not a wrapper here.

import type {
  AgentRun,
  AppConfig,
  ConfigUpdateRequest,
  Dataset,
  DatasetDetails,
  DatasetPreview,
  DatasetProfile,
  InvokeAgentRequest,
  SampleDataset,
  PipelineCompareResult,
  PipelineSnapshot,
} from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? "" : (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8001"));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  parseJson = true,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload && typeof payload === "object" && "detail" in payload) {
        const detail = (payload as { detail: unknown }).detail;
        message = typeof detail === "string" ? detail : JSON.stringify(detail);
      }
    } catch {
      // body wasn't JSON; keep the default message
    }
    throw new HttpError(response.status, message);
  }
  if (!parseJson || response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  base: API_BASE,

  async datasets(): Promise<Dataset[]> {
    return request<Dataset[]>("/api/datasets");
  },

  async samples(): Promise<SampleDataset[]> {
    return request<SampleDataset[]>("/api/datasets/samples");
  },

  async loadSample(sampleId: string): Promise<Dataset> {
    return request<Dataset>(`/api/datasets/samples/${encodeURIComponent(sampleId)}`, {
      method: "POST",
    });
  },

  async loadLocal(directory: string): Promise<Dataset[]> {
    return request<Dataset[]>("/api/datasets/load-local", {
      method: "POST",
      body: JSON.stringify({ directory }),
    });
  },

  async upload(file: File): Promise<Dataset> {
    const form = new FormData();
    form.append("file", file);
    return request<Dataset>("/api/datasets/upload", { method: "POST", body: form });
  },

  async preview(datasetId: string, opts: { offset?: number; limit?: number } = {}): Promise<DatasetPreview> {
    const params = new URLSearchParams();
    if (opts.offset != null) params.set("offset", String(opts.offset));
    if (opts.limit != null) params.set("limit", String(opts.limit));
    const query = params.toString();
    return request<DatasetPreview>(
      `/api/datasets/${encodeURIComponent(datasetId)}${query ? `?${query}` : ""}`,
    );
  },

  async details(datasetId: string): Promise<DatasetDetails> {
    return request<DatasetDetails>(
      `/api/datasets/${encodeURIComponent(datasetId)}/details`,
    );
  },

  async profile(datasetId: string): Promise<DatasetProfile> {
    return request<DatasetProfile>(
      `/api/eda/${encodeURIComponent(datasetId)}/profile`,
    );
  },

  async setActive(datasetId: string): Promise<Dataset> {
    return request<Dataset>(
      `/api/datasets/${encodeURIComponent(datasetId)}/active`,
      { method: "POST" },
    );
  },

  async remove(datasetId: string): Promise<void> {
    return request<void>(
      `/api/datasets/${encodeURIComponent(datasetId)}`,
      { method: "DELETE" },
      false,
    );
  },

  // Agent run lifecycle -----------------------------------------------------

  async invoke(request_: InvokeAgentRequest): Promise<{ run_id: string }> {
    return request<{ run_id: string }>("/api/agents/invoke", {
      method: "POST",
      body: JSON.stringify(request_),
    });
  },

  async run(runId: string): Promise<AgentRun> {
    return request<AgentRun>(`/api/agents/${encodeURIComponent(runId)}`);
  },

  async runs(): Promise<AgentRun[]> {
    return request<AgentRun[]>("/api/agents");
  },

  // Config -----------------------------------------------------------------

  async config(): Promise<AppConfig> {
    return request<AppConfig>("/api/config");
  },

  async updateConfig(update: ConfigUpdateRequest): Promise<AppConfig> {
    return request<AppConfig>("/api/config", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  },

  // Pipeline Studio --------------------------------------------------------

  async pipelineSnapshot(target: string = "model"): Promise<PipelineSnapshot> {
    return request<PipelineSnapshot>(`/api/pipeline?target=${encodeURIComponent(target)}`);
  },

  async pipelineScript(targetId?: string): Promise<string> {
    const url = `${API_BASE}/api/pipeline/script${targetId ? `?target_id=${encodeURIComponent(targetId)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new HttpError(res.status, "Failed to fetch pipeline script");
    return res.text();
  },

  async pipelineSpec(target: string = "model"): Promise<Record<string, any>> {
    return request<Record<string, any>>(`/api/pipeline/spec?target=${encodeURIComponent(target)}`);
  },

  async pipelineRegistry(): Promise<Record<string, any>> {
    return request<Record<string, any>>("/api/pipeline/registry");
  },

  async pipelineUndo(): Promise<Dataset | null> {
    return request<Dataset | null>("/api/pipeline/undo", { method: "POST" });
  },

  async pipelineRedo(): Promise<Dataset | null> {
    return request<Dataset | null>("/api/pipeline/redo", { method: "POST" });
  },

  async pipelineCompare(nodeA: string, nodeB: string): Promise<PipelineCompareResult> {
    return request<PipelineCompareResult>(
      `/api/pipeline/compare?node_a=${encodeURIComponent(nodeA)}&node_b=${encodeURIComponent(nodeB)}`
    );
  },

  async runDraft(datasetId: string, code: string, stage: string = "custom"): Promise<Dataset> {
    return request<Dataset>("/api/pipeline/run-draft", {
      method: "POST",
      body: JSON.stringify({ dataset_id: datasetId, code, stage }),
    });
  },

  async deletePipelineNode(datasetId: string, clearHistory: boolean = false): Promise<void> {
    return request<void>(
      `/api/pipeline/nodes/${encodeURIComponent(datasetId)}?clear_history=${clearHistory}`,
      { method: "DELETE" },
      false,
    );
  },
};

// Subscribes to /api/agents/{id}/events (SSE) and invokes `onUpdate` with the
// parsed AgentRun payload. Falls back to polling if SSE errors or disconnects.
// Returns a cleanup function.
export function streamRun(
  runId: string,
  onUpdate: (run: AgentRun) => void,
  onError?: (message: string) => void,
): () => void {
  const url = `${API_BASE}/api/agents/${encodeURIComponent(runId)}/events`;
  let source: EventSource | null = null;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stopPolling = () => {
    if (pollingTimer != null) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  const startPolling = () => {
    if (closed || pollingTimer != null) return;
    pollingTimer = setInterval(async () => {
      if (closed) {
        stopPolling();
        return;
      }
      try {
        const run = await api.run(runId);
        onUpdate(run);
        if (run.status === "completed" || run.status === "failed") {
          stopPolling();
        }
      } catch (err) {
        stopPolling();
        onError?.(err instanceof Error ? err.message : String(err));
      }
    }, 1500);
  };

  try {
    source = new EventSource(url);
    const handler = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as AgentRun;
        onUpdate(payload);
        if (payload.status === "completed" || payload.status === "failed") {
          source?.close();
          source = null;
          stopPolling();
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : String(err));
      }
    };
    source.addEventListener("status", handler);
    source.addEventListener("complete", handler);
    source.addEventListener("error", () => {
      // If EventSource drops or closes, seamlessly fallback to polling
      if (!source || source.readyState === EventSource.CLOSED || source.readyState === EventSource.CONNECTING) {
        source?.close();
        source = null;
        startPolling();
      }
    });
  } catch {
    startPolling();
  }

  return () => {
    closed = true;
    stopPolling();
    if (source) {
      source.close();
      source = null;
    }
  };
}

export { HttpError };
