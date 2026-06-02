"use client";

import { useEffect, useState } from "react";
import { Cpu, ChevronDown } from "lucide-react";

const MODELS = [
  "Gemini 3.5 Flash (Medium)",
  "Gemini 3.5 Flash (High)",
  "Gemini 3.5 Flash (Low)",
  "Claude Sonnet 4.6 Thinking",
  "Claude Opus 4.6 Thinking",
];

export default function ModelBadge() {
  const [selectedModel, setSelectedModel] = useState("Gemini 3.5 Flash (High)");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("proximax_model");
    if (saved && MODELS.includes(saved)) {
      setSelectedModel(saved);
    }
  }, []);

  const handleSelect = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem("proximax_model", model);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left w-full">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-mono-code uppercase tracking-wider text-text-primary bg-bg-card border border-border rounded hover:bg-bg-secondary transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent"
          id="model-menu-button"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span className="truncate">{selectedModel}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-text-muted ml-1" />
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          ></div>
          <div
            className="absolute left-0 mt-1 w-full rounded border border-border bg-bg-card shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="model-menu-button"
          >
            <div className="py-1" role="none">
              {MODELS.map((model) => (
                <button
                  key={model}
                  onClick={() => handleSelect(model)}
                  className={`block w-full text-left px-3 py-2 text-xs font-mono-code transition-colors duration-150 ${
                    model === selectedModel
                      ? "bg-bg-secondary text-accent font-bold"
                      : "text-text-muted hover:bg-bg-secondary hover:text-text-primary"
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        model === selectedModel ? "bg-accent" : "bg-transparent"
                      }`}
                    />
                    {model}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
