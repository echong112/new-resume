"use client";

import useTvState, { CHANNELS } from "./useTvState";
import TvScreen from "./TvScreen";
import TvControls from "./TvControls";

export default function Tv() {
  const tv = useTvState();

  return (
    <div className="tv-outer">
      <div className="tv-body">
        {/* Watchman antenna (mobile only) */}
        <div className="watchman-antenna">
          <div className="antenna-rod" />
          <div className="antenna-tip" />
        </div>

        {/* Main TV housing */}
        <div className="tv-inner">
          {/* Speaker grille */}
          <div className="tv-speaker">
            <div className="speaker-grille">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="speaker-slot" />
              ))}
            </div>
          </div>

          {/* Watchman branding (mobile only) */}
          <div className="watchman-brand">
            <span className="watchman-sports">SPORTS</span>
            <span className="watchman-name">watchman</span>
          </div>

          {/* Watchman dial strip (mobile only) */}
          <div className="watchman-dial">
            <div className="dial-label">FM</div>
            <div className="dial-strip">
              <span>88</span><span>92</span><span>96</span>
              <span>100</span><span>104</span><span>108</span>
            </div>
            <div className="dial-label">MHz</div>
          </div>

          {/* Screen section */}
          <TvScreen
            channel={tv.channel}
            isOn={tv.isOn}
            hue={tv.hue}
            brightness={tv.brightness}
            showStatic={tv.showStatic}
            powerAnim={tv.powerAnim}
          />

          {/* Right control panel */}
          <TvControls
            channel={tv.channel}
            isOn={tv.isOn}
            hue={tv.hue}
            setHue={tv.setHue}
            brightness={tv.brightness}
            setBrightness={tv.setBrightness}
            volume={tv.volume}
            setVolume={tv.setVolume}
            changeChannel={tv.changeChannel}
            togglePower={tv.togglePower}
          />

          {/* SONY branding (mobile only) */}
          <div className="watchman-sony">SONY</div>
        </div>

        {/* Watchman side buttons (mobile only) */}
        <div className="watchman-side-buttons">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              className={`watchman-side-btn ${tv.channel === ch.id && tv.isOn ? "active" : ""}`}
              onClick={() => tv.changeChannel(ch.id)}
              disabled={!tv.isOn}
              aria-label={`Channel ${ch.id + 1}`}
            />
          ))}
        </div>

        {/* TV feet (desktop only) */}
        <div className="tv-feet">
          <div className="tv-foot" />
          <div className="tv-foot" />
        </div>
      </div>
    </div>
  );
}
