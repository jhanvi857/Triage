"use client";

import React from "react";
import { Clock } from "lucide-react";
import { SystemActivityEvent } from "../lib/types";

interface SystemActivityFeedProps {
  events?: SystemActivityEvent[];
}

const DEFAULT_EVENTS: SystemActivityEvent[] = [
  {
    id: "act-1",
    time: "14:32",
    title: "Recovery action executed",
    description: "PAY-9281 · 4h Cooldown Retry scheduled on HDFC Card rail",
    type: "recovery",
  },
  {
    id: "act-2",
    time: "14:29",
    title: "18 cases moved to review",
    description: "Systemic issuer gateway 504 timeout detected across 3DS cluster",
    type: "review",
  },
  {
    id: "act-3",
    time: "14:21",
    title: "₹42,800 recovered",
    description: "12 recurring subscriptions successfully captured on Razorpay UPI",
    type: "settlement",
  },
  {
    id: "act-4",
    time: "14:17",
    title: "Retry policy updated",
    description: "UPI Autopay cooldown threshold extended to off-peak window",
    type: "policy",
  },
  {
    id: "act-5",
    time: "14:05",
    title: "High-value mandate stopped",
    description: "CASE-6150 (₹12,500) routed to senior retention manager desk",
    type: "review",
  },
];

export const SystemActivityFeed: React.FC<SystemActivityFeedProps> = ({ events }) => {
  const activeEvents = events && events.length > 0 ? events : DEFAULT_EVENTS;

  const getDotColor = (type: string) => {
    switch (type) {
      case "settlement":
        return "bg-[#267571]"; // Aqua / Seafoam
      case "recovery":
        return "bg-[#F38630]"; // Tangerine
      case "policy":
        return "bg-[#1C889E]"; // Cyan
      case "review":
      default:
        return "bg-[#E08E79]"; // Coral
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#CAD4C5] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-dispatch font-bold text-sm tracking-wider text-[#182628] uppercase">
            System Activity
          </h3>
          <p className="font-sans text-xs text-[#506361] mt-0.5">
            Autonomous agent decisions, policy updates, and settlement events
          </p>
        </div>
        <div className="flex items-center space-x-1 font-mono text-[11px] text-[#1C889E] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#69D2E7] animate-pulse" />
          <span>Real-time</span>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-3 pt-1">
        {activeEvents.map((evt) => (
          <div key={evt.id} className="flex items-start space-x-3 text-xs font-sans group">
            {/* Timestamp */}
            <span className="font-mono text-[11px] text-[#506361] shrink-0 pt-0.5">
              {evt.time}
            </span>

            {/* Indicator dot & event body */}
            <div className="flex-1 space-y-0.5 border-l border-[#CAD4C5] pl-3 py-0.5">
              <div className="flex items-center space-x-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(evt.type)}`} />
                <span className="font-semibold text-[#182628]">{evt.title}</span>
              </div>
              <p className="text-[#506361] text-[11px] leading-relaxed">
                {evt.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
