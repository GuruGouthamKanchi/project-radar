"use client";

interface RadiusSliderProps {
  radius: number;
  onChange: (value: number) => void;
}

export default function RadiusSlider({ radius, onChange }: RadiusSliderProps) {
  const formatRadius = (val: number) => {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}KM`;
    }
    return `${val}M`;
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-bg-card border border-border rounded w-full">
      <div className="flex items-center justify-between">
        <span className="ui-label">Alert Radius</span>
        <span className="font-mono-code text-xs text-accent font-bold">
          {formatRadius(radius)}
        </span>
      </div>
      <input
        type="range"
        min={50}
        max={10000}
        step={50}
        value={radius}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
      />
      <div className="flex justify-between font-mono-code text-[9px] text-text-dim">
        <span>50M</span>
        <span>5KM</span>
        <span>10KM</span>
      </div>
    </div>
  );
}
