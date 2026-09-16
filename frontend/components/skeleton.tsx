import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", style, ...props }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Skeleton style={{ height: 14, width: "45%", borderRadius: 4 }} />
        <Skeleton style={{ height: 28, width: 28, borderRadius: "50%" }} />
      </div>
      <Skeleton style={{ height: 32, width: "60%", marginBottom: 8, borderRadius: 6 }} />
      <Skeleton style={{ height: 12, width: "35%", borderRadius: 4 }} />
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="skeleton-card" style={{ height }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Skeleton style={{ height: 16, width: "35%", borderRadius: 4 }} />
        <Skeleton style={{ height: 16, width: "15%", borderRadius: 4 }} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: height - 80, padding: "10px 0" }}>
        {[40, 65, 30, 85, 55, 75, 45, 90, 60, 80].map((h, i) => (
          <Skeleton
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: "4px 4px 0 0",
              opacity: 0.5 + (i % 3) * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table-wrap">
      <div className="skeleton-table-head" style={{ display: "flex", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} style={{ height: 14, flex: c === 0 ? 1.5 : 1, borderRadius: 4 }} />
        ))}
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: "flex",
              gap: 16,
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              opacity: 1 - r * 0.1,
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} style={{ height: 13, flex: c === 0 ? 1.5 : 1, borderRadius: 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 6,
            background: "var(--surface)",
          }}
        >
          <Skeleton style={{ height: 18, width: 18, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton style={{ height: 13, width: "65%", marginBottom: 4, borderRadius: 3 }} />
            <Skeleton style={{ height: 10, width: "40%", borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
