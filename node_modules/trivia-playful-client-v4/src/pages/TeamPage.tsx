import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../state";
import { socket } from "../socket";
import { Shell } from "../components/Shell";
import { BidSlider } from "../components/BidSlider";
import { Avatar } from "../components/Avatar";

function diffColor(d) {
  const colors = ["#8CF2C3", "#A9F08A", "#D7F06E", "#FFE05D", "#FFCF5D", "#FFB95B", "#FF9A5B", "#FF7A63", "#6A6A6A", "#141414"];
  return colors[d - 1];
}

export function TeamPage() {
  const { state, player } = useApp();
  const [bid, setBid] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState("");

  useEffect(() => {
    setAnswer("");
    setAnswerFeedback("");
  }, [state?.estimation?.currentIndex]);

  const team = useMemo(() => (state && player ? state.teams[player.teamId] : null), [state, player]);
  const ownLastSubmission = useMemo(() => {
    if (!state || !player) return null;
    for (let i = state.round.bidHistory.length - 1; i >= 0; i -= 1) {
      if (state.round.bidHistory[i].playerId === player.id) return state.round.bidHistory[i];
    }
    return null;
  }, [state, player]);

  const currentCategoryStats = useMemo(() => {
    if (!state?.currentCategory) return null;
    return state.categoryStats.find((entry) => entry.category === state.currentCategory) || null;
  }, [state]);

  const bidAvailable = !state?.currentCategory || !currentCategoryStats
    ? true
    : currentCategoryStats.remainingLevels.includes(bid);

  if (!player) return <Navigate to="/join" replace />;
  if (!state || !team) return null;

  const showTimer = state.timers.running && (state.timers.activeType === "bidding" || state.timers.activeType === "question");
  const canSubmit = state.round.biddingOpen && bidAvailable && (!ownLastSubmission || ownLastSubmission.bid !== bid);
  const timerExpired = state.timers.activeType === "question" && !state.timers.running && state.timers.hasStartedOnce && (state.timers.remaining ?? 1) <= 0;
  const answersOpen = (state.phase === "question" || state.phase === "activity-live") && !timerExpired;

  const isMyTeamsTurn = state.gameMode === "turn" && state.turnOrder[state.currentTurnIndex] === player.teamId;

  const isEstimationLive = state.phase === "activity-live" && state.estimation;
  const answerPlaceholder = isEstimationLive
    ? "Enter your estimation number..."
    : answersOpen ? "Type your answer..." : "Answers open during questions";
  const answerInputType = isEstimationLive ? "number" : "text";

  const handleAnswerSubmit = () => {
    if (isEstimationLive) {
      // Submit as estimation
      socket.emit("player:submitEstimation", { playerId: player.id, value: Number(answer) }, (res) => {
        if (!res?.ok) {
          setAnswerFeedback(res?.error || "Could not submit.");
          return;
        }
        setAnswerFeedback("Submitted!");
        setTimeout(() => setAnswerFeedback(""), 2000);
      });
    } else {
      // Submit as normal answer
      socket.emit("player:submitAnswer", { playerId: player.id, answer: answer.trim() }, (res) => {
        if (!res?.ok) {
          setAnswerFeedback(res?.error || "Could not submit.");
          return;
        }
        setAnswerFeedback("Submitted!");
        setAnswer("");
        setTimeout(() => setAnswerFeedback(""), 2000);
      });
    }
  };

  return (
    <Shell title={team.name} kicker={player.nickname}>
      <div className="team-grid">
        <div className={`card playful-card ${isMyTeamsTurn ? "your-turn-glow" : ""}`} style={{ background: team.color }}>
          <div className="eyebrow">Round status</div>
          {isMyTeamsTurn ? <div className="your-turn-banner">Your team's turn!</div> : null}
          <div className="big-title">{state.blindMode ? "Blind Round" : state.visibleCategory || "Waiting..."}</div>
          <div className="muted-line">{state.phase.replaceAll("-", " ")}</div>
          {showTimer ? <div className="timer-pill big">{state.timers.remaining ?? 0}</div> : null}
          <div className="top-gap">
            <Avatar nickname={player.nickname} avatarKey={player.avatarKey} size={88} />
          </div>
        </div>

        <div className="card playful-card">
          <div className="eyebrow">Bidding</div>
          <div className="muted-line">Choose the difficulty you want to bid for.</div>
          <BidSlider
            value={bid}
            onChange={(value) => {
              setBid(value);
              setFeedback("");
            }}
            disabled={!state.round.biddingOpen}
          />
          <div className="button-row">
            <button
              className="fun-btn"
              disabled={!canSubmit}
              onClick={() => {
                if (!bidAvailable) {
                  setFeedback("This bid is not available.");
                  return;
                }
                socket.emit("bid:submit", { playerId: player.id, value: bid }, (res) => {
                  if (!res?.ok) {
                    setFeedback(res?.error || "Bid unavailable.");
                    return;
                  }
                  setFeedback("");
                });
              }}
            >
              {ownLastSubmission && ownLastSubmission.bid === bid ? "Submitted" : ownLastSubmission ? "Update Bid" : "Submit Bid"}
            </button>
          </div>
          {feedback ? <div className="error-text compact-feedback">{feedback}</div> : null}
        </div>

        <div className="card playful-card" style={isEstimationLive ? { borderColor: "#22c55e" } : undefined}>
          <div className="eyebrow">{isEstimationLive ? "Estimation" : "Answer"}</div>
          {isEstimationLive ? (
            <div className="tiny-muted">Q{(state.estimation.currentIndex ?? 0) + 1}/{state.estimation.totalQuestions}: {state.estimation.questions?.[state.estimation.currentIndex]?.prompt || ""}</div>
          ) : null}
          <input
            className="fun-input"
            type={answerInputType}
            value={answer}
            onChange={(e) => { setAnswer(e.target.value); setAnswerFeedback(""); }}
            placeholder={answerPlaceholder}
            disabled={isEstimationLive ? false : !answersOpen}
          />
          <div className="button-row">
            <button
              className="fun-btn"
              disabled={isEstimationLive ? answer === "" : (!answersOpen || !answer.trim())}
              onClick={handleAnswerSubmit}
            >
              {isEstimationLive ? "Submit Estimation" : "Submit Answer"}
            </button>
          </div>
          {answerFeedback ? <div className={answerFeedback === "Submitted!" ? "success-text" : "error-text"}>{answerFeedback}</div> : null}
        </div>

        <div className="card playful-card">
          <div className="eyebrow">Your squad</div>
          <div className="team-roster">
            {state.rosters[player.teamId].map((p) => (
              <div className="mini-person" key={p.id}>
                <Avatar nickname={p.nickname} avatarKey={p.avatarKey} size={56} />
                <span>{p.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="score-row">
        {state.scoreboard.map((t) => (
          <div key={t.id} className="score-pill" style={{ background: t.color }}>
            <span>{t.name}</span>
            <strong>{t.score}</strong>
          </div>
        ))}
      </div>

      <div className="card playful-card top-gap" style={{ opacity: 0.75 }}>
        <div className="eyebrow">Question board</div>
        <div className="player-board-compact">
          {state.categoryStats.filter((c) => !c.exhausted || c.remainingLevels.length > 0).map((c) => (
            <div className="player-board-row" key={c.category}>
              <div className="player-board-cat">{state.blindMode ? "???" : c.category}</div>
              <div className="player-board-pips">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => {
                  const active = c.remainingLevels.includes(d);
                  return (
                    <span
                      key={d}
                      className={`player-board-pip ${active ? "active" : "used"}`}
                      style={active ? { background: diffColor(d), color: d >= 9 ? "#fff" : "#111" } : undefined}
                    >{d}</span>
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
