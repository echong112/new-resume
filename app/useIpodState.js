"use client";

import { useRef, useCallback, useEffect } from "react";
import { EXPERIENCE, PORTFOLIO, SKILLS, TRACKS } from "./data";

const MAIN_MENU = [
  { title: "Experience", slug: "experience" },
  { title: "Education", slug: "education" },
  { title: "Skills", slug: "skills" },
  { title: "Portfolio", slug: "portfolio" },
  { title: "Shuffle Songs", slug: "player" },
  { title: "Now Playing", slug: "nowplaying" },
];

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  var m = Math.floor(s / 60);
  var sec = Math.floor(s % 60);
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

export default function useIpodState() {
  const stateRef = useRef({
    navStack: [],
    currentPage: "main",
    activeIndex: 0,
    isPlaying: false,
    currentTrack: 0,
    audio: null,
    clickSound: null,
    progressInterval: null,
    detailIndex: 0,
    isAnimating: false,
  });

  const screenContentRef = useRef(null);
  const screenTitleRef = useRef(null);
  const playIndicatorRef = useRef(null);
  const wheelRef = useRef(null);
  const keyboardEnabled = useRef(false);

  // Refs to hold latest functions (avoids stale closures in callback refs)
  const renderPageRef = useRef(null);
  const setupWheelRef = useRef(null);

  // Callback refs — initialize directly when the Html portal mounts the DOM node
  const screenContentCallback = useCallback((node) => {
    screenContentRef.current = node;
    if (node) {
      requestAnimationFrame(() => {
        if (!stateRef.current.clickSound) {
          stateRef.current.clickSound = new Audio("/assets/audio/ipodclick.mp3");
          stateRef.current.clickSound.volume = 0.3;
        }
        renderPageRef.current?.(null);
      });
    }
  }, []);

  const wheelCallback = useCallback((node) => {
    wheelRef.current = node;
    if (node) {
      requestAnimationFrame(() => {
        setupWheelRef.current?.();
      });
    }
  }, []);

  // ---- Audio helpers ----
  const playClick = useCallback(() => {
    const s = stateRef.current;
    if (s.clickSound) {
      s.clickSound.currentTime = 0;
      s.clickSound.play().catch(() => {});
    }
  }, []);

  const updatePlayIndicator = useCallback(() => {
    const s = stateRef.current;
    if (playIndicatorRef.current)
      playIndicatorRef.current.className =
        "play-indicator" + (s.isPlaying ? " visible" : "");
  }, []);

  const loadTrack = useCallback((index) => {
    const s = stateRef.current;
    if (s.audio) {
      s.audio.pause();
      s.audio.onended = null;
    }
    const track = TRACKS[index];
    s.audio = new Audio("/assets/audio/" + track.slug + ".mp3");
    s.audio.onended = () => nextTrack();
    s.currentTrack = index;
  }, []);

  // ---- Rendering helpers ----
  const getMenuList = useCallback(() => {
    const s = stateRef.current;
    switch (s.currentPage) {
      case "main": return MAIN_MENU;
      case "experience": return EXPERIENCE;
      case "skills": return SKILLS;
      case "portfolio": return PORTFOLIO;
      default: return null;
    }
  }, []);

  const isMenuPage = useCallback(() => {
    return ["main", "experience", "skills", "portfolio"].includes(stateRef.current.currentPage);
  }, []);

  const highlightActive = useCallback(() => {
    const el = screenContentRef.current;
    if (!el) return;
    const pages = el.querySelectorAll(".page");
    const page = pages[pages.length - 1];
    if (!page) return;
    const items = page.querySelectorAll(".menu-item");
    items.forEach((item, i) => {
      item.classList.toggle("active", i === stateRef.current.activeIndex);
    });
    const active = page.querySelector(".menu-item.active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, []);

  const startProgressUpdater = useCallback(() => {
    const s = stateRef.current;
    if (s.progressInterval) clearInterval(s.progressInterval);
    s.progressInterval = setInterval(() => {
      if (s.currentPage === "nowplaying" && s.isPlaying && s.audio) {
        const bar = document.getElementById("ipodProgress");
        const elapsed = document.getElementById("ipodElapsed");
        const remaining = document.getElementById("ipodRemaining");
        if (bar && s.audio.duration) bar.style.width = ((s.audio.currentTime / s.audio.duration) * 100) + "%";
        if (elapsed) elapsed.textContent = formatTime(s.audio.currentTime);
        if (remaining && s.audio.duration) remaining.textContent = "-" + formatTime(s.audio.duration - s.audio.currentTime);
      }
    }, 500);
  }, []);

  const renderPage = useCallback((direction) => {
    const s = stateRef.current;
    const container = screenContentRef.current;
    if (!container) return;

    const oldPage = container.querySelector(".page");
    const newPage = document.createElement("div");
    newPage.className = "page";

    let title = "Enrique's iPod";
    let html = "";

    switch (s.currentPage) {
      case "main":
        title = "Enrique's iPod";
        html = MAIN_MENU.map((item, i) =>
          `<div class="menu-item${i === s.activeIndex ? " active" : ""}" data-index="${i}">${item.title}</div>`
        ).join("");
        break;
      case "experience":
        title = "Experience";
        html = EXPERIENCE.map((item, i) =>
          `<div class="menu-item${i === s.activeIndex ? " active" : ""}" data-index="${i}">${item.jobTitle}</div>`
        ).join("");
        break;
      case "experience-detail": {
        const exp = EXPERIENCE[s.detailIndex];
        title = exp.title;
        html = `<div class="page-container"><h3>${exp.jobTitle}</h3><p>${exp.title}</p><p class="tenure">${exp.tenure}</p><ul>${exp.tasks.map(t => `<li>${t}</li>`).join("")}</ul><br><p class="smaller-p">${exp.summary}</p></div>`;
        break;
      }
      case "education":
        title = "Education";
        html = `<div class="page-container"><h3>Education</h3><p>Rutgers University, New Brunswick</p><p>Major: Applied Economics</p></div>`;
        break;
      case "skills":
        title = "Skills";
        html = SKILLS.map((item, i) =>
          `<div class="menu-item${i === s.activeIndex ? " active" : ""}" data-index="${i}">${item.title}</div>`
        ).join("");
        break;
      case "skills-detail": {
        const group = SKILLS[s.detailIndex];
        title = group.title;
        html = `<div class="page-container">${group.skills.map(sk => `<div class="skill-group"><p>${sk}</p></div>`).join("")}</div>`;
        break;
      }
      case "portfolio":
        title = "Portfolio";
        html = PORTFOLIO.map((item, i) =>
          `<div class="menu-item${i === s.activeIndex ? " active" : ""}" data-index="${i}">${item.title}</div>`
        ).join("");
        break;
      case "portfolio-detail": {
        const work = PORTFOLIO[s.detailIndex];
        title = work.title;
        html = `<div class="page-container"><h3>${work.title}</h3><p class="smaller-p">${work.tech}</p><p class="smaller-p">${work.url}</p></div>`;
        break;
      }
      case "nowplaying": {
        title = "Now Playing";
        if (!s.audio) loadTrack(0);
        const track = TRACKS[s.currentTrack];
        let pct = 0, elapsed = "0:00", remaining = "0:00";
        if (s.audio && s.audio.duration) {
          pct = (s.audio.currentTime / s.audio.duration) * 100;
          elapsed = formatTime(s.audio.currentTime);
          remaining = "-" + formatTime(s.audio.duration - s.audio.currentTime);
        }
        newPage.classList.add("no-scroll");
        html = `<div class="now-playing"><div class="artwork-row"><div class="artwork-image"><img alt="${track.title}" src="/assets/audio/${track.slug}.jpg"></div><div class="track-meta"><p>${track.title}</p><p class="artist">${track.artist}</p><p class="album">${track.album}</p></div></div><div class="progress-bar"><span id="ipodProgress" class="progress" style="width:${pct}%"></span></div><div class="progress-times"><span id="ipodElapsed">${elapsed}</span><span id="ipodRemaining">${remaining}</span></div></div>`;
        break;
      }
      default:
        html = MAIN_MENU.map((item, i) =>
          `<div class="menu-item${i === s.activeIndex ? " active" : ""}">${item.title}</div>`
        ).join("");
    }

    if (screenTitleRef.current) screenTitleRef.current.textContent = title;
    newPage.innerHTML = html;

    if (direction && oldPage && !s.isAnimating) {
      s.isAnimating = true;

      const stalePages = container.querySelectorAll(".page");
      stalePages.forEach((p) => {
        if (p !== oldPage) p.remove();
      });

      const inClass = direction === "forward" ? "slide-in-right" : "slide-in-left";
      const outClass = direction === "forward" ? "slide-out-left" : "slide-out-right";

      oldPage.classList.remove("slide-in-right", "slide-in-left", "slide-out-left", "slide-out-right");

      container.appendChild(newPage);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          oldPage.classList.add(outClass);
          newPage.classList.add(inClass);

          newPage.addEventListener("animationend", () => {
            newPage.classList.remove(inClass);
            oldPage.remove();
            s.isAnimating = false;
          }, { once: true });
        });
      });
    } else if (!direction) {
      container.innerHTML = "";
      container.appendChild(newPage);
    }

    highlightActive();
    startProgressUpdater();
  }, [highlightActive, loadTrack, startProgressUpdater]);

  // ---- Navigation ----
  const scrollUp = useCallback(() => {
    playClick();
    const s = stateRef.current;
    if (isMenuPage()) {
      if (s.activeIndex > 0) { s.activeIndex--; highlightActive(); }
    } else {
      const page = screenContentRef.current?.querySelector(".page");
      if (page) page.scrollTop -= 30;
    }
  }, [playClick, isMenuPage, highlightActive]);

  const scrollDown = useCallback(() => {
    playClick();
    const s = stateRef.current;
    if (isMenuPage()) {
      const list = getMenuList();
      if (list && s.activeIndex < list.length - 1) { s.activeIndex++; highlightActive(); }
    } else {
      const page = screenContentRef.current?.querySelector(".page");
      if (page) page.scrollTop += 30;
    }
  }, [playClick, isMenuPage, getMenuList, highlightActive]);

  const selectItem = useCallback(() => {
    const s = stateRef.current;
    if (s.isAnimating || !isMenuPage()) return;
    playClick();
    const list = getMenuList();
    const item = list[s.activeIndex];
    s.navStack.push({ pageId: s.currentPage, activeIndex: s.activeIndex });

    if (s.currentPage === "main") {
      if (item.slug === "player") {
        s.currentTrack = Math.floor(Math.random() * TRACKS.length);
        loadTrack(s.currentTrack);
        s.isPlaying = true;
        s.audio.play().catch(() => {});
        updatePlayIndicator();
        s.currentPage = "nowplaying";
      } else if (item.slug === "nowplaying") {
        s.currentPage = "nowplaying";
      } else {
        s.currentPage = item.slug;
      }
    } else if (s.currentPage === "experience") {
      s.detailIndex = s.activeIndex;
      s.currentPage = "experience-detail";
    } else if (s.currentPage === "skills") {
      s.detailIndex = s.activeIndex;
      s.currentPage = "skills-detail";
    } else if (s.currentPage === "portfolio") {
      s.detailIndex = s.activeIndex;
      s.currentPage = "portfolio-detail";
    }
    s.activeIndex = 0;
    renderPage("forward");
  }, [playClick, isMenuPage, getMenuList, loadTrack, updatePlayIndicator, renderPage]);

  const goBack = useCallback(() => {
    const s = stateRef.current;
    if (s.isAnimating || s.navStack.length === 0) return;
    playClick();
    const prev = s.navStack.pop();
    s.currentPage = prev.pageId;
    s.activeIndex = prev.activeIndex;
    renderPage("back");
  }, [playClick, renderPage]);

  const togglePlay = useCallback(() => {
    playClick();
    const s = stateRef.current;
    if (!s.audio) loadTrack(0);
    if (s.isPlaying) {
      s.audio.pause();
      s.isPlaying = false;
    } else {
      s.audio.play().catch(() => {});
      s.isPlaying = true;
    }
    updatePlayIndicator();
    if (s.currentPage === "nowplaying") renderPage(null);
  }, [playClick, loadTrack, updatePlayIndicator, renderPage]);

  const nextTrack = useCallback(() => {
    playClick();
    const s = stateRef.current;
    const idx = (s.currentTrack + 1) % TRACKS.length;
    loadTrack(idx);
    if (s.isPlaying) s.audio.play().catch(() => {});
    if (s.currentPage === "nowplaying") renderPage(null);
  }, [playClick, loadTrack, renderPage]);

  const prevTrack = useCallback(() => {
    playClick();
    const s = stateRef.current;
    const idx = (s.currentTrack - 1 + TRACKS.length) % TRACKS.length;
    loadTrack(idx);
    if (s.isPlaying) s.audio.play().catch(() => {});
    if (s.currentPage === "nowplaying") renderPage(null);
  }, [playClick, loadTrack, renderPage]);

  // Keep ref pointing to latest renderPage so callback ref always calls current version
  renderPageRef.current = renderPage;

  // Click wheel touch/mouse — uses refs so callbacks always see latest scrollUp/scrollDown
  const scrollUpRef = useRef(scrollUp);
  const scrollDownRef = useRef(scrollDown);
  scrollUpRef.current = scrollUp;
  scrollDownRef.current = scrollDown;

  const setupWheelListeners = useCallback(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    let lastAngle = null, accumulated = 0, isTracking = false;
    const THRESHOLD = 15;

    function getAngle(e) {
      const rect = wheel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    }

    function isOnRing(e) {
      const rect = wheel.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const clientX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const clientY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
      return dist > 25 && dist <= rect.width / 2;
    }

    function onStart(e) {
      if (e.touches && e.touches.length > 1) return;
      if (isOnRing(e)) {
        isTracking = true;
        lastAngle = getAngle(e);
        accumulated = 0;
        wheel.classList.add("touching");
      }
    }
    function onMove(e) {
      if (!isTracking) return;
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      if (!touch) return;
      const angle = getAngle(e);
      let delta = angle - lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      accumulated += delta;
      lastAngle = angle;
      if (accumulated > THRESHOLD) { scrollDownRef.current(); accumulated = 0; }
      else if (accumulated < -THRESHOLD) { scrollUpRef.current(); accumulated = 0; }
    }
    function onEnd() {
      if (!isTracking) return;
      isTracking = false;
      lastAngle = null;
      accumulated = 0;
      wheel.classList.remove("touching");
    }
    function onWheel(e) {
      e.preventDefault();
      if (e.deltaY < 0) scrollUpRef.current(); else if (e.deltaY > 0) scrollDownRef.current();
    }

    wheel.addEventListener("mousedown", onStart);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    wheel.addEventListener("touchstart", onStart, { passive: true });
    wheel.addEventListener("touchmove", onMove, { passive: false });
    wheel.addEventListener("touchend", onEnd);
    wheel.addEventListener("touchcancel", onEnd);
    wheel.addEventListener("wheel", onWheel, { passive: false });
  }, []);

  // Must be after setupWheelListeners definition
  setupWheelRef.current = setupWheelListeners;

  // Keyboard — gated by keyboardEnabled ref
  useEffect(() => {
    const onKey = (e) => {
      if (!keyboardEnabled.current) return;
      switch (e.keyCode) {
        case 38: e.preventDefault(); scrollUp(); break;
        case 40: e.preventDefault(); scrollDown(); break;
        case 39: e.preventDefault(); selectItem(); break;
        case 37: e.preventDefault(); goBack(); break;
        case 32: e.preventDefault(); togglePlay(); break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scrollUp, scrollDown, selectItem, goBack, togglePlay]);

  // Cleanup function for Galaxy to call on exit
  const cleanup = useCallback(() => {
    const s = stateRef.current;
    if (s.audio) {
      s.audio.pause();
    }
    if (s.progressInterval) {
      clearInterval(s.progressInterval);
      s.progressInterval = null;
    }
  }, []);

  const setKeyboardEnabled = useCallback((enabled) => {
    keyboardEnabled.current = enabled;
  }, []);

  return {
    screenContentCallback,
    wheelCallback,
    screenTitleRef,
    playIndicatorRef,
    goBack,
    nextTrack,
    prevTrack,
    togglePlay,
    selectItem,
    setKeyboardEnabled,
    cleanup,
  };
}
