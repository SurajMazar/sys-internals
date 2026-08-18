import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, SceneShell } from "./shared";

export interface ArchitectureDiagramProps {
  kicker?: string;
  heading: string;
  variant: "table" | "bars";
  table?: { columns: string[]; rows: { label: string; cells: string[] }[] };
  bars?: { groupLabel: string; color: string; series: { label: string; value: number }[] }[];
}

export const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ kicker, heading, variant, table, bars }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SceneShell kicker={kicker} heading={heading}>
      {variant === "table" && table && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `340px repeat(${table.columns.length - 1}, 1fr)`,
            gap: 2,
            background: theme.border,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {table.columns.map((c) => (
            <div
              key={c}
              style={{ ...fadeSlideIn(frame, 6, fps), background: theme.panel2, padding: "16px 22px", fontWeight: 700, color: theme.accent, fontSize: 19 }}
            >
              {c}
            </div>
          ))}
          {table.rows.map((row, ri) => (
            <React.Fragment key={row.label}>
              <div style={{ ...fadeSlideIn(frame, 20 + ri * 16, fps), background: theme.panel, padding: "17px 22px", fontWeight: 700, fontSize: 21 }}>
                {row.label}
              </div>
              {row.cells.map((cell, ci) => (
                <div key={ci} style={{ ...fadeSlideIn(frame, 24 + ri * 16, fps), background: theme.panel, padding: "17px 22px", fontSize: 19, color: theme.muted }}>
                  {cell}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      {variant === "bars" && bars && (
        <div style={{ display: "flex", gap: 64 }}>
          {bars.map((group, gi) => (
            <div key={group.groupLabel} style={{ ...fadeSlideIn(frame, gi * 10, fps) }}>
              <div style={{ color: group.color, fontWeight: 700, fontSize: 21, marginBottom: 20 }}>{group.groupLabel}</div>
              <div style={{ display: "flex", gap: 24, alignItems: "flex-end", height: 400 }}>
                {group.series.map((s, si) => {
                  const delay = 24 + gi * 20 + si * 8;
                  const local = Math.max(0, frame - delay);
                  const grown = Math.min(1, local / 20);
                  const h = grown * (s.value / 100) * 360;
                  return (
                    <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 92 }}>
                      <div style={{ opacity: grown, fontWeight: 700, fontSize: 19, marginBottom: 8 }}>{Math.round(grown * s.value)}%</div>
                      <div style={{ width: 60, height: Math.max(2, h), background: group.color, borderRadius: "8px 8px 0 0" }} />
                      <div style={{ marginTop: 12, fontSize: 15, color: theme.muted, textAlign: "center", maxWidth: 100 }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SceneShell>
  );
};
