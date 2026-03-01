"use client";

import { CHANNELS } from "./useTvState";

const ytSrc = (videoId) =>
  `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`;

export default function TvScreen({
  channel,
  isOn,
  hue,
  brightness,
  showStatic,
  powerAnim,
  className,
}) {
  const screenFilter = {
    filter: `hue-rotate(${hue}deg) brightness(${brightness / 100})`,
  };

  return (
    <div className={`tv-screen-wrapper ${className || ""}`}>
      <div className="tv-bezel">
        <div
          className={`tv-screen ${powerAnim ? `power-${powerAnim}` : ""}`}
          style={isOn ? screenFilter : undefined}
        >
          {isOn && (
            <>
              <div className={`tv-static ${showStatic ? "visible" : ""}`} />
              <div className="tv-video-container">
                <iframe
                  id={`yt-player-${channel}`}
                  key={channel}
                  src={ytSrc(CHANNELS[channel].videoId)}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={CHANNELS[channel].label}
                />
              </div>
            </>
          )}
          <div className="crt-scanlines" />
          <div className="crt-vignette" />
        </div>
      </div>
      <div className="tv-channel-indicator">CH {channel + 1}</div>
    </div>
  );
}
