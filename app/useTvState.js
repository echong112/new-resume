"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export const CHANNELS = [
  { id: 0, label: "Groove", videoId: "VGnFLdQW39A" },
  { id: 1, label: "Beats", videoId: "aB1yRz0HhdY" },
  { id: 2, label: "Chill", videoId: "HcGNqrAtsgg" },
  { id: 3, label: "Shred", videoId: "mmnwUgfNTsU" },
  { id: 4, label: "Waves", videoId: "8w4tZE2k7AE" },
  { id: 5, label: "Jazz", videoId: "rnXIjl_Rzy4" },
  { id: 6, label: "Live", videoId: "hzvEVVCnfSU" },
];

export default function useTvState() {
  const [channel, setChannel] = useState(0);
  const [prevChannel, setPrevChannel] = useState(null);
  const [isOn, setIsOn] = useState(true);
  const [hue, setHue] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(0);
  const [showStatic, setShowStatic] = useState(false);
  const [powerAnim, setPowerAnim] = useState(""); // "off" | "on" | ""
  const clickSoundRef = useRef(null);

  useEffect(() => {
    clickSoundRef.current = new Audio("/assets/sounds/213148__radiy__click.wav");
    clickSoundRef.current.volume = 0.5;
  }, []);

  // Send volume to active YouTube iframe via postMessage
  useEffect(() => {
    const iframe = document.getElementById(`yt-player-${channel}`);
    if (iframe && iframe.contentWindow) {
      const vol = Math.round(volume);
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: vol === 0 ? "mute" : "unMute",
          args: [],
        }),
        "*"
      );
      if (vol > 0) {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "setVolume",
            args: [vol],
          }),
          "*"
        );
      }
    }
  }, [volume, channel]);

  const changeChannel = useCallback(
    (ch) => {
      if (ch === channel || !isOn) return;
      if (clickSoundRef.current) {
        clickSoundRef.current.currentTime = 0;
        clickSoundRef.current.play().catch(() => {});
      }
      setPrevChannel(channel);
      setShowStatic(true);
      setTimeout(() => {
        setChannel(ch);
        setTimeout(() => setShowStatic(false), 400);
      }, 200);
    },
    [channel, isOn]
  );

  const togglePower = useCallback(() => {
    if (clickSoundRef.current) {
      clickSoundRef.current.currentTime = 0;
      clickSoundRef.current.play().catch(() => {});
    }
    if (isOn) {
      setPowerAnim("off");
      setTimeout(() => {
        setIsOn(false);
        setPowerAnim("");
      }, 600);
    } else {
      setIsOn(true);
      setPowerAnim("on");
      setTimeout(() => setPowerAnim(""), 800);
    }
  }, [isOn]);

  return {
    channel,
    prevChannel,
    isOn,
    hue,
    setHue,
    brightness,
    setBrightness,
    volume,
    setVolume,
    showStatic,
    powerAnim,
    changeChannel,
    togglePower,
  };
}
