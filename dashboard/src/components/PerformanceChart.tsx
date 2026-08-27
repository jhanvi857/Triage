"use client";

import React, { useState } from "react";
import { TrendingUp } from "lucide-react";

interface PerformanceChartProps {
  currentRecoveryINR?: number;
}

const HISTORICAL_DATA = [
  { date: "Aug 20", ai: 3.2, baseline: 1.8 },
  { date: "Aug 21", ai: 4.1, baseline: 2.1 },
  { date: "Aug 22", ai: 4.9, baseline: 2.3 },
  { date: "Aug 23", ai: 5.8, baseline: 2.6 },
  { date: "Aug 24", ai: 6.4, baseline: 2.9 },
  { date: "Aug 25", ai: 7.2, baseline: 3.1 },
  { date: "Aug 26", ai: 8.42, baseline: 3.4 },
];

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ currentRecoveryINR }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const data = HISTORICAL_DATA.map((d, i) => {
    if (i === HISTORICAL_DATA.length - 1 && currentRecoveryINR !== undefined) {
      const dynamicAi = Number((7.20 + (currentRecoveryINR / 100000)).toFixed(2));
      return { ...d, ai: Math.max(7.84, dynamicAi) };
    }
    return d;
  });

  const maxVal = 10.0;
  const svgWidth = 560;
  const svgHeight = 160;
  const paddingX = 35;
  const paddingY = 20;

  const getX = (index: number) => {
    return paddingX + (index * (svgWidth - paddingX * 2)) / (data.length - 1);
  };

  const getY = (val: number) => {
    return svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
  };

  const aiPoints = data.map((d, i) => `${getX(i)},${getY(d.ai)}`).join(" ");
  const baselinePoints = data.map((d, i) => `${getX(i)},${getY(d.baseline)}`).join(" ");

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 font-sans space-y-3">
      {/* Header + Legend */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[14px] tracking-wide text-[#202525] uppercase">
            Recovery Performance
          </h3>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Cumulative recovered revenue (INR Lakhs)
          </p>
        </div>

        <div className="flex items-center space-x-4 text-[12px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-0.5 bg-[#087F83]" />
            <span className="font-medium text-[#202525]">ML Policy</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-0.5 border-t border-dashed border-[#6F7777]" />
            <span className="font-normal text-[#6F7777]">Baseline</span>
          </div>
        </div>
      </div>

      {/* Clean SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-36 select-none">
          {/* Horizontal grid lines */}
          {[0, 3, 6, 9].map((val) => (
            <g key={val}>
              <line
                x1={paddingX}
                y1={getY(val)}
                x2={svgWidth - paddingX}
                y2={getY(val)}
                stroke="#E2E5E5"
                strokeWidth="1"
              />
              <text
                x={paddingX - 6}
                y={getY(val) + 3}
                textAnchor="end"
                className="text-[9px] fill-[#6F7777] font-mono"
              >
                ₹{val}L
              </text>
            </g>
          ))}

          {/* Baseline Line */}
          <polyline
            fill="none"
            stroke="#6F7777"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            points={baselinePoints}
          />

          {/* ML Policy Line */}
          <polyline
            fill="none"
            stroke="#087F83"
            strokeWidth="2.5"
            points={aiPoints}
          />

          {/* Points & Hover Target */}
          {data.map((d, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g
                key={d.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <circle
                  cx={getX(i)}
                  cy={getY(d.baseline)}
                  r={isHovered ? 3.5 : 2}
                  fill="#6F7777"
                />
                <circle
                  cx={getX(i)}
                  cy={getY(d.ai)}
                  r={isHovered ? 4.5 : 2.5}
                  fill="#087F83"
                />
                <text
                  x={getX(i)}
                  y={svgHeight - 4}
                  textAnchor="middle"
                  className={`text-[9px] font-mono ${isHovered ? "fill-[#202525] font-bold" : "fill-[#6F7777]"}`}
                >
                  {d.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Minimal Tooltip */}
        {hoveredIndex !== null && (
          <div className="absolute top-1 right-2 bg-[#FFFFFF] border border-[#E2E5E5] px-2.5 py-1.5 rounded shadow-sm text-xs font-sans space-y-0.5 pointer-events-none">
            <div className="font-semibold text-[#202525]">
              {data[hoveredIndex].date}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#087F83] font-medium">ML Policy:</span>
              <span className="font-mono font-bold text-[#202525]">₹{data[hoveredIndex].ai}L</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6F7777]">Baseline:</span>
              <span className="font-mono text-[#6F7777]">₹{data[hoveredIndex].baseline}L</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
