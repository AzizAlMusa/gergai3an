import React, { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { useApp } from "../state";
import { Avatar } from "../components/Avatar";

import { SERVER_URL } from "../config";

const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function formatTime(n) {
  if (n == null) return "";
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const rem = ms % 1000;
  return `${sec}:${String(rem).padStart(3, "0")}`;
}

function difficultyColor(d) {
  const colors = ["#8CF2C3", "#A9F08A", "#D7F06E", "#FFE05D", "#FFCF5D", "#FFB95B", "#FF9A5B", "#FF7A63", "#6A6A6A", "#141414"];
  return colors[d - 1];
}

function phaseTrack(state) {
  if (!state) return "";
  if (state.phase === "lobby") return "/audio/lobby.mp3";
  if (state.phase === "round-ready") return "/audio/board.mp3";
  if (state.phase === "bidding") return "/audio/bidding.mp3";
  if (state.phase === "question") return "/audio/question.mp3";
  if (state.phase === "activity-live") return "/audio/estimation.mp3";
  return "";
}

function FancyAudioPlayer({ src, className = "", command, commandSerial, onEnded, onPlayStateChange }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const updatePlaying = (v) => {
    setPlaying(v);
    onPlayStateChange?.(v);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    updatePlaying(false);
    setProgress(0);

    const handleTime = () => setProgress(audio.currentTime || 0);
    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      updatePlaying(false);
      onEnded?.();
    };

    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src, onEnded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !commandSerial) return;
    if (command === "stop") {
      audio.pause();
      audio.currentTime = 0;
      updatePlaying(false);
      setProgress(0);
      return;
    }
    if (command === "play") {
      audio.pause();
      audio.currentTime = 0;
      audio.play().then(() => updatePlaying(true)).catch(() => updatePlaying(false));
    }
  }, [command, commandSerial]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => updatePlaying(true)).catch(() => updatePlaying(false));
      return;
    }
    audio.pause();
    updatePlaying(false);
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setProgress(next);
  };

  return (
    <div className={`fancy-audio-player ${className}`.trim()}>
      <audio ref={audioRef} src={src} preload="auto" />
      <button className="fancy-audio-play" onClick={toggle}>
        {playing ? "Pause" : "Play"}
      </button>
      <input className="fancy-audio-range" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(progress, duration || 0)} onChange={seek} />
      <div className="fancy-audio-time">{formatTime(Math.floor(progress))} / {formatTime(Math.floor(duration || 0))}</div>
    </div>
  );
}

