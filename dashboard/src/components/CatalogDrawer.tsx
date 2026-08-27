"use client";

import React from "react";
import { X, Layers } from "lucide-react";
import { ProductItem } from "../lib/types";

interface CatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
}

export const CatalogDrawer: React.FC<CatalogDrawerProps> = ({ isOpen, onClose, products }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-[#121215] border-l border-zinc-800 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div>
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800">
            <div className="flex items-center space-x-2.5">
              <Layers className="w-4 h-4 text-zinc-300" />
              <div>
                <h3 className="font-bold text-white text-sm">Merchant Product Catalog</h3>
                <p className="text-[11px] text-zinc-400">Exposed to AI Agents via MCP Tools</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Cards */}
          <div className="space-y-2.5">
            {products.map((p) => {
              const inrPrice = p.price_paise / 100;
              const isGated = inrPrice >= 5000 && inrPrice < 10000;
              const isOverBudget = inrPrice >= 10000;

              return (
                <div
                  key={p.id}
                  id={`catalog-item-${p.id}`}
                  className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                        {p.category}
                      </span>
                      <h4 className="font-bold text-white text-xs mt-1">{p.name}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{p.description}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-500 font-mono">Price: </span>
                      <span className="text-xs font-bold text-white font-mono">
                        ₹{inrPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Gating Tag */}
                    {isOverBudget ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950/40 text-red-300 border border-red-800/40 font-medium">
                        &gt; ₹10k Cap
                      </span>
                    ) : isGated ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 font-medium">
                        &ge; ₹5k Gated
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-medium">
                        Autonomous
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 font-mono">
          MCP Tools: <code>list_products</code>, <code>check_price</code>, <code>initiate_purchase</code>
        </div>
      </div>
    </div>
  );
};
