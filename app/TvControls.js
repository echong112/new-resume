"use client";

import { CHANNELS } from "./useTvState";

export default function TvControls({
  channel,
  isOn,
  hue,
  setHue,
  brightness,
  setBrightness,
  volume,
  setVolume,
  changeChannel,
  togglePower,
  className,
}) {
  return (
    <div className={`tv-control-panel ${className || ""}`}>
      <button
        className={`tv-power-btn ${isOn ? "on" : ""}`}
        onClick={togglePower}
        aria-label="Power"
      >
        <span className="power-icon">&#9211;</span>
      </button>

      <div className="tv-channel-label">CHANNEL</div>
      <div className="tv-channel-buttons">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            className={`tv-ch-btn ${channel === ch.id && isOn ? "active" : ""}`}
            onClick={() => changeChannel(ch.id)}
            disabled={!isOn}
          >
            {ch.id + 1}
          </button>
        ))}
      </div>

      <div className="tv-sliders">
        <div className="tv-slider-row">
          <label>VOL</label>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            disabled={!isOn}
          />
        </div>
        <div className="tv-slider-row">
          <label>HUE</label>
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            disabled={!isOn}
          />
        </div>
        <div className="tv-slider-row">
          <label>BRT</label>
          <input
            type="range"
            min="20"
            max="180"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            disabled={!isOn}
          />
        </div>
      </div>
    </div>
  );
}
