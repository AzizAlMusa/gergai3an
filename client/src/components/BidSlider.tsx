import React from "react";
export function BidSlider({ value, onChange, disabled }) {
  return <div className="bid-slider-row"><div className="bid-slider-col"><input className="bid-slider" type="range" min="1" max="10" step="1" value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))} /></div><div className="bid-value-big">{value}</div></div>;
}
