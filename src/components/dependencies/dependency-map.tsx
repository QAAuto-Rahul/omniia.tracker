"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Environment } from "@/lib/envpack/types";

type Graph = { services: { id: number; name: string }[]; edges: { from: number; to: number }[] };
const EDGE_COLORS = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#e11d48", "#0891b2", "#65a30d", "#ea580c"];
const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`;

export function DependencyMap({ environment, graph }: { environment: Environment; graph: Graph }) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const canvasWidth = 600;
  const canvasHeight = 500;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const radius = graph.services.length <= 1 ? 0 : Math.min(165, 120 + graph.services.length * 4);
  const positions = useMemo(() => {
    const count = graph.services.length;
    return graph.services.map((service, index) => {
      const angle = (2 * Math.PI * index / Math.max(count, 1)) - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = centerX + cos * radius;
      const y = centerY + sin * radius;
      const labelX = centerX + cos * (radius + 18);
      const labelY = centerY + sin * (radius + 18);
      const labelTransform = Math.abs(cos) > 0.45
        ? cos > 0 ? "translate(0, -50%)" : "translate(-100%, -50%)"
        : sin > 0 ? "translate(-50%, 0)" : "translate(-50%, -100%)";
      const textAlign: CSSProperties["textAlign"] = Math.abs(cos) > 0.45 ? cos > 0 ? "left" : "right" : "center";
      return { ...service, x, y, labelX, labelY, labelTransform, textAlign };
    });
  }, [centerX, centerY, graph.services, radius]);
  const hovered = graph.services.find((service) => service.id === hoveredId);
  const usedBy = hovered
    ? graph.edges.filter((edge) => edge.to === hovered.id).map((edge) => graph.services.find((service) => service.id === edge.from)).filter((service) => service !== undefined)
    : [];
  const incomingIds = new Set(usedBy.map((service) => service.id));
  const activeEdges = hovered ? graph.edges.filter((edge) => edge.to === hovered.id) : [];
  const colorBySource = new Map(activeEdges.map((edge, index) => [edge.from, EDGE_COLORS[index % EDGE_COLORS.length]]));

  return (
    <div className="grid gap-4">
      <div className="relative mx-auto aspect-[6/5] w-full max-w-4xl overflow-hidden rounded-2xl border bg-background">
        <svg className="absolute inset-0 size-full" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-hidden="true">
          <defs>
            {activeEdges.map((edge, index) => (
              <marker key={`${edge.from}:${edge.to}`} id={`used-by-arrow-${edge.from}-${edge.to}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill={EDGE_COLORS[index % EDGE_COLORS.length]} />
              </marker>
            ))}
          </defs>
          <circle cx={centerX} cy={centerY} r={positions.length <= 1 ? 2 : radius}
            className="fill-none stroke-border" strokeWidth="1" strokeDasharray="3 6" />
          {activeEdges.map((edge, index) => {
            const from = positions.find((node) => node.id === edge.from);
            const to = positions.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const inset = 7;
            const startX = from.x + dx / length * inset;
            const startY = from.y + dy / length * inset;
            const endX = to.x - dx / length * inset;
            const endY = to.y - dy / length * inset;
            const bend = index % 2 === 0 ? 22 : -22;
            const controlX = (startX + endX) / 2 - (dy / length) * bend;
            const controlY = (startY + endY) / 2 + (dx / length) * bend;
            const color = EDGE_COLORS[index % EDGE_COLORS.length];
            return <path key={`${edge.from}:${edge.to}`} d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
              fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"
              markerEnd={`url(#used-by-arrow-${edge.from}-${edge.to})`} />;
          })}
        </svg>

        {positions.map((node) => {
          const isHovered = node.id === hoveredId;
          const isUsedBy = incomingIds.has(node.id);
          const isRelated = isHovered || isUsedBy;
          return (
            <div key={node.id}>
              <button type="button" onMouseEnter={() => setHoveredId(node.id)} onFocus={() => setHoveredId(node.id)}
                onBlur={() => setHoveredId(null)} aria-label={node.name} aria-pressed={isHovered} title={node.name}
                className={`absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
                  isHovered ? "scale-150 bg-primary ring-4 ring-primary/15" : isUsedBy ? "ring-2 ring-background" : "bg-muted-foreground/50"
                } ${hovered && !isRelated ? "opacity-30" : "hover:scale-150"}`}
                style={{
                  left: percent(node.x, canvasWidth),
                  top: percent(node.y, canvasHeight),
                  ...(colorBySource.has(node.id) && !isHovered ? { backgroundColor: colorBySource.get(node.id) } : {}),
                }} />
              <span onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => undefined}
                className={`pointer-events-auto absolute -translate-y-1/2 line-clamp-3 whitespace-normal rounded-sm bg-background/95 px-1.5 py-0.5 text-[10px] font-medium leading-tight transition-opacity sm:text-xs ${hovered && !isRelated ? "opacity-30" : ""}`}
                style={{ left: percent(node.labelX, canvasWidth), top: percent(node.labelY, canvasHeight), width: "clamp(56px, 12vw, 128px)", transform: node.labelTransform, textAlign: node.textAlign }}>
                {node.name}
              </span>
            </div>
          );
        })}
        {graph.services.length === 0 && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No services in this environment yet.</p>}
      </div>

      <div aria-live="polite" className="min-h-16 rounded-xl border bg-background px-4 py-3">
        {hovered ? (
          <p className="text-sm">
            <span className="font-semibold">{hovered.name}</span>{" "}
            {usedBy.length
              ? <>is used by {usedBy.map((service) => service.name).join(", ")}.</>
              : <>is not used by other services in {environment.name}.</>}
          </p>
        ) : <p className="text-sm text-muted-foreground">Hover over a service to see which services use it.</p>}
      </div>
    </div>
  );
}