function RichPrompt({ text, image, audio, video, mediaKeyPrefix, audioCommand, audioCommandSerial, videoCommand, videoCommandSerial, onAudioEnded, onAudioPlayStateChange, onVideoPlayStateChange }) {
  const videoRef = useRef(null);
  const lastVideoSerialRef = useRef(0);
  const hasMedia = Boolean(image || audio || video);
  const mediaCount = [image, audio, video].filter(Boolean).length;
  const gridClasses = [
    "display-media-grid",
    mediaCount === 1 ? "single-media" : "",
    image && mediaCount === 1 ? "single-image" : "",
    audio && mediaCount === 1 ? "single-audio" : "",
    video && mediaCount === 1 ? "single-video" : "",
  ].filter(Boolean).join(" ");

  // Apply video commands from host
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoCommandSerial) return;
    if (videoCommand === "stop") {
      vid.pause();
      vid.currentTime = 0;
    } else if (videoCommand === "pause") {
      vid.pause();
    } else if (videoCommand === "play") {
      vid.muted = false;
      vid.play().catch(() => {});
    }
    lastVideoSerialRef.current = videoCommandSerial;
  }, [videoCommand, videoCommandSerial]);

  // Callback ref: when video element mounts, apply any pending command
  const setVideoRef = (el) => {
    videoRef.current = el;
    if (el && videoCommandSerial && videoCommandSerial !== lastVideoSerialRef.current) {
      if (videoCommand === "play") {
        el.muted = false;
        el.play().catch(() => {});
      }
      lastVideoSerialRef.current = videoCommandSerial;
    }
  };

  if (!hasMedia) {
    return <div className="display-body-big">{text}</div>;
  }

  return (
    <div className="display-rich-panel">
      {text ? <div className="display-rich-text">{text}</div> : null}
      <div className={gridClasses}>
        {image ? (
          <div className="display-media-card image-only">
            <img className="display-media-image" src={image} alt="question media" />
          </div>
        ) : null}
        {audio ? (
          <div className="display-media-card audio-only">
            <FancyAudioPlayer
              key={`${mediaKeyPrefix}-audio-${audio}`}
              src={audio}
              className="display-media-audio-player"
              command={audioCommand}
              commandSerial={audioCommandSerial}
              onEnded={onAudioEnded}
              onPlayStateChange={onAudioPlayStateChange}
            />
          </div>
        ) : null}
        {video ? (
          <div className="display-media-card video-only">
            <video
              ref={setVideoRef}
              key={`${mediaKeyPrefix}-video-${video}`}
              className="display-media-video"
              src={video}
              controls
              autoPlay
              muted
              playsInline
              preload="auto"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onPlay={() => onVideoPlayStateChange?.(true)}
              onPause={() => onVideoPlayStateChange?.(false)}
              onEnded={() => onVideoPlayStateChange?.(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RollingNumber({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const target = value;
    const start = 0;
    startRef.current = performance.now();
    const animate = (now) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (target - start) * eased;
      setDisplay(current);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);
  const fmt = Math.abs(value) >= 1000 ? Math.round(display).toLocaleString() : Number(display.toFixed(2)).toLocaleString();
  return <>{fmt}</>;
}

/* Controlled rolling number driven by external progress 0..1 */
function ControlledRollingNumber({ value, progress }) {
  const current = value * progress;
  const fmt = Math.abs(value) >= 1000 ? Math.round(current).toLocaleString() : Number(current.toFixed(2)).toLocaleString();
  return <>{fmt}</>;
}

const SLIDE_DURATION = 2000; // ms — constant-ish motion over 2s

function EstimationSlider({ player, answer, farTol, midTol, closeTol, closePts, midPts, farPts, teamColor, progress }) {
  const est = player.estimation;
  const range = farTol * 1.3 || Math.abs(answer) * 0.6 || 1;
  const pct = ((est - answer) / range) * 50;
  const clampedPct = Math.max(-52, Math.min(52, pct));
  const isOffChart = Math.abs(pct) > 52;
  const zoneColor = player.zone === "close" ? "#22c55e" : player.zone === "mid" ? "#eab308" : player.zone === "far" ? "#ef4444" : "#141414";

  const eased = progress < 1 ? 1 - Math.pow(1 - progress, 1.3) : 1;
  const currentPct = clampedPct * eased;

  return (
    <div className="est-slider-row">
      <div className="est-slider-player">
        <Avatar nickname={player.nickname} avatarKey={player.avatarKey} size={24} />
        <div className="est-slider-info">
          <strong>{player.nickname}</strong>
          <span className="est-slider-val" style={{ color: zoneColor }}>
            <ControlledRollingNumber value={est} progress={eased} />
          </span>
        </div>
      </div>
      <div className="est-slider-track">
        <div className="est-slider-zones">
          <div className="est-zone out-left" />
          <div className="est-zone far-left" />
          <div className="est-zone mid-left" />
          <div className="est-zone close" />
          <div className="est-zone mid-right" />
          <div className="est-zone far-right" />
          <div className="est-zone out-right" />
        </div>
        <div className="est-slider-center">
          <span className="est-center-label">{answer.toLocaleString()}</span>
        </div>
        <div
          className={`est-slider-dot ${isOffChart && progress >= 1 ? "off-chart" : ""}`}
          style={{ left: `calc(50% + ${currentPct}%)`, backgroundColor: teamColor || "#888" }}
        >
          <span className="est-dot-pts">+{player.points}</span>
        </div>
      </div>
    </div>
  );
}

/* Static demo slider for instructions screen */
function DemoSlider({ closePts, midPts, farPts }) {
  return (
    <div className="est-demo-slider">
      <div className="est-slider-track demo">
        <div className="est-slider-zones">
          <div className="est-zone out-left" />
          <div className="est-zone far-left" />
          <div className="est-zone mid-left" />
          <div className="est-zone close" />
          <div className="est-zone mid-right" />
          <div className="est-zone far-right" />
          <div className="est-zone out-right" />
        </div>
        <div className="est-slider-center">
          <span className="est-center-label show-always">Answer</span>
        </div>
        {/* Zone edge callout labels */}
        <div className="est-zone-callouts">
          <div className="est-callout close-edge-left"><span>+{closePts || 3}</span></div>
          <div className="est-callout mid-edge-left"><span>+{midPts || 2}</span></div>
          <div className="est-callout far-edge-left"><span>+{farPts || 1}</span></div>
          <div className="est-callout out-edge-left"><span>0</span></div>
          <div className="est-callout close-edge-right"><span>+{closePts || 3}</span></div>
          <div className="est-callout mid-edge-right"><span>+{midPts || 2}</span></div>
          <div className="est-callout far-edge-right"><span>+{farPts || 1}</span></div>
          <div className="est-callout out-edge-right"><span>0</span></div>
        </div>
        {/* Zone labels */}
        <div className="est-zone-labels">
          <div className="est-zone-label" style={{ left: "50%", color: "#22c55e" }}>Close</div>
          <div className="est-zone-label" style={{ left: "31%", color: "#eab308" }}>Mid</div>
          <div className="est-zone-label" style={{ left: "69%", color: "#eab308" }}>Mid</div>
          <div className="est-zone-label" style={{ left: "17%", color: "#ef4444" }}>Far</div>
          <div className="est-zone-label" style={{ left: "83%", color: "#ef4444" }}>Far</div>
          <div className="est-zone-label" style={{ left: "5%", color: "#141414" }}>Out</div>
          <div className="est-zone-label" style={{ left: "95%", color: "#141414" }}>Out</div>
        </div>
      </div>
    </div>
  );
}

function EstimationResultsView({ state: s }) {
  const rr = s.estimation?.roundResults;
  const idx = s.estimation?.currentResultIndex ?? 0;
  if (!rr || rr.length === 0 || !rr[idx]) return null;
  const latest = rr[idx];
  const answer = latest.answer;
  const results = [...latest.results].sort((a, b) => a.diff - b.diff);
  const cumulativeScores = latest.cumulativeTeamScores || s.estimation.teamScores;
  const prevCumulativeScores = idx > 0 && rr[idx - 1]?.cumulativeTeamScores ? rr[idx - 1].cumulativeTeamScores : Object.fromEntries(Object.keys(cumulativeScores).map(k => [k, 0]));
  const isEst2 = s.estimation?.type === "estimation-2";
  const teamAvgs = latest.teamAvgs || {};

  const qData = s.estimation?.questions?.[latest.questionIndex];
  const closeTol = latest.closeTol || qData?.closeTol || 0;
  const midTol = latest.midTol || qData?.midTol || 0;
  const farTol = latest.farTol || qData?.farTol || 0;
  const closePts = qData?.closePts || 3;
  const midPts = qData?.midPts || 2;
  const farPts = qData?.farPts || 1;

  // For estimation-2, build team-level slider data
  const teamSliders = isEst2 ? Object.entries(teamAvgs).map(([tid, info]) => {
    const diff = Math.abs(info.avg - answer);
    let zone;
    if (diff <= closeTol) zone = "close";
    else if (diff <= midTol) zone = "mid";
    else if (diff <= farTol) zone = "far";
    else zone = "out";
    return {
      playerId: tid,
      nickname: s.teams[tid]?.name || tid,
      avatarKey: null,
      teamId: tid,
      estimation: info.avg,
      diff,
      zone,
      points: info.pts,
      isTeam: true
    };
  }).sort((a, b) => a.diff - b.diff) : [];

  const [slideProgress, setSlideProgress] = useState(0);
  const [phase, setPhase] = useState("sliding");
  const tickerRef = useRef(null);
  const chimeRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    setSlideProgress(0);
    setPhase("sliding");

    const ticker = new Audio("/audio/ticker.mp3");
    ticker.loop = true;
    ticker.volume = 0.7;
    ticker.playbackRate = 1.0;
    ticker.preload = "auto";
    tickerRef.current = ticker;

    const chime = new Audio("/audio/chime.mp3");
    chime.volume = 0.6;
    chime.preload = "auto";
    chimeRef.current = chime;

    const startDelay = setTimeout(() => {
      ticker.play().catch(() => {});
      startRef.current = performance.now();

      const animate = (now) => {
        const elapsed = now - startRef.current;
        const t = Math.min(elapsed / SLIDE_DURATION, 1);
        setSlideProgress(t);

        if (tickerRef.current) {
          const rate = 0.5 + 0.7 * (1 - t * t);
          tickerRef.current.playbackRate = Math.max(0.3, rate);
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          if (tickerRef.current) { tickerRef.current.pause(); tickerRef.current.currentTime = 0; }
          setSlideProgress(1);
          setTimeout(() => setPhase("scoring"), 300);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, 200);

    return () => {
      clearTimeout(startDelay);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (tickerRef.current) { tickerRef.current.pause(); tickerRef.current.currentTime = 0; }
    };
  }, [idx]);

  useEffect(() => {
    if (phase === "scoring" && chimeRef.current) {
      chimeRef.current.currentTime = 0;
      chimeRef.current.play().catch(() => {});
      const t = setTimeout(() => setPhase("done"), 800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const showScoreUpdate = phase === "scoring" || phase === "done";
  const sliderData = isEst2 ? teamSliders : results;

  return (
    <div className="display-centered-content est-result-scroll">
      <div style={{ width: "100%" }}>
        <div className="est-result-header">
          <div className="est-result-prompt">{latest.prompt}</div>
          {isEst2 ? <div className="est-result-subtext">Team averages scored</div> : null}
        </div>
        <div className="est-results-grid">
          {sliderData.map((r) => (
            <EstimationSlider key={r.playerId} player={r} answer={answer} farTol={farTol} midTol={midTol} closeTol={closeTol} closePts={closePts} midPts={midPts} farPts={farPts} teamColor={s.teams[r.teamId]?.color} progress={slideProgress} />
          ))}
        </div>
        {isEst2 ? (
          <div className="est-individual-breakdown">
            {Object.entries(teamAvgs).map(([tid, info]) => {
              const members = results.filter(r => r.teamId === tid);
              return (
                <div key={tid} className="est-team-breakdown" style={{ borderColor: s.teams[tid]?.color }}>
                  <strong style={{ color: s.teams[tid]?.color }}>{s.teams[tid]?.name}</strong>
                  <span className="est-breakdown-avg">avg: {Math.round(info.avg * 100) / 100}</span>
                  <span className="est-breakdown-members">({members.map(m => `${m.nickname}: ${m.estimation}`).join(", ")})</span>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className={`est-team-scores-row ${showScoreUpdate ? "est-scores-glow" : ""}`}>
          {Object.entries(cumulativeScores).sort((a, b) => b[1] - a[1]).map(([tid, score]) => {
            const prev = Math.round((prevCumulativeScores[tid] || 0) * 100) / 100;
            const curr = Math.round(score * 100) / 100;
            const displayScore = showScoreUpdate ? curr : prev;
            return (
              <div key={tid} className={`est-team-score-pill ${showScoreUpdate ? "est-pill-glow" : ""}`} style={{ background: s.teams[tid]?.color }}>
                <strong>{s.teams[tid]?.name}</strong>
                <span>{displayScore} pts</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EstimationFinalView({ state: s }) {
  const ts = s.estimation?.teamScores || {};
  const sorted = Object.entries(ts).sort((a, b) => b[1] - a[1]);
  const medals = ["🥇", "🥈", "🥉"];
  const pp = s.estimation?.prizePools || { first: 30, second: 20, third: 10 };
  const prizes = [pp.first, pp.second, pp.third];
  const winnerAudioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio("/audio/winner.mp3");
    audio.loop = true;
    audio.volume = 0.4;
    winnerAudioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); audio.currentTime = 0; };
  }, []);

  return (
    <div className="display-centered-content">
      <div className="est-final-wrap">
        <div className="display-body-big est-final-title">Final Results</div>
        <div className="est-final-podium">
          {sorted.map(([tid, score], i) => (
            <div key={tid} className={`est-podium-card place-${i + 1}`} style={{ background: s.teams[tid]?.color }}>
              <div className="est-podium-medal">{medals[i] || ""}</div>
              <div className="est-podium-team">{s.teams[tid]?.name}</div>
              <div className="est-podium-score">{Math.round(score * 100) / 100} pts</div>
              <div className="est-podium-prize">+{prizes[i] || 0} to total</div>
              <div className="est-podium-avatars">
                {s.rosters[tid]?.map((p) => (
                  <Avatar key={p.id} nickname={p.nickname} avatarKey={p.avatarKey} size={36} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameMasterPanel({ onClose }) {
  const [data, setData] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [expandedQ, setExpandedQ] = useState(null);
  const [filterUsed, setFilterUsed] = useState("all"); // all | unused | used
  const [simulateBlind, setSimulateBlind] = useState(false);

  useEffect(() => {
    fetch(`${SERVER_URL}/test/questions`).then(r => r.json()).then(d => {
      setData(d);
      if (d.categories?.length) setSelectedCat(d.categories[0]);
    }).catch(() => {});
  }, []);

  if (!data) return <div className="gm-panel"><div className="gm-loading">Loading questions...</div></div>;

  const cats = data.categories || [];
  const qs = selectedCat ? (data.byCategory[selectedCat] || []) : [];
  const filtered = qs.filter(q => {
    if (filterUsed === "unused") return !q.used && !q.disabled;
    if (filterUsed === "used") return q.used || q.disabled;
    return true;
  }).sort((a, b) => a.level - b.level);

  return (
    <div className="gm-panel">
      <div className="gm-header">
        <div className="gm-title">Game Master Test Mode</div>
        <button className="gm-close" onClick={onClose}>✕ Close</button>
      </div>
      <div className="gm-toolbar">
        <label className="gm-toggle">
          <input type="checkbox" checked={simulateBlind} onChange={e => setSimulateBlind(e.target.checked)} />
          <span>Simulate Blind Mode</span>
        </label>
        <div className="gm-filter">
          <button className={`gm-filter-btn ${filterUsed === "all" ? "active" : ""}`} onClick={() => setFilterUsed("all")}>All</button>
          <button className={`gm-filter-btn ${filterUsed === "unused" ? "active" : ""}`} onClick={() => setFilterUsed("unused")}>Unused</button>
          <button className={`gm-filter-btn ${filterUsed === "used" ? "active" : ""}`} onClick={() => setFilterUsed("used")}>Used</button>
        </div>
        <div className="gm-stat">{filtered.length} questions</div>
      </div>
      <div className="gm-body">
        <div className="gm-cats">
          {cats.map(c => (
            <button key={c} className={`gm-cat-btn ${c === selectedCat ? "active" : ""}`} onClick={() => { setSelectedCat(c); setExpandedQ(null); }}>
              {simulateBlind ? "???" : c}
              <span className="gm-cat-count">{(data.byCategory[c] || []).filter(q => !q.used && !q.disabled).length}</span>
            </button>
          ))}
        </div>
        <div className="gm-questions">
          {filtered.map(q => (
            <div key={q.id} className={`gm-q-card ${q.used ? "used" : ""} ${q.disabled ? "disabled" : ""}`} onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}>
              <div className="gm-q-top">
                <span className="gm-q-level" style={{ background: difficultyColor(q.level), color: q.level >= 9 ? "#fff" : "#111" }}>{q.level}</span>
                <span className="gm-q-sub">{q.subCategory}</span>
                {q.format !== "text" ? <span className="gm-q-format">{q.format}</span> : null}
                {q.used ? <span className="gm-q-badge used">Used</span> : null}
                {q.disabled ? <span className="gm-q-badge disabled">Disabled</span> : null}
              </div>
              <div className="gm-q-text">{simulateBlind ? "???" : q.question}</div>
              {expandedQ === q.id ? (
                <div className="gm-q-expand">
                  <div className="gm-q-answer"><strong>Answer:</strong> {q.answer}</div>
                  {q.hostNotes ? <div className="gm-q-notes"><strong>Notes:</strong> {q.hostNotes}</div> : null}
                  {q.questionImage ? <div className="gm-q-media"><strong>Q Image:</strong> <img src={q.questionImage} alt="" className="gm-thumb" /></div> : null}
                  {q.answerImage ? <div className="gm-q-media"><strong>A Image:</strong> <img src={q.answerImage} alt="" className="gm-thumb" /></div> : null}
                  {q.questionAudio ? <div className="gm-q-media"><strong>Q Audio:</strong> <audio src={q.questionAudio} controls preload="none" /></div> : null}
                  {q.answerAudio ? <div className="gm-q-media"><strong>A Audio:</strong> <audio src={q.answerAudio} controls preload="none" /></div> : null}
                  {q.questionVideo ? <div className="gm-q-media"><strong>Q Video:</strong> {q.questionVideo}</div> : null}
                  {q.answerVideo ? <div className="gm-q-media"><strong>A Video:</strong> {q.answerVideo}</div> : null}
                </div>
              ) : null}
            </div>
          ))}
          {filtered.length === 0 ? <div className="gm-empty">No questions match this filter.</div> : null}
        </div>
      </div>
    </div>
  );
}

export function DisplayPage() {
  const { state } = useApp();
  const bedRef = useRef(null);
  const sfxRef = useRef(null);
  const handoffRef = useRef(null);
  const lastTrackRef = useRef("");
  const lastPhaseRef = useRef("");
  const lastResolvedRef = useRef(null);
  const lastResponderKeyRef = useRef(null);
  const bedPausedByMediaRef = useRef(false);
  const lastTimerRemainingRef = useRef(null);
  const lastTimerRunningRef = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef(null);
  const isTestMode = useMemo(() => new URLSearchParams(window.location.search).has("test"), []);
  const [showTestPanel, setShowTestPanel] = useState(false);

  // Unlock audio on first user interaction (required by browsers)
  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked) return;
      // Create a silent AudioContext to unlock audio globally
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      // Play a silent buffer to fully unlock Audio elements
      [bedRef.current, sfxRef.current, handoffRef.current].forEach(a => {
        if (a) { a.muted = true; a.play().then(() => { a.pause(); a.muted = false; a.currentTime = 0; }).catch(() => {}); }
      });
      setAudioUnlocked(true);
    };
    window.addEventListener("click", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [audioUnlocked]);

  const handleMediaPlayState = (isPlaying) => {
    const bed = bedRef.current;
    if (!bed) return;
    if (isPlaying) {
      if (!bed.paused) {
        bed.pause();
        bedPausedByMediaRef.current = true;
      }
    } else {
      if (bedPausedByMediaRef.current) {
        bedPausedByMediaRef.current = false;
        bed.play().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const bed = new Audio();
    bed.loop = true;
    bed.volume = 0.35;
    bed.preload = "auto";

    const sfx = new Audio();
    sfx.volume = 0.75;
    sfx.preload = "auto";

    const handoff = new Audio();
    handoff.volume = 0.8;
    handoff.preload = "auto";

    bedRef.current = bed;
    sfxRef.current = sfx;
    handoffRef.current = handoff;

    return () => {
      bed.pause();
      sfx.pause();
      handoff.pause();
    };
  }, []);

  useEffect(() => {
    if (!bedRef.current || !state) return;

    const nextTrack = phaseTrack(state);
    const bed = bedRef.current;
    const tryPlay = async () => {
      try {
        if (!nextTrack) {
          bed.pause();
          lastTrackRef.current = "";
          return;
        }

        if (lastTrackRef.current !== nextTrack) {
          bed.pause();
          bed.src = nextTrack;
          bed.currentTime = 0;
          lastTrackRef.current = nextTrack;
          bed.load();
        }

        await bed.play();
      } catch {
      }
    };

    void tryPlay();
  }, [state?.phase, audioUnlocked]);

  useEffect(() => {
    if (!sfxRef.current || !handoffRef.current || !state) return;
    const prevPhase = lastPhaseRef.current;
    const currentPhase = state.phase;
    lastPhaseRef.current = currentPhase;

    const responderKey = state.phase === "question" && state.round.activeResponder
      ? `${state.round.activeResponder.teamId}-${state.round.activeResponder.bidderName}`
      : null;
    const previousResponderKey = lastResponderKeyRef.current;
    lastResponderKeyRef.current = responderKey;

    let sfxPath = "";
    if (currentPhase === "bids-revealed" && prevPhase !== "bids-revealed") sfxPath = "/audio/reveal_bid.mp3";

    const actionKey = state.round.actionSerial ? `${state.round.actionSerial}-${state.round.lastAction}` : null;
    if (actionKey && actionKey !== lastResolvedRef.current) {
      if (state.round.lastAction === "correct") sfxPath = "/audio/correct.mp3";
      if (state.round.lastAction === "wrong") sfxPath = "/audio/wrong.mp3";
      lastResolvedRef.current = actionKey;
    }

    if (sfxPath) {
      const sfx = sfxRef.current;
      sfx.pause();
      sfx.src = sfxPath;
      sfx.currentTime = 0;
      sfx.play().catch(() => {});
    }

    if (state.phase === "question" && previousResponderKey && responderKey && previousResponderKey !== responderKey) {
      const handoff = handoffRef.current;
      handoff.pause();
      handoff.src = "/audio/slam.mp3";
      handoff.currentTime = 0;
      handoff.play().catch(() => {});
    }
  }, [state?.phase, state?.round?.activeResponder?.teamId, state?.round?.activeResponder?.bidderName, state?.round?.actionSerial, state?.round?.lastAction]);

  // Universal times_up.mp3 when any timer hits 0
  useEffect(() => {
    if (!sfxRef.current || !state) return;
    const wasRunning = lastTimerRunningRef.current;
    const prevRemaining = lastTimerRemainingRef.current;
    lastTimerRunningRef.current = state.timers.running;
    lastTimerRemainingRef.current = state.timers.remaining;

    // Detect: timer was running with time left, now stopped at 0
    if (wasRunning && !state.timers.running && state.timers.hasStartedOnce && (state.timers.remaining ?? 1) <= 0 && prevRemaining > 0) {
      const sfx = sfxRef.current;
      sfx.pause();
      sfx.src = "/audio/times_up.mp3";
      sfx.currentTime = 0;
      sfx.play().catch(() => {});
    }
  }, [state?.timers?.running, state?.timers?.remaining]);

  const phase = state?.phase ?? "";
  const isLobby = phase === "lobby";
  const isGrid = phase === "round-ready";
  const showTimer = phase === "bidding" || phase === "question" || phase === "activity-live";

  const displayBidRows = useMemo(() => {
    if (!state?.round?.bidRanking) return [];
    return state.round.bidRanking;
  }, [state?.round?.bidRanking]);

  const mediaCommand = state?.mediaControl?.command || null;
  const mediaSide = state?.mediaControl?.side || null;
  const mediaSerial = state?.mediaControl?.serial || 0;
  const mediaType = state?.mediaControl?.mediaType || "audio";

  if (!state) return null;

  const maximizedImage = state.imageMaximized
    ? (state.phase === "answer"
      ? (state.selectedQuestion?.answerImage || state.selectedQuestion?.questionImage)
      : state.selectedQuestion?.questionImage)
    : null;

  return (
    <div className="display-page">
      {!audioUnlocked ? (
        <div className="audio-unlock-overlay" onClick={() => setAudioUnlocked(true)}>
          <div className="audio-unlock-box">
            <div style={{ fontSize: 48 }}>🔊</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 12 }}>Click anywhere to enable audio</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8, opacity: 0.7 }}>Sounds &amp; music will play during the game</div>
          </div>
        </div>
      ) : null}
      {isTestMode ? (
        <>
          <button className="gm-toggle-btn" onClick={() => setShowTestPanel(!showTestPanel)}>
            {showTestPanel ? "✕ Close Test" : "🎮 Test Mode"}
          </button>
          {showTestPanel ? <GameMasterPanel onClose={() => setShowTestPanel(false)} /> : null}
        </>
      ) : null}
      <div className="display-glow a" />
      <div className="display-glow b" />

      {maximizedImage ? (
        <div className="display-maximized-overlay">
          {showTimer ? (
            <div className="display-maximized-timer">
              {state.phase === "bidding" ? (state.timers.remaining ?? state.timers.biddingSeconds ?? 0) : (state.timers.remaining ?? state.timers.questionSeconds ?? 0)}
            </div>
          ) : null}
          <img className="display-maximized-image" src={maximizedImage} alt="maximized" />
        </div>
      ) : (
        <>
      <div className="display-frame">
        <div className="display-header-small">
          <div className="display-title-small">Trivia Night</div>
          {showTimer ? <div className="display-timer-inline">{state.phase === "bidding" ? (state.timers.remaining ?? state.timers.biddingSeconds ?? 0) : (state.timers.remaining ?? state.timers.questionSeconds ?? 0)}</div> : null}
          <div className="display-status-small">{state.phase.replaceAll("-", " ")}</div>
        </div>

        {isLobby ? (
          <div className="display-lobby-stage">
            {["A", "B", "C"].map((id) => (
              <div key={id} className="display-lobby-column">
                <div className="display-lobby-grid" style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.ceil(Math.max(1, state.rosters[id].length) / 2))}, minmax(0, 1fr))` }}>
                  {state.rosters[id].map((p) => (
                    <div className="display-avatar-pair big" key={p.id}>
                      <Avatar nickname={p.nickname} avatarKey={p.avatarKey} size={118} lobby />
                      <span>{p.nickname}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : isGrid ? (
          <div className="question-grid-stage">
            {state.gameMode === "turn" ? (
              <div className="display-turn-indicator" style={{ background: state.teams[state.turnOrder[state.currentTurnIndex]]?.color || "#fff" }}>
                <span>{state.teams[state.turnOrder[state.currentTurnIndex]]?.name}'s turn to pick</span>
              </div>
            ) : null}
            {state.blindMode ? <div className="blind-pill">Blind round. Categories hidden.</div> : null}
            <div className="question-grid-table">
              <div className="grid-header-cell corner" />
              {DIFFICULTIES.map((d) => (
                <div key={d} className="grid-header-cell difficulty" style={{ background: difficultyColor(d), color: d >= 9 ? "#fff" : "#111" }}>{d}</div>
              ))}
              {state.categoryStats.filter((c) => !c.exhausted || c.withheld).map((c) => (
                <React.Fragment key={c.category}>
                  <div className="grid-category-cell">{state.blindMode ? "???" : c.category}</div>
                  {DIFFICULTIES.map((d) => {
                    const active = c.remainingLevels.includes(d);
                    return <div key={d} className={`grid-diff-cell ${active ? "active" : "used"}`} style={active ? { background: difficultyColor(d), color: d >= 9 ? "#fff" : "#111" } : undefined}>{d}</div>;
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="display-main-stage">

            {state.phase === "bidding" ? (
              <div className="display-centered-content">
                <div>
                  <div className="display-body-big">{state.blindMode ? "Blind category" : state.visibleCategory}</div>
                  <div className="display-body-sub">Place your bid now</div>
                </div>
              </div>
            ) : null}

            {state.phase === "bids-revealed" ? (
              <div className="display-centered-content">
                <div className="display-bids">
                  {displayBidRows.map((row, idx) => (
                    <div key={row.teamId} className={`display-bid ${idx === 0 ? "winner-green" : ""}`}>
                      <div className="display-bid-team">{state.teams[row.teamId]?.name || row.teamId}</div>
                      <div>{row.bid}</div>
                      <div>{formatElapsed(row.elapsedMs)}</div>
                      <div className="display-bid-bidder">
                        <Avatar nickname={row.bidderName} avatarKey={row.bidderAvatarKey} size={44} />
                        <span>{row.bidderAvatarKey ? row.bidderName : row.bidderName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {state.phase === "question" ? (
              <div className="display-centered-content display-question-stage">
                <div className="display-question-wrap">
                  {state.round.activeResponder ? (
                    <div key={`${state.round.activeResponder.teamId}-${state.round.actionSerial}`} className="display-responder-banner" style={{ background: state.teams[state.round.activeResponder.teamId]?.color || "#fff" }}>
                      <span>Now answering</span>
                      <strong>{state.teams[state.round.activeResponder.teamId]?.name || state.round.activeResponder.teamId}</strong>
                    </div>
                  ) : null}
                  <RichPrompt
                    text={state.selectedQuestion?.question}
                    image={state.selectedQuestion?.questionImage}
                    audio={state.selectedQuestion?.questionAudio}
                    video={state.selectedQuestion?.questionVideo}
                    mediaKeyPrefix="question"
                    audioCommand={mediaSide === "question" && mediaType === "audio" ? mediaCommand : null}
                    audioCommandSerial={mediaSide === "question" && mediaType === "audio" ? mediaSerial : 0}
                    videoCommand={mediaSide === "question" && mediaType === "video" ? mediaCommand : null}
                    videoCommandSerial={mediaSide === "question" && mediaType === "video" ? mediaSerial : 0}
                    onAudioEnded={() => socket.emit("display:mediaEnded", { serial: mediaSerial, side: "question" })}
                    onAudioPlayStateChange={handleMediaPlayState}
                    onVideoPlayStateChange={handleMediaPlayState}
                  />
                </div>
              </div>
            ) : null}

            {state.phase === "answer" ? (
              <div className="display-centered-content">
                <RichPrompt
                  text={state.selectedQuestion?.answer}
                  image={state.selectedQuestion?.answerImage}
                  audio={state.selectedQuestion?.answerAudio}
                  video={state.selectedQuestion?.answerVideo}
                  mediaKeyPrefix="answer"
                  audioCommand={mediaSide === "answer" && mediaType === "audio" ? mediaCommand : null}
                  audioCommandSerial={mediaSide === "answer" && mediaType === "audio" ? mediaSerial : 0}
                  videoCommand={mediaSide === "answer" && mediaType === "video" ? mediaCommand : null}
                  videoCommandSerial={mediaSide === "answer" && mediaType === "video" ? mediaSerial : 0}
                  onAudioPlayStateChange={handleMediaPlayState}
                  onVideoPlayStateChange={handleMediaPlayState}
                />
              </div>
            ) : null}

            {state.phase === "activity-title" ? (
              <div className="display-centered-content">
                <div className="est-title-screen">
                  <div className="display-body-big">{state.activity?.title}</div>
                </div>
              </div>
            ) : null}

            {state.phase === "activity-instructions" ? (
              (() => {
                const title = state.activity?.title || "";
                const isEst2 = state.estimation?.type === "estimation-2";
                const isScale = title.toLowerCase().includes("scale");
                const isMathFinal = title.toLowerCase().includes("math final");

                if (isScale) {
                  return (
                    <div className="display-centered-content">
                      <div className="activity-fullimage-wrap">
                        <div className="display-body-big" style={{ marginBottom: 14 }}>{title}</div>
                        <img className="activity-fullimage" src="/media/questions/images/scale.png" alt="Scale Challenge" />
                      </div>
                    </div>
                  );
                }

                if (isMathFinal) {
                  return (
                    <div className="display-centered-content">
                      <div className="activity-fullimage-wrap">
                        <div className="display-body-big" style={{ marginBottom: 14 }}>{title}</div>
                        <img className="activity-fullimage" src="/media/questions/images/math_final.png" alt="Math Final" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="display-centered-content est-result-scroll">
                    <div className="est-instructions-wrap">
                      <div className="display-body-big" style={{ marginBottom: 18 }}>{title}</div>
                      <div className="est-instructions-body">
                        <div className="est-instr-heading">How it works</div>
                        <div className="est-instr-step">A question will appear that requires estimating a number.</div>
                        <div className="est-instr-step">Each player submits their estimate individually.</div>
                        <div className="est-instr-step">When time is up, the correct answer is revealed.</div>
                        {isEst2 ? (
                          <>
                            <div className="est-instr-step"><strong>Each team's estimates are averaged together into one team estimate.</strong></div>
                            <div className="est-instr-step">The team estimate is then scored based on how close it is to the correct value.</div>
                            <div className="est-instr-step"><strong>Outliers hurt your team! Work together to converge on a good estimate.</strong></div>
                          </>
                        ) : (
                          <>
                            <div className="est-instr-step">Players receive points based on how close their estimate is to the correct value.</div>
                            <div className="est-instr-step">Points are calculated for each player.</div>
                            <div className="est-instr-step"><strong>For every question, the team's score is the average of its players' points.</strong></div>
                          </>
                        )}
                        <div className="est-instr-step">These scores are added across all questions in the challenge.</div>
                        <div className="est-instr-heading" style={{ marginTop: 14 }}>Final result</div>
                        <div className="est-instr-step"><strong>The team with the highest total score at the end of the challenge wins.</strong></div>
                      </div>
                      <div className="est-instr-demo-label">Scoring Zones</div>
                      <DemoSlider closePts={state.estimation?.questions?.[0]?.closePts || 3} midPts={state.estimation?.questions?.[0]?.midPts || 2} farPts={state.estimation?.questions?.[0]?.farPts || 1} />
                    </div>
                  </div>
                );
              })()
            ) : null}

            {state.phase === "activity-live" ? (
              <div className="display-centered-content">
                <div className="est-live-question-wrap">
                  <div className="est-round-badge">Question {(state.estimation?.currentIndex ?? 0) + 1} / {state.estimation?.totalQuestions ?? 0}</div>
                  <div className="display-body-big est-question-text">
                    {state.estimation?.questions?.[state.estimation.currentIndex]?.prompt || ""}
                  </div>
                  {state.estimation?.questions?.[state.estimation.currentIndex]?.image ? (
                    <div className="est-question-image-wrap">
                      <img className="est-question-image" src={state.estimation.questions[state.estimation.currentIndex].image} alt="question" />
                    </div>
                  ) : null}
                  <div className="display-body-sub">Submit your estimation now!</div>
                </div>
              </div>
            ) : null}

            {state.phase === "activity-round-result" ? (
              <EstimationResultsView state={state} />
            ) : null}

            {state.phase === "activity-final" ? (
              <EstimationFinalView state={state} />
            ) : null}

            {state.phase === "activity-answer" ? (
              <div className="display-centered-content">
                <div>
                  <div className="display-body-big">Activity Wrap Up</div>
                  <div className="display-body-sub">{state.activity?.notes}</div>
                </div>
              </div>
            ) : null}
          </div>
        )}

      </div>

      <div className="display-score-row">
        {state.scoreboard.map((t) => (
          <div key={t.id} className="score-pill" style={{ background: t.color }}>
            <span>{t.name}</span>
            <strong>{t.score}</strong>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
