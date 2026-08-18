import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeSlideIn, popIn, SceneShell, Panel } from "./shared";

export interface ConceptSceneProps {
  kicker?: string;
  heading: string;
  tone?: "neutral" | "warn" | "ok";
  variant?: "bullets" | "steps" | "profile" | "table";
  bullets?: string[];
  steps?: string[];
  profile?: { name: string; role: string; detail: string; verdict: string };
  table?: { columns: string[]; rows: { cells: string[] }[] };
}

const toneColor = (tone: ConceptSceneProps["tone"]) =>
  tone === "warn" ? theme.warn : tone === "ok" ? theme.ok : theme.accent;

export const ConceptScene: React.FC<ConceptSceneProps> = ({
  kicker,
  heading,
  tone = "neutral",
  variant = "bullets",
  bullets = [],
  steps = [],
  profile,
  table,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = toneColor(tone);

  return (
    <SceneShell kicker={kicker} heading={heading} accent={accent}>
      {variant === "bullets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {bullets.map((b, i) => (
            <div
              key={i}
              style={{ ...fadeSlideIn(frame, 20 + i * 14, fps), display: "flex", gap: 18, alignItems: "flex-start" }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 6, background: accent, marginTop: 12, flexShrink: 0 }} />
              <div style={{ fontSize: 29, color: theme.text, lineHeight: 1.4, maxWidth: 1500 }}>{b}</div>
            </div>
          ))}
        </div>
      )}

      {variant === "steps" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ ...popIn(frame, 16 + i * 12, fps) }}>
              <Panel style={{ width: 250, minHeight: 150 }}>
                <div style={{ color: accent, fontWeight: 800, fontSize: 28, marginBottom: 10 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: 20, color: theme.text, lineHeight: 1.35 }}>{s}</div>
              </Panel>
            </div>
          ))}
        </div>
      )}

      {variant === "profile" && profile && (
        <div style={{ ...fadeSlideIn(frame, 16, fps) }}>
          <Panel style={{ maxWidth: 1300 }}>
            <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>{profile.name}</div>
            <div style={{ color: theme.muted, fontSize: 20, marginBottom: 22 }}>{profile.role}</div>
            <div style={{ fontSize: 23, lineHeight: 1.5, marginBottom: 22 }}>{profile.detail}</div>
            <div
              style={{
                ...popIn(frame, 60, fps),
                color: accent,
                fontSize: 23,
                fontWeight: 700,
                borderTop: `1px solid ${theme.border}`,
                paddingTop: 18,
              }}
            >
              → {profile.verdict}
            </div>
          </Panel>
        </div>
      )}

      {variant === "table" && table && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${table.columns.length}, 1fr)`,
            gap: 2,
            background: theme.border,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {table.columns.map((c) => (
            <div
              key={c}
              style={{ ...fadeSlideIn(frame, 6, fps), background: theme.panel2, padding: "14px 20px", fontWeight: 700, color: accent, fontSize: 18 }}
            >
              {c}
            </div>
          ))}
          {table.rows.map((row, ri) => (
            <React.Fragment key={ri}>
              {row.cells.map((cell, ci) => (
                <div
                  key={ci}
                  style={{
                    ...fadeSlideIn(frame, 22 + ri * 14, fps),
                    background: theme.panel,
                    padding: "16px 20px",
                    fontSize: 18,
                    color: ci === 0 ? theme.text : theme.muted,
                    fontWeight: ci === 0 ? 700 : 400,
                  }}
                >
                  {cell}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </SceneShell>
  );
};
