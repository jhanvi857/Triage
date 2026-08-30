"use client";

import React from "react";
import {
  LayoutDashboard,
  RotateCcw,
  Layers,
  BarChart3,
  ShieldCheck,
  Calendar,
  FileText,
  Settings as SettingsIcon,
} from "lucide-react";

export type NavTab =
  | "OVERVIEW"
  | "RECOVERY"
  | "CASES"
  | "ALLOCATOR"
  | "EVALUATION"
  | "AUDIT"
  | "PTP"
  | "REPORTS"
  | "SETTINGS";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  exceptionCount: number;
  totalCasesCount: number;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  exceptionCount,
  totalCasesCount,
}) => {
  const NAV_ITEMS: NavItemConfig[] = [
    { id: "OVERVIEW", label: "Live Operations", icon: LayoutDashboard },
    { id: "RECOVERY", label: "Recovery Queue", icon: RotateCcw },
    { id: "CASES", label: "Pipeline", icon: Layers },
    {
      id: "ALLOCATOR",
      label: "Portfolio Allocator",
      icon: SettingsIcon,
      badge: "KNAPSACK",
      badgeColor: "bg-[#E6F4F1] text-[#087F83] border-[#B2DFDB] font-mono text-[9px]",
    },
    {
      id: "EVALUATION",
      label: "Evaluation",
      icon: BarChart3,
      badge: "3-MODEL",
      badgeColor: "bg-[#E6F4F1] text-[#087F83] border-[#B2DFDB] font-mono text-[9px]",
    },
    { id: "AUDIT", label: "Audit Ledger", icon: ShieldCheck },
    { id: "PTP", label: "PTP Monitor", icon: Calendar },
    { id: "REPORTS", label: "Reports", icon: FileText },
    {
      id: "SETTINGS",
      label: "Exceptions",
      icon: SettingsIcon,
      badge: exceptionCount > 0 ? exceptionCount : undefined,
      badgeColor: "bg-[#B7791F]/15 text-[#B7791F] border-[#B7791F]/30",
    },
  ];

  return (
    <aside className="w-56 shrink-0 bg-[#FFFFFF] border-r border-[#E2E5E5] flex flex-col justify-between h-screen sticky top-0 font-sans select-none">
      {/* Brand & Store context */}
      <div>
        <div className="h-14 px-5 border-b border-[#E2E5E5] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-[#087F83] text-white flex items-center justify-center font-bold text-[12px]">
              T
            </div>
            <span className="font-semibold text-[16px] tracking-wide text-[#202525] uppercase">
              TRIAGE
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#6F7777] font-semibold">v2.4</span>
        </div>

        {/* Navigation list */}
        <nav className="p-2 space-y-0.5">
          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6F7777]">
            Operations
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-[13px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#087F83]/10 text-[#087F83] border-l-2 border-[#087F83]"
                    : "text-[#6F7777] hover:text-[#202525] hover:bg-[#F5F6F6]"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#087F83]" : "text-[#6F7777]"}`} />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </div>

                {item.badge !== undefined && (typeof item.badge === "number" ? item.badge > 0 : Boolean(item.badge)) && (
                  <span
                    className={`font-mono text-[11px] font-semibold px-1.5 py-0.2 rounded border ${
                      item.badgeColor || (isActive ? "bg-[#087F83]/15 text-[#087F83] border-[#087F83]/30" : "bg-[#F5F6F6] text-[#6F7777] border-[#E2E5E5]")
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Store Status */}
      <div className="p-3.5 border-t border-[#E2E5E5] bg-[#F5F6F6]/50 space-y-1">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[11px] font-semibold text-[#202525]">Razorpay Live</span>
          <span className="flex items-center space-x-1 text-[#2E7D5B] font-mono text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
            <span>CONNECTED</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px] text-[#6F7777]">
          <span className="text-[12px] font-normal">Gated Policy</span>
          <span className="font-mono text-[12px] font-medium text-[#202525]">Deterministic</span>
        </div>
      </div>
    </aside>
  );
};
