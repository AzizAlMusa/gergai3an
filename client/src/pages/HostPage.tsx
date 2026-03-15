import React, { useState } from "react";
import { useApp } from "../state";
import { socket } from "../socket";
import { Shell } from "../components/Shell";
import { StepBar } from "../components/StepBar";
import { Avatar } from "../components/Avatar";

function diffColor(d) {
  const colors = ["#8CF2C3", "#A9F08A", "#D7F06E", "#FFE05D", "#FFCF5D", "#FFB95B", "#FF9A5B", "#FF7A63", "#6A6A6A", "#141414"];
  return colors[d - 1];
}

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const rem = ms % 1000;
  return `${sec}:${String(rem).padStart(3, "0")}`;
}

function formatTime(n) {
  if (n == null) return "";
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function HostMediaControl({ src, side, label, mediaType }) {
  return (
    <div className="fancy-audio-player compact-host-player">
      <div className="tiny-muted"><strong>{label}</strong> · {src.split("/").pop()}</div>
      <div className="button-row tight wrap compact-host-buttons">
        <button className="mini-btn" onClick={() => socket.emit("host:controlMedia", { side, command: "play", mediaType })}>Play on display</button>
        <button className="mini-btn" onClick={() => socket.emit("host:controlMedia", { side, command: "pause", mediaType })}>Pause</button>
        <button className="mini-btn" onClick={() => socket.emit("host:controlMedia", { side, command: "stop", mediaType })}>Stop</button>
      </div>
    </div>
  );
}

export function HostPage() {
  const { state } = useApp();
  const [activityTitle, setActivityTitle] = useState("Estimation Challenge");
  const [activityNotes, setActivityNotes] = useState("Closest answer wins.");
  const [biddingSeconds, setBiddingSeconds] = useState(20);
  const [questionSeconds, setQuestionSeconds] = useState(25);
  const [rewardPoints, setRewardPoints] = useState(10);
  const [penaltyPoints, setPenaltyPoints] = useState(-5);
  const [estQuestions, setEstQuestions] = useState([{ prompt: "", answer: "" }]);
  const [estTimer, setEstTimer] = useState(30);
  const [estPrizes, setEstPrizes] = useState([30, 20, 10]);

  const [activityType, setActivityType] = useState("custom");
  const ACTIVITY_PRESETS = [
    { id: "custom", label: "Custom Activity", title: "", notes: "" },
    { id: "estimation", label: "Estimation Challenge", title: "Estimation Challenge", notes: "Each player estimates a value. The closer you are, the more points you score. Points are averaged per team." },
    { id: "estimation-2", label: "Estimation Challenge II", title: "Estimation Challenge II", notes: "Team estimations are averaged together. Outliers hurt your team! The team average closest to the answer wins." },
    { id: "scale", label: "Scale Challenge", title: "Scale Challenge", notes: "" },
    { id: "math-final", label: "Math Final", title: "Math Final", notes: "" },
    { id: "rapid-fire", label: "Rapid Fire", title: "Rapid Fire", notes: "Answer as many as you can." },
    { id: "picture-round", label: "Picture Round", title: "Picture Round", notes: "Identify what you see." },
    { id: "music-round", label: "Music Round", title: "Music Round", notes: "Name that tune." },
    { id: "lightning", label: "Lightning Round", title: "Lightning Round", notes: "Speed is everything." },
  ];

  if (!state) return null;

  const questionPoints = state.round.questionPoints || state.selectedQuestion?.level || 0;
  const canResolveQuestion = (state.phase === "question" || state.phase === "answer") && state.selectedQuestion;
  const activeResponder = state.round.activeResponder;
  const activeResponderTeam = activeResponder ? state.teams[activeResponder.teamId] : null;
  const questionAudio = state.selectedQuestion?.questionAudio || "";
  const answerAudio = state.selectedQuestion?.answerAudio || "";
  const questionVideo = state.selectedQuestion?.questionVideo || "";
  const answerVideo = state.selectedQuestion?.answerVideo || "";

  return (
    <Shell title="HOST CONTROL" kicker="Game Master">
      <StepBar phase={state.phase} mode={state.mode} gameMode={state.gameMode} />

      <div className="card playful-card top-gap">
        <div className="eyebrow">Game mode</div>
        <div className="button-row">
          <button className={`fun-btn ${state.gameMode === "bidding" ? "" : "ghost"}`} onClick={() => socket.emit("host:setGameMode", { gameMode: "bidding" })}>Bidding Mode</button>
          <button className={`fun-btn ${state.gameMode === "turn" ? "" : "ghost"}`} onClick={() => socket.emit("host:setGameMode", { gameMode: "turn" })}>Turn Mode</button>
        </div>
        {state.gameMode === "turn" ? (
          <>
            <div className="divider" />
            <div className="eyebrow">Turn order</div>
            <div className="turn-order-row">
              {state.turnOrder.map((teamId, idx) => (
                <div key={teamId} className="turn-order-chip" style={{ background: state.teams[teamId]?.color, border: idx === state.currentTurnIndex ? "3px solid var(--ink)" : "3px solid transparent", boxShadow: idx === state.currentTurnIndex ? "4px 4px 0 var(--ink)" : "none" }}>
                  <span className="turn-order-num">{idx + 1}</span>
                  <strong>{state.teams[teamId]?.name}</strong>
                  <div className="button-row tight">
                    {idx > 0 ? <button className="mini-btn" onClick={() => { const o = [...state.turnOrder]; [o[idx - 1], o[idx]] = [o[idx], o[idx - 1]]; socket.emit("host:setTurnOrder", { turnOrder: o }); }}>↑</button> : null}
                    {idx < state.turnOrder.length - 1 ? <button className="mini-btn" onClick={() => { const o = [...state.turnOrder]; [o[idx], o[idx + 1]] = [o[idx + 1], o[idx]]; socket.emit("host:setTurnOrder", { turnOrder: o }); }}>↓</button> : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="button-row">
              <button className="fun-btn alt" onClick={() => socket.emit("host:advanceTurn")}>Advance Turn</button>
            </div>
            <div className="tiny-muted">Current turn: <strong>{state.teams[state.turnOrder[state.currentTurnIndex]]?.name}</strong></div>
          </>
        ) : null}
      </div>

      <div className="host-grid-vertical">
        <div className="card playful-card">
          <div className="eyebrow">Round management</div>
          <div className="host-status">
            <div><strong>Round:</strong> {state.roundNumber}</div>
            <div><strong>Mode:</strong> {state.mode}</div>
            <div><strong>Game mode:</strong> {state.gameMode}</div>
            <div><strong>Current category:</strong> {state.currentCategory || "None"}</div>
            <div><strong>Blind round:</strong> {state.blindMode ? "Yes" : "No"}</div>
            {state.gameMode === "turn" ? (
              <div><strong>Current turn:</strong> {state.teams[state.turnOrder[state.currentTurnIndex]]?.name}</div>
            ) : (
              <>
                <div><strong>Winning bid:</strong> {state.round.winningBid ?? "Not yet"}</div>
                <div><strong>Winning team:</strong> {state.round.winningTeamId ? state.teams[state.round.winningTeamId].name : "Not yet"}</div>
              </>
            )}
          </div>

          <div className="divider" />
          <div className="eyebrow">Timers</div>
          <div className="timer-grid">
            <div>
              <label className="label">Bidding seconds</label>
              <input className="fun-input" type="number" min="5" max="300" value={biddingSeconds} onChange={(e) => setBiddingSeconds(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Question seconds</label>
              <input className="fun-input" type="number" min="5" max="300" value={questionSeconds} onChange={(e) => setQuestionSeconds(Number(e.target.value))} />
            </div>
          </div>
          <div className="button-row">
            <button className="fun-btn alt" onClick={() => socket.emit("host:setTimers", { biddingSeconds, questionSeconds })}>Save Timers</button>
            {(state.phase === "bidding" || state.phase === "question") ? <button className="fun-btn ghost" onClick={() => socket.emit("host:resetActiveTimer")}>Reset Active Timer</button> : null}
            {state.phase === "question" ? <button className="fun-btn ghost" onClick={() => socket.emit("host:toggleQuestionTimer")}>{state.timers.running ? "Pause Question Timer" : "Start Question Timer"}</button> : null}
          </div>

          <div className="button-row wrap">
            <button className="fun-btn" onClick={() => socket.emit("host:startQuestionRound")}>Start Question Round</button>
            {state.gameMode === "bidding" ? (
              <>
                <button className="fun-btn alt" onClick={() => socket.emit("host:openBidding")}>Open Bidding</button>
                <button className="fun-btn alt" onClick={() => socket.emit("host:revealBids")}>Reveal Bids</button>
              </>
            ) : null}
            <button className="fun-btn alt" onClick={() => socket.emit("host:revealQuestion")}>Reveal Question</button>
            <button className="fun-btn alt" onClick={() => socket.emit("host:revealAnswer")}>Reveal Answer</button>
            <button className="fun-btn ghost" onClick={() => socket.emit("host:resetGame")}>Reset Game</button>
          </div>

          {state.gameMode === "turn" && state.phase === "round-ready" ? (
            <>
              <div className="divider" />
              <div className="eyebrow">Pick question ({state.teams[state.turnOrder[state.currentTurnIndex]]?.name}'s turn)</div>
              <div className="turn-pick-grid">
                {state.categoryStats.filter((c) => !c.exhausted).map((c) => (
                  <div className="turn-pick-category" key={c.category}>
                    <div className="turn-pick-cat-name">{c.category}</div>
                    <div className="difficulty-strip">
                      {c.remainingLevels.map((d) => (
                        <button
                          key={d}
                          className="diff-pill active"
                          style={{ background: diffColor(d), color: d >= 9 ? "#fff" : "#111", cursor: "pointer" }}
                          onClick={() => socket.emit("host:pickQuestion", { category: c.category, level: d })}
                        >{d}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {state.selectedQuestion ? (
            <>
              <div className="divider" />
              <div className="eyebrow">Selected question</div>
              <div className="host-question-box">
                <div><strong>Category:</strong> {state.selectedQuestion.category}</div>
                <div><strong>Level used:</strong> {state.selectedQuestion.level}</div>
                <div><strong>Question points:</strong> {questionPoints}</div>
                <div><strong>Question:</strong> {state.selectedQuestion.question}</div>
                <div><strong>Answer:</strong> {state.selectedQuestion.answer}</div>
                <div><strong>Notes:</strong> {state.selectedQuestion.hostNotes || "None"}</div>
                {state.selectedQuestion.questionImage ? (
                  <div className="host-image-preview top-gap">
                    <div className="tiny-muted"><strong>Question image</strong></div>
                    <img className="host-thumb" src={state.selectedQuestion.questionImage} alt="question" />
                    <button className="mini-btn" onClick={() => socket.emit("host:toggleImageMaximize")}>
                      {state.imageMaximized ? "Minimize on display" : "Maximize on display"}
                    </button>
                  </div>
                ) : null}
                {state.selectedQuestion.answerImage ? (
                  <div className="host-image-preview top-gap">
                    <div className="tiny-muted"><strong>Answer image</strong></div>
                    <img className="host-thumb" src={state.selectedQuestion.answerImage} alt="answer" />
                    <button className="mini-btn" onClick={() => socket.emit("host:toggleImageMaximize")}>
                      {state.imageMaximized ? "Minimize on display" : "Maximize on display"}
                    </button>
                  </div>
                ) : null}
                {(questionAudio || answerAudio || questionVideo || answerVideo) ? (
                  <div className="host-media-stack top-gap">
                    {questionAudio ? (
                      <div>
                        <HostMediaControl src={questionAudio} side="question" label="Question audio" mediaType="audio" />
                      </div>
                    ) : null}
                    {questionVideo ? (
                      <div>
                        <HostMediaControl src={questionVideo} side="question" label="Question video" mediaType="video" />
                      </div>
                    ) : null}
                    {answerAudio ? (
                      <div>
                        <HostMediaControl src={answerAudio} side="answer" label="Answer audio" mediaType="audio" />
                      </div>
                    ) : null}
                    {answerVideo ? (
                      <div>
                        <HostMediaControl src={answerVideo} side="answer" label="Answer video" mediaType="video" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {canResolveQuestion ? (
            <>
              <div className="divider" />
              <div className="eyebrow">Resolve this question</div>
              <div className="host-question-box">
                <div className="timer-grid">
                  <div>
                    <label className="label">Reward points</label>
                    <input className="fun-input" type="number" value={rewardPoints} onChange={(e) => setRewardPoints(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Penalty points</label>
                    <input className="fun-input" type="number" value={penaltyPoints} onChange={(e) => setPenaltyPoints(Number(e.target.value))} />
                  </div>
                </div>
                <div className="resolve-team-badge" style={{ background: activeResponderTeam?.color || '#f1ece5' }}>
                  <div className="resolve-team-title">Current team on the question</div>
                  <div className="resolve-team-name">{activeResponderTeam?.name || "No team available"}</div>
                  <div className="resolve-bidder-name">Bidder: {activeResponder?.bidderName || "None"}</div>
                </div>
                <div className="button-row wrap">
                  <button className="fun-btn alt" onClick={() => socket.emit("host:resolveQuestion", { rewardPoints, penaltyPoints, correct: true, action: "correct" })}>
                    Correct (+{rewardPoints})
                  </button>
                  <button className="fun-btn ghost" onClick={() => socket.emit("host:resolveQuestion", { rewardPoints, penaltyPoints, correct: false, action: "wrong" })}>
                    Wrong ({penaltyPoints}) to Next Team
                  </button>
                  <button className="fun-btn ghost" onClick={() => socket.emit("host:resolveQuestion", { rewardPoints, penaltyPoints, correct: false, action: "pass" })}>
                    Pass to Next Team
                  </button>
                </div>
                {state.round.lastAction === "correct" && state.round.scoring?.awardedTeamId ? (
                  <div className="tiny-muted">Awarded {state.round.scoring.awardedPoints} to {state.teams[state.round.scoring.awardedTeamId]?.name || "team"}.</div>
                ) : null}
                {state.round.lastAction === "wrong" && state.round.scoring?.awardedTeamId ? (
                  <div className="tiny-muted">Applied {state.round.scoring.awardedPoints} to {state.teams[state.round.scoring.awardedTeamId]?.name || "team"} and moved on.</div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="divider" />
          <div className="eyebrow">Activity round</div>
          <select className="fun-input" value={activityType} onChange={(e) => {
            setActivityType(e.target.value);
            const preset = ACTIVITY_PRESETS.find((a) => a.id === e.target.value);
            if (preset && preset.id !== "custom") {
              setActivityTitle(preset.title);
              setActivityNotes(preset.notes);
            }
          }}>
            {ACTIVITY_PRESETS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <input className="fun-input" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Activity title" />
          <textarea className="fun-textarea" value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} placeholder="Activity notes" />

          {(activityType === "estimation" || activityType === "estimation-2") ? (
            <>
              <div className="divider" />
              <div className="eyebrow">Estimation config</div>
              <div className="tiny-muted">{activityType === "estimation-2" ? "Type II: team average estimation scored" : "Type I: individual scores averaged per team"}</div>
              <div className="tiny-muted">Loaded {state.estimation?.totalQuestions || 0} questions from database</div>
              <div className="timer-grid">
                <div>
                  <label className="label">1st / 2nd / 3rd prizes</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="fun-input" type="number" value={estPrizes[0]} onChange={(e) => setEstPrizes([Number(e.target.value), estPrizes[1], estPrizes[2]])} style={{ width: 60 }} />
                    <input className="fun-input" type="number" value={estPrizes[1]} onChange={(e) => setEstPrizes([estPrizes[0], Number(e.target.value), estPrizes[2]])} style={{ width: 60 }} />
                    <input className="fun-input" type="number" value={estPrizes[2]} onChange={(e) => setEstPrizes([estPrizes[0], estPrizes[1], Number(e.target.value)])} style={{ width: 60 }} />
                  </div>
                </div>
              </div>
              <div className="button-row">
                <button className="mini-btn" onClick={() => socket.emit("host:setEstimationQuestions", { prizePools: { first: estPrizes[0], second: estPrizes[1], third: estPrizes[2] } })}>Save Config</button>
              </div>
            </>
          ) : null}

          <div className="button-row">
            <button className="fun-btn" onClick={() => socket.emit("host:startActivityRound", { title: activityTitle, notes: activityNotes, activityType })}>Start Activity Round</button>
          </div>

          {state.mode === "activity" ? (
            <div className="button-row">
              <button className="fun-btn ghost" onClick={() => socket.emit("host:activityPrev")} disabled={state.phase === "activity-title"}>← Back</button>
              <button className="fun-btn alt" onClick={() => socket.emit("host:activityNext")}>Next Step →</button>
              <div className="tiny-muted">Phase: {state.phase} {state.estimation.currentIndex >= 0 ? `(Q${state.estimation.currentIndex + 1}/${state.estimation.totalQuestions})` : ""}</div>
            </div>
          ) : null}
        </div>

        <div className="host-bottom-row">
          <div className="card playful-card">
            <div className="eyebrow">Teams and scores</div>
            {["A", "B", "C"].map((id) => (
              <div className="host-team-row" key={id} style={{ background: state.teams[id].color }}>
                <input className="team-input" defaultValue={state.teams[id].name} onBlur={(e) => socket.emit("host:renameTeam", { teamId: id, name: e.target.value })} />
                <div className="host-score">{state.teams[id].score}</div>
                <div className="button-row tight wrap">
                  {[10, 5, -5, -10].map((n) => (
                    <button key={n} className="mini-btn" onClick={() => socket.emit("host:award", { teamId: id, delta: n })}>
                      {n > 0 ? `+${n}` : n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card playful-card">
            <div className="eyebrow">Players</div>
            <div className="player-list">
              {Object.values(state.players).map((p) => (
                <div className="player-row" key={p.id}>
                  <div className="player-main">
                    <Avatar nickname={p.nickname} avatarKey={p.avatarKey} size={52} />
                    <div>
                      <strong>{p.nickname}</strong>
                      <div className="tiny-muted">{state.teams[p.teamId].name}</div>
                    </div>
                  </div>
                  <div className="player-controls">
                    <select className="mini-select" value={p.teamId} onChange={(e) => socket.emit("host:movePlayer", { playerId: p.id, teamId: e.target.value })}>
                      {["A", "B", "C"].map((id) => (
                        <option key={id} value={id}>{state.teams[id].name}</option>
                      ))}
                    </select>
                    <select className="mini-select" value={p.avatarKey || ""} onChange={(e) => socket.emit("host:setAvatar", { playerId: p.id, avatarKey: e.target.value || null })}>
                      <option value="">No avatar</option>
                      {state.avatarKeys.map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                    <button className="mini-btn danger" onClick={() => socket.emit("host:kickPlayer", { playerId: p.id })}>Kick</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="host-bidding-grid top-gap-xl">
        <div className="card playful-card">
          <div className="eyebrow">Player answers</div>
          {state.round.playerAnswers.length === 0 ? <div className="tiny-muted">No answers submitted yet.</div> : null}
          {["A", "B", "C"].map((teamId) => {
            const teamAnswers = state.round.playerAnswers.filter((a) => a.teamId === teamId);
            if (teamAnswers.length === 0) return null;
            return (
              <div key={teamId} style={{ marginTop: 10 }}>
                <div className="bid-history-team" style={{ background: state.teams[teamId].color, display: "inline-block", marginBottom: 6 }}>{state.teams[teamId].name}</div>
                <div className="bid-history-list">
                  {teamAnswers.map((entry) => (
                    <div key={entry.id} className="bid-history-item current">
                      <div className="bid-history-main">
                        <Avatar nickname={entry.nickname} avatarKey={entry.avatarKey} size={34} />
                        <div>
                          <div><strong>{entry.nickname}</strong></div>
                          <div>{entry.answer}</div>
                        </div>
                      </div>
                      <div className="tiny-muted">{formatElapsed(entry.elapsedMs)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card playful-card">
          <div className="eyebrow">Round bidding history</div>
          {state.round.bidHistory.length === 0 ? <div className="tiny-muted">No bids submitted yet.</div> : null}
          <div className="bid-history-list">
            {state.round.bidHistory.map((entry) => (
              <div key={entry.id} className={`bid-history-item ${entry.isCurrentForTeam ? "current" : "overridden"}`}>
                <div className="bid-history-main">
                  <Avatar nickname={entry.bidderName} avatarKey={entry.bidderAvatarKey} size={38} />
                  <div>
                    <div><strong>{entry.bidderName}</strong> <span className="tiny-muted">for {state.teams[entry.teamId].name}</span></div>
                    <div className="tiny-muted">Bid {entry.bid}</div>
                  </div>
                </div>
                <div className="tiny-muted">{formatElapsed(entry.elapsedMs)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card playful-card top-gap-xl">
        <div className="eyebrow">Question bank status</div>
        <div className="category-grid">
          {state.categoryStats.map((c) => (
            <div className={`category-card ${c.withheld ? "withheld" : ""} ${c.exhausted ? "exhausted" : ""}`} key={c.category}>
              <div className="category-name">{c.category}</div>
              <div className="tiny-muted">{c.exhausted ? "Exhausted" : c.withheld ? "Held for blind round" : "Active"}</div>
              <div className="difficulty-strip">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => {
                  const active = c.remainingLevels.includes(d);
                  return (
                    <button
                      type="button"
                      key={d}
                      className={`diff-pill question-toggle-pill ${active ? "active" : "used"}`}
                      style={active ? { background: diffColor(d), color: d >= 9 ? "#fff" : "#111" } : undefined}
                      onClick={() => socket.emit("host:toggleQuestionAvailability", { category: c.category, level: d })}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
