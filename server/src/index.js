import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.join(__dirname, "db", "questions.json");
const rawQuestions = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));
const estimationPath = path.join(__dirname, "db", "estimation.json");
const rawEstimation = JSON.parse(fs.readFileSync(estimationPath, "utf-8"));
const estimation2Path = path.join(__dirname, "db", "estimation2.json");
const rawEstimation2 = fs.existsSync(estimation2Path) ? JSON.parse(fs.readFileSync(estimation2Path, "utf-8")) : rawEstimation;

const PORT = process.env.PORT || 3002;
const TEAM_IDS = ["A", "B", "C"];
const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const AVATAR_KEYS = ["fawaz", "gannas", "tariq", "hamad", "tamimi", "mugeet", "haitham", "khalid", "maan", "mezail", "yousef", "talal", "abdulrahman", "abood", "fouzan", "aj", "omar", "osama", "hammad", "reda", "dhari"];

function slug(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function questionKey(category, level) {
  return `${slug(category)}::${Number(level)}`;
}

function readMedia(q, side, kind) {
  const directKey = `${side}_${kind}`;
  const nestedKey = `${side}_media`;
  let val = q?.[directKey] || q?.[nestedKey]?.[kind] || null;
  // Normalize common path variants: /videos/ -> /video/, /images/ -> /images/ (already correct)
  if (val && typeof val === "string") {
    val = val.replace(/\/videos\//g, "/video/");
  }
  return val;
}

const questions = rawQuestions.map((q, i) => ({
  id: `${slug(q.category)}-${Number(q.level)}-${i}`,
  category: q.category,
  level: Number(q.level),
  subCategory: q.sub_category || "",
  format: q.format || "text",
  question: q.question || "",
  answer: q.answer || "",
  questionImage: readMedia(q, "question", "image"),
  questionAudio: readMedia(q, "question", "audio"),
  questionVideo: readMedia(q, "question", "video"),
  answerImage: readMedia(q, "answer", "image"),
  answerAudio: readMedia(q, "answer", "audio"),
  answerVideo: readMedia(q, "answer", "video"),
  hostNotes: q.host_notes || ""
}));

const allCategories = [...new Set(questions.map((q) => q.category))];
let timerInterval = null;
let categoryCursor = -1;
let blindCursor = -1;

function initialRoundState() {
  return {
    biddingOpen: false,
    bidsLocked: false,
    bidsRevealed: false,
    bids: {},
    bidHistory: [],
    playerAnswers: [],
    winningBid: null,
    winningTeamId: null,
    activeBidTeamIndex: 0,
    scoring: {
      resolved: false,
      awardedTeamId: null,
      awardedPoints: 0,
      wasCorrect: null
    },
    actionSerial: 0,
    lastAction: null
  };
}

function mapEstimationQuestions(raw) {
  return raw.map((q) => ({
    prompt: q.question,
    answer: q.correct_value,
    timeLimit: q.time_limit || 30,
    closeTol: q.close_tolerance,
    midTol: q.mid_tolerance,
    farTol: q.far_tolerance,
    closePts: q.close_points || 3,
    midPts: q.mid_points || 2,
    farPts: q.far_points || 1,
    image: q.question_image || q.image || null,
    audio: q.question_audio || q.audio || null
  }));
}

const estimationQuestions1 = mapEstimationQuestions(rawEstimation);
const estimationQuestions2 = mapEstimationQuestions(rawEstimation2);

function initialState() {
  return {
    teams: {
      A: { id: "A", name: "Team Bananas", color: "#FFD84D", score: 0 },
      B: { id: "B", name: "Team Flamingos", color: "#FF8AD8", score: 0 },
      C: { id: "C", name: "Team Rockets", color: "#7B6CFF", score: 0 }
    },
    players: {},
    usedQuestionIds: [],
  manuallyDisabledQuestions: {},
    phase: "lobby",
    mode: "question",
    roundNumber: 0,
    blindMode: false,
    currentCategory: null,
    selectedQuestion: null,
    activity: { title: "Mini Challenge", notes: "" },
    estimation: {
      type: "estimation-1",
      questions: estimationQuestions1,
      currentIndex: -1,
      submissions: {},
      roundResults: [],
      allResultsRevealed: false,
      teamScores: { A: 0, B: 0, C: 0 },
      prizePools: { first: 30, second: 20, third: 10 },
      timerSeconds: 30
    },
    timers: {
      biddingSeconds: 20,
      questionSeconds: 25,
      activeType: null,
      running: false,
      remaining: null,
      endsAt: null,
      startedAt: null,
      hasStartedOnce: false
    },
    round: initialRoundState(),
    mediaControl: { serial: 0, command: null, side: null, src: null },
    imageMaximized: false,
    gameMode: "bidding",
    turnOrder: ["A", "B", "C"],
    currentTurnIndex: 0
  };
}

let state = initialState();

function unusedQs() {
  const used = new Set(state.usedQuestionIds);
  return questions.filter((q) => !used.has(q.id));
}

function remainingByCategory(category) {
  return unusedQs().filter((q) => q.category === category && !state.manuallyDisabledQuestions[questionKey(q.category, q.level)]);
}

function remainingLevels(category) {
  return [...new Set(remainingByCategory(category).map((q) => q.level))].sort((a, b) => a - b);
}

function activeCategories() {
  return allCategories.filter((category) => remainingLevels(category).length >= 3);
}

function withheldCategories() {
  return allCategories.filter((category) => {
    const n = remainingLevels(category).length;
    return n > 0 && n < 3;
  });
}

function nextCategory(list, kind) {
  if (!list.length) return null;
  if (kind === "normal") {
    categoryCursor = (categoryCursor + 1) % list.length;
    return list[categoryCursor];
  }
  blindCursor = (blindCursor + 1) % list.length;
  return list[blindCursor];
}

function resetTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  state.timers.activeType = null;
  state.timers.running = false;
  state.timers.remaining = null;
  state.timers.endsAt = null;
  state.timers.startedAt = null;
  state.timers.hasStartedOnce = false;
}

function setTimerReady(type, seconds) {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  state.timers.activeType = type;
  state.timers.running = false;
  state.timers.remaining = seconds;
  state.timers.endsAt = null;
  state.timers.startedAt = null;
  state.timers.hasStartedOnce = false;
}

function runTimer(type, seconds, preserveStartedState = false) {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  state.timers.activeType = type;
  state.timers.running = true;
  state.timers.remaining = seconds;
  state.timers.startedAt = Date.now();
  state.timers.endsAt = Date.now() + seconds * 1000;
  if (!preserveStartedState) state.timers.hasStartedOnce = true;
  timerInterval = setInterval(() => {
    const ms = Math.max(0, state.timers.endsAt - Date.now());
    state.timers.remaining = Math.ceil(ms / 1000);
    if (ms <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      state.timers.running = false;
      state.timers.remaining = 0;
      if (type === "bidding" && state.round.biddingOpen) revealBidsInternal();
    }
    emitState();
  }, 200);
}

function startTimer(type, seconds) {
  runTimer(type, seconds, false);
}

function resumeTimer() {
  if (!state.timers.activeType) return;
  const fallback = state.timers.activeType === "bidding" ? state.timers.biddingSeconds : state.timers.questionSeconds;
  const seconds = Math.max(0, Number(state.timers.remaining ?? fallback) || 0);
  runTimer(state.timers.activeType, seconds, true);
}

function pauseTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  if (state.timers.endsAt) {
    const ms = Math.max(0, state.timers.endsAt - Date.now());
    state.timers.remaining = Math.ceil(ms / 1000);
  }
  state.timers.running = false;
  state.timers.endsAt = null;
}

function resetRoundInternals() {
  resetTimer();
  state.round = initialRoundState();
  state.selectedQuestion = null;
  state.imageMaximized = false;
}

function prepareNextQuestionRound() {
  resetRoundInternals();
  const active = activeCategories();
  const held = withheldCategories();
  state.blindMode = active.length === 0 && held.length > 0;
  state.currentCategory = state.blindMode ? nextCategory(held, "blind") : nextCategory(active, "normal");
  state.mode = "question";
  state.phase = "round-ready";
  state.roundNumber += 1;
}

function prepareActivityRound(title, notes, activityType) {
  resetRoundInternals();
  state.mode = "activity";
  state.phase = "activity-title";
  state.activity = { title: title || "Mini Challenge", notes: notes || "" };
  state.currentCategory = null;
  state.blindMode = false;
  state.roundNumber += 1;
  if (activityType === "estimation" || activityType === "estimation-2") {
    state.estimation.type = activityType === "estimation-2" ? "estimation-2" : "estimation-1";
    state.estimation.questions = activityType === "estimation-2" ? mapEstimationQuestions(rawEstimation2) : mapEstimationQuestions(rawEstimation);
    state.estimation.currentIndex = -1;
    state.estimation.submissions = {};
    state.estimation.roundResults = [];
    state.estimation.teamScores = { A: 0, B: 0, C: 0 };
  }
}

function scoreEstimationRound(questionIndex) {
  const q = state.estimation.questions[questionIndex];
  if (!q) return [];
  const answer = q.answer;
  const subs = state.estimation.submissions[questionIndex] || {};
  const results = [];
  for (const [playerId, est] of Object.entries(subs)) {
    const p = state.players[playerId];
    if (!p) continue;
    const diff = Math.abs(est - answer);
    let zone, points;
    if (diff <= q.closeTol) { zone = "close"; points = q.closePts; }
    else if (diff <= q.midTol) { zone = "mid"; points = q.midPts; }
    else if (diff <= q.farTol) { zone = "far"; points = q.farPts; }
    else { zone = "out"; points = 0; }
    results.push({ playerId, nickname: p.nickname, teamId: p.teamId, avatarKey: p.avatarKey || null, estimation: est, diff, zone, points });
  }
  return results;
}

function computeEstimationTeamScores() {
  const est = state.estimation;
  const teamScores = { A: 0, B: 0, C: 0 };
  for (const rr of est.roundResults) {
    if (est.type === "estimation-2") {
      const teamGroups = {};
      for (const r of rr.results) {
        if (!teamGroups[r.teamId]) teamGroups[r.teamId] = [];
        teamGroups[r.teamId].push(r.estimation);
      }
      const q = est.questions[rr.questionIndex];
      const teamAvgs = {};
      for (const [tid, vals] of Object.entries(teamGroups)) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const diff = Math.abs(avg - rr.answer);
        let pts;
        if (diff <= q.closeTol) pts = q.closePts;
        else if (diff <= q.midTol) pts = q.midPts;
        else if (diff <= q.farTol) pts = q.farPts;
        else pts = 0;
        teamAvgs[tid] = { avg, pts };
        teamScores[tid] = (teamScores[tid] || 0) + pts;
      }
      rr.teamAvgs = teamAvgs;
    } else {
      const teamGroups = {};
      for (const r of rr.results) {
        if (!teamGroups[r.teamId]) teamGroups[r.teamId] = [];
        teamGroups[r.teamId].push(r.points);
      }
      for (const [tid, pts] of Object.entries(teamGroups)) {
        const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
        teamScores[tid] = (teamScores[tid] || 0) + Math.round(avg * 100) / 100;
      }
    }
  }
  est.teamScores = teamScores;
}

function bidValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function currentQuestionPoints() {
  if (state.selectedQuestion?.level != null) return Number(state.selectedQuestion.level) || 0;
  if (state.round.winningBid != null) return Number(state.round.winningBid) || 0;
  return 0;
}

function latestPlayerSubmission(playerId) {
  for (let i = state.round.bidHistory.length - 1; i >= 0; i -= 1) {
    if (state.round.bidHistory[i].playerId === playerId) return state.round.bidHistory[i];
  }
  return null;
}

function rankingBids() {
  return Object.entries(state.round.bids)
    .map(([teamId, meta]) => ({
      teamId,
      bid: meta.bid,
      elapsedMs: meta.elapsedMs,
      teamName: state.teams[teamId].name,
      playerId: meta.playerId,
      bidderName: meta.bidderName,
      bidderAvatarKey: meta.bidderAvatarKey || null
    }))
    .sort((a, b) => (b.bid !== a.bid ? b.bid - a.bid : a.elapsedMs - b.elapsedMs));
}

function highestBid() {
  return rankingBids()[0] || null;
}

function activeBidResponder() {
  const ranked = rankingBids();
  return ranked[state.round.activeBidTeamIndex || 0] || null;
}

function chooseQuestion(category, bid) {
  if (!category) return null;
  const pool = remainingByCategory(category);
  const exact = pool.find((q) => q.level === bid);
  if (exact) return exact;
  const lower = pool.filter((q) => q.level < bid).sort((a, b) => b.level - a.level);
  if (lower.length) return lower[0];
  const higher = pool.filter((q) => q.level > bid).sort((a, b) => a.level - b.level);
  return higher[0] || null;
}

function teamRoster(teamId) {
  return Object.values(state.players)
    .filter((p) => p.teamId === teamId)
    .map((p) => ({ id: p.id, nickname: p.nickname, avatarKey: p.avatarKey || null }));
}

function categoryStats() {
  return allCategories.map((category) => {
    const levels = remainingLevels(category);
    return {
      category,
      remainingLevels: levels,
      remainingCount: levels.length,
      withheld: levels.length > 0 && levels.length < 3,
      exhausted: levels.length === 0
    };
  });
}



function isBidAvailableForCurrentCategory(value) {
  if (!state.currentCategory) return true;
  const levels = remainingLevels(state.currentCategory);
  return levels.includes(Number(value));
}

function revealBidsInternal() {
  state.round.biddingOpen = false;
  state.round.bidsLocked = true;
  state.round.bidsRevealed = true;
  const top = highestBid();
  state.round.winningBid = top?.bid ?? null;
  state.round.winningTeamId = top?.teamId ?? null;
  state.round.activeBidTeamIndex = 0;
  state.phase = "bids-revealed";
  resetTimer();
  // Pre-select question so host can see it before revealing to display
  if (top && state.currentCategory) {
    const picked = chooseQuestion(state.currentCategory, top.bid);
    if (picked) {
      state.selectedQuestion = picked;
      state.usedQuestionIds.push(picked.id);
    }
  }
}

function publicState() {
  return {
    teams: state.teams,
    players: state.players,
    phase: state.phase,
    mode: state.mode,
    roundNumber: state.roundNumber,
    blindMode: state.blindMode,
    currentCategory: state.currentCategory,
    visibleCategory: state.blindMode ? null : state.currentCategory,
    round: {
      ...state.round,
      bids: state.round.bidsRevealed
        ? Object.fromEntries(Object.entries(state.round.bids).map(([k, v]) => [k, v.bid]))
        : {},
      bidRanking: state.round.bidsRevealed ? rankingBids() : [],
      submittedCount: Object.keys(state.round.bids).length,
      expectedCount: TEAM_IDS.length,
      questionPoints: currentQuestionPoints(),
      bidHistory: state.round.bidHistory,
      playerAnswers: state.round.playerAnswers,
      activeBidTeamIndex: state.round.activeBidTeamIndex,
      activeResponder: activeBidResponder()
    },
    selectedQuestion: state.selectedQuestion,
    scoreboard: TEAM_IDS.map((id) => state.teams[id]).sort((a, b) => b.score - a.score),
    rosters: Object.fromEntries(TEAM_IDS.map((id) => [id, teamRoster(id)])),
    categoryStats: categoryStats(),
    avatarKeys: AVATAR_KEYS,
    activity: state.activity,
    estimation: {
      type: state.estimation.type,
      questions: state.estimation.questions.map((q, i) => ({
        prompt: q.prompt,
        answer: (state.phase === "activity-round-result" || state.phase === "activity-final") ? q.answer : null,
        closeTol: q.closeTol, midTol: q.midTol, farTol: q.farTol,
        closePts: q.closePts, midPts: q.midPts, farPts: q.farPts,
        image: q.image || null,
        audio: q.audio || null,
        index: i
      })),
      currentIndex: state.estimation.currentIndex,
      submissions: state.estimation.submissions,
      roundResults: state.estimation.roundResults,
      allResultsRevealed: state.estimation.allResultsRevealed,
      currentResultIndex: state.estimation.currentResultIndex ?? 0,
      teamScores: state.estimation.teamScores,
      prizePools: state.estimation.prizePools,
      timerSeconds: state.estimation.timerSeconds,
      totalQuestions: state.estimation.questions.length
    },
    timers: state.timers,
    mediaControl: state.mediaControl,
    imageMaximized: state.imageMaximized,
    gameMode: state.gameMode,
    turnOrder: state.turnOrder,
    currentTurnIndex: state.currentTurnIndex
  };
}

let _emitScheduled = false;
function emitState() {
  if (_emitScheduled) return;
  _emitScheduled = true;
  queueMicrotask(() => {
    _emitScheduled = false;
    io.emit("state", publicState());
  });
}

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true, port: PORT }));
app.get("/test/questions", (_req, res) => {
  const byCategory = {};
  for (const q of questions) {
    if (!byCategory[q.category]) byCategory[q.category] = [];
    byCategory[q.category].push({
      id: q.id,
      level: q.level,
      subCategory: q.subCategory,
      format: q.format,
      question: q.question,
      answer: q.answer,
      questionImage: q.questionImage,
      questionAudio: q.questionAudio,
      questionVideo: q.questionVideo,
      answerImage: q.answerImage,
      answerAudio: q.answerAudio,
      answerVideo: q.answerVideo,
      hostNotes: q.hostNotes,
      used: state.usedQuestionIds.includes(q.id),
      disabled: Boolean(state.manuallyDisabledQuestions[questionKey(q.category, q.level)])
    });
  }
  res.json({ categories: Object.keys(byCategory).sort(), byCategory, blindMode: state.blindMode });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 5000,
  httpCompression: true,
  perMessageDeflate: false,
});

io.on("connection", (socket) => {
  socket.emit("state", publicState());

  socket.on("player:join", ({ nickname, teamId, playerId }, ack) => {
    if (!nickname || !String(nickname).trim()) return ack?.({ ok: false, error: "Nickname is required." });
    if (!TEAM_IDS.includes(teamId)) return ack?.({ ok: false, error: "Invalid team." });

    // Reconnect existing player by ID
    if (playerId && state.players[playerId]) {
      const p = state.players[playerId];
      p.nickname = String(nickname).trim().slice(0, 24);
      p.socketId = socket.id;
      emitState();
      return ack?.({ ok: true, player: p });
    }

    // Prevent duplicate: if this socket already owns a player, return that player
    const existingBySocket = Object.values(state.players).find((p) => p.socketId === socket.id);
    if (existingBySocket) {
      return ack?.({ ok: true, player: existingBySocket });
    }

    const id = nanoid(10);
    const p = { id, nickname: String(nickname).trim().slice(0, 24), teamId, socketId: socket.id, avatarKey: null };
    state.players[id] = p;
    emitState();
    ack?.({ ok: true, player: p });
  });

  socket.on("player:resume", ({ playerId }, ack) => {
    const p = state.players[playerId];
    if (!p) return ack?.({ ok: false });
    p.socketId = socket.id;
    ack?.({ ok: true, player: p });
    emitState();
  });

  socket.on("bid:submit", ({ playerId, value }, ack) => {
    const p = state.players[playerId];
    if (!p) return ack?.({ ok: false, error: "Player not found." });
    if (state.mode !== "question") return ack?.({ ok: false, error: "Not a question round." });
    if (!state.round.biddingOpen || state.round.bidsLocked) return ack?.({ ok: false, error: "Bidding is closed." });

    const normalizedBid = bidValue(value);
    if (!isBidAvailableForCurrentCategory(normalizedBid)) return ack?.({ ok: false, error: "This bid is not available." });
    const elapsedMs = state.timers.startedAt ? Date.now() - state.timers.startedAt : 0;
    const historyEntry = {
      id: nanoid(8),
      playerId: p.id,
      teamId: p.teamId,
      bidderName: p.nickname,
      bidderAvatarKey: p.avatarKey || null,
      bid: normalizedBid,
      elapsedMs,
      createdAt: Date.now(),
      isCurrentForTeam: true
    };

    state.round.bidHistory = state.round.bidHistory.map((entry) =>
      entry.teamId === p.teamId ? { ...entry, isCurrentForTeam: false } : entry
    );
    state.round.bidHistory.push(historyEntry);
    state.round.bids[p.teamId] = {
      bid: normalizedBid,
      elapsedMs,
      playerId: p.id,
      bidderName: p.nickname,
      bidderAvatarKey: p.avatarKey || null
    };

    emitState();
    ack?.({ ok: true, bid: normalizedBid, elapsedMs, entry: historyEntry });
  });

  socket.on("player:submitAnswer", ({ playerId, answer }, ack) => {
    const p = state.players[playerId];
    if (!p) return ack?.({ ok: false, error: "Player not found." });
    if (!["question", "activity-live"].includes(state.phase)) return ack?.({ ok: false, error: "Answers are not open." });
    // Block answers after timer has expired
    if (state.timers.activeType === "question" && !state.timers.running && state.timers.hasStartedOnce && state.timers.remaining <= 0) {
      return ack?.({ ok: false, error: "Time is up!" });
    }
    const text = String(answer || "").trim().slice(0, 500);
    if (!text) return ack?.({ ok: false, error: "Answer cannot be empty." });
    const elapsedMs = state.timers.startedAt ? Date.now() - state.timers.startedAt : 0;
    state.round.playerAnswers.push({
      id: nanoid(8),
      playerId: p.id,
      nickname: p.nickname,
      teamId: p.teamId,
      avatarKey: p.avatarKey || null,
      answer: text,
      elapsedMs,
      createdAt: Date.now()
    });
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:startQuestionRound", (_p, ack) => {
    prepareNextQuestionRound();
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:startActivityRound", ({ title, notes, activityType }, ack) => {
    prepareActivityRound(title, notes, activityType);
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:openBidding", (_p, ack) => {
    if (state.mode !== "question") return ack?.({ ok: false, error: "Not a question round." });
    state.round = {
      ...initialRoundState(),
      scoring: state.round.scoring
    };
    state.round.biddingOpen = true;
    state.phase = "bidding";
    startTimer("bidding", state.timers.biddingSeconds);
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:revealBids", (_p, ack) => {
    revealBidsInternal();
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:revealQuestion", (_p, ack) => {
    if (state.mode === "activity") {
      state.phase = "activity-live";
      startTimer("question", state.timers.questionSeconds);
      emitState();
      return ack?.({ ok: true });
    }

    // Use already-selected question (from bids-revealed or turn-mode pick)
    let picked = state.selectedQuestion;

    if (!picked) {
      // Fallback: pick from bids (bidding mode, question not yet selected)
      const top = highestBid();
      if (!top) return ack?.({ ok: false, error: "No bids yet." });
      picked = chooseQuestion(state.currentCategory, top.bid);
      if (!picked) return ack?.({ ok: false, error: "No remaining question in this category." });
      state.selectedQuestion = picked;
      state.usedQuestionIds.push(picked.id);
      state.round.winningBid = top.bid;
      state.round.winningTeamId = top.teamId;
    }

    state.round.activeBidTeamIndex = 0;
    state.round.scoring = {
      resolved: false,
      awardedTeamId: null,
      awardedPoints: 0,
      wasCorrect: null
    };
    state.round.lastAction = null;
    state.round.actionSerial += 1;
    state.phase = "question";
    setTimerReady("question", state.timers.questionSeconds);
    if (!picked.questionAudio) startTimer("question", state.timers.questionSeconds);
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:revealAnswer", (_p, ack) => {
    state.phase = state.mode === "activity" ? "activity-answer" : "answer";
    resetTimer();
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:setEstimationQuestions", ({ questions, timerSeconds, prizePools }, ack) => {
    if (Array.isArray(questions)) {
      state.estimation.questions = questions.map((q) => ({ prompt: String(q.prompt || ""), answer: Number(q.answer) || 0 }));
    }
    if (timerSeconds) state.estimation.timerSeconds = Math.max(5, Math.min(300, Number(timerSeconds) || 30));
    if (prizePools) {
      state.estimation.prizePools = {
        first: Number(prizePools.first) ?? 30,
        second: Number(prizePools.second) ?? 20,
        third: Number(prizePools.third) ?? 10
      };
    }
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:activityPrev", (_p, ack) => {
    if (state.mode !== "activity") return ack?.({ ok: false, error: "Not an activity." });
    const p = state.phase;
    if (p === "activity-instructions") {
      state.phase = "activity-title";
    } else if (p === "activity-live") {
      resetTimer();
      const idx = state.estimation.currentIndex;
      if (idx > 0) {
        // Go back to previous question — remove submissions for current, revert index
        delete state.estimation.submissions[idx];
        state.estimation.currentIndex = idx - 1;
        // Remove the round result for previous question if it was already scored
        // (shouldn't be since we're still live, but safety)
        state.phase = "activity-live";
        const q = state.estimation.questions[idx - 1];
        startTimer("question", q?.timeLimit || state.estimation.timerSeconds);
      } else {
        // First question — go back to instructions
        delete state.estimation.submissions[0];
        state.estimation.currentIndex = -1;
        state.phase = "activity-instructions";
      }
    } else if (p === "activity-round-result") {
      const curResult = state.estimation.currentResultIndex ?? 0;
      if (curResult > 0) {
        state.estimation.currentResultIndex = curResult - 1;
      } else {
        // At first result — go back to the last live question
        // Remove the last round result so it can be re-scored
        state.estimation.roundResults.pop();
        computeEstimationTeamScores();
        const lastIdx = state.estimation.questions.length - 1;
        state.estimation.currentIndex = lastIdx;
        state.estimation.submissions[lastIdx] = state.estimation.submissions[lastIdx] || {};
        state.phase = "activity-live";
        const q = state.estimation.questions[lastIdx];
        startTimer("question", q?.timeLimit || state.estimation.timerSeconds);
      }
    } else if (p === "activity-final") {
      // Go back to the last round result
      const lastResult = state.estimation.roundResults.length - 1;
      state.estimation.currentResultIndex = Math.max(0, lastResult);
      state.phase = "activity-round-result";
    } else {
      return ack?.({ ok: false, error: "Cannot go back from this phase." });
    }
    emitState();
    ack?.({ ok: true, phase: state.phase });
  });

  socket.on("host:activityNext", (_p, ack) => {
    if (state.mode !== "activity") return ack?.({ ok: false, error: "Not an activity." });
    const p = state.phase;
    if (p === "activity-title") {
      state.phase = "activity-instructions";
    } else if (p === "activity-instructions") {
      state.estimation.currentIndex = 0;
      state.estimation.submissions[0] = {};
      state.phase = "activity-live";
      const q = state.estimation.questions[0];
      startTimer("question", q?.timeLimit || state.estimation.timerSeconds);
    } else if (p === "activity-live") {
      resetTimer();
      // Score current round
      const idx = state.estimation.currentIndex;
      const results = scoreEstimationRound(idx);
      const q = state.estimation.questions[idx];
      state.estimation.roundResults.push({ questionIndex: idx, answer: q?.answer ?? 0, prompt: q?.prompt ?? "", results, closeTol: q?.closeTol, midTol: q?.midTol, farTol: q?.farTol });
      computeEstimationTeamScores();
      // Store cumulative score snapshot on each round result
      for (let ri = 0; ri < state.estimation.roundResults.length; ri++) {
        const cumulativeScores = { A: 0, B: 0, C: 0 };
        for (let rj = 0; rj <= ri; rj++) {
          const rr = state.estimation.roundResults[rj];
          if (state.estimation.type === "estimation-2") {
            if (rr.teamAvgs) {
              for (const [tid, info] of Object.entries(rr.teamAvgs)) {
                cumulativeScores[tid] = (cumulativeScores[tid] || 0) + (info.pts || 0);
              }
            }
          } else {
            const teamGroups = {};
            for (const r of rr.results) {
              if (!teamGroups[r.teamId]) teamGroups[r.teamId] = [];
              teamGroups[r.teamId].push(r.points);
            }
            for (const [tid, pts] of Object.entries(teamGroups)) {
              const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
              cumulativeScores[tid] = (cumulativeScores[tid] || 0) + Math.round(avg * 100) / 100;
            }
          }
        }
        state.estimation.roundResults[ri].cumulativeTeamScores = cumulativeScores;
      }
      // Move to next question or start results review
      const nextIdx = idx + 1;
      if (nextIdx < state.estimation.questions.length) {
        state.estimation.currentIndex = nextIdx;
        state.estimation.submissions[nextIdx] = {};
        state.phase = "activity-live";
        const nq = state.estimation.questions[nextIdx];
        startTimer("question", nq?.timeLimit || state.estimation.timerSeconds);
      } else {
        // All questions done, show first result
        state.estimation.currentResultIndex = 0;
        state.phase = "activity-round-result";
      }
    } else if (p === "activity-round-result") {
      const nextResult = (state.estimation.currentResultIndex ?? 0) + 1;
      if (nextResult < state.estimation.roundResults.length) {
        state.estimation.currentResultIndex = nextResult;
        state.phase = "activity-round-result";
      } else {
        state.phase = "activity-final";
      }
    } else if (p === "activity-final") {
      const pp = state.estimation.prizePools;
      const sorted = Object.entries(state.estimation.teamScores).sort((a, b) => b[1] - a[1]);
      const prizes = [pp.first, pp.second, pp.third];
      sorted.forEach(([tid], i) => {
        if (state.teams[tid] && prizes[i]) state.teams[tid].score += prizes[i];
      });
      state.phase = "lobby";
      state.mode = "question";
    }
    emitState();
    ack?.({ ok: true, phase: state.phase });
  });

  socket.on("player:submitEstimation", ({ playerId, value }, ack) => {
    const pl = state.players[playerId];
    if (!pl) return ack?.({ ok: false, error: "Player not found." });
    if (state.phase !== "activity-live") return ack?.({ ok: false, error: "Not accepting estimations." });
    if (state.timers.activeType === "question" && !state.timers.running && state.timers.hasStartedOnce && (state.timers.remaining ?? 1) <= 0) {
      return ack?.({ ok: false, error: "Time is up!" });
    }
    const idx = state.estimation.currentIndex;
    if (!state.estimation.submissions[idx]) state.estimation.submissions[idx] = {};
    state.estimation.submissions[idx][playerId] = Number(value) || 0;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:resolveQuestion", ({ awardedTeamId, correct, action, rewardPoints, penaltyPoints }, ack) => {
    if (state.mode !== "question") return ack?.({ ok: false, error: "Not a question round." });
    if (!state.selectedQuestion) return ack?.({ ok: false, error: "No active question." });
    if (!["question", "answer"].includes(state.phase)) return ack?.({ ok: false, error: "Question is not active." });

    const ranked = rankingBids();
    const activeResponder = ranked[state.round.activeBidTeamIndex || 0] || null;
    const teamId = activeResponder?.teamId || awardedTeamId || state.round.winningTeamId;
    const normalizedAction = action || (correct ? "correct" : "wrong");
    const reward = Math.max(0, Number(rewardPoints) || 10);
    const penalty = Number.isFinite(Number(penaltyPoints)) ? Number(penaltyPoints) : -5;

    if (normalizedAction === "pass" || normalizedAction === "wrong") {
      if (normalizedAction === "wrong" && teamId && state.teams[teamId]) {
        state.teams[teamId].score += penalty;
      }

      const nextIndex = (state.round.activeBidTeamIndex || 0) + 1;
      const hasNext = nextIndex < ranked.length;
      state.round.scoring = {
        resolved: false,
        awardedTeamId: normalizedAction === "wrong" ? teamId || null : null,
        awardedPoints: normalizedAction === "wrong" ? penalty : 0,
        wasCorrect: false
      };
      state.round.lastAction = normalizedAction;
      state.round.actionSerial += 1;
      if (hasNext) {
        state.round.activeBidTeamIndex = nextIndex;
      } else if (state.gameMode === "turn") {
        // All teams exhausted in turn mode — advance turn
        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      }
      emitState();
      return ack?.({ ok: true, points: normalizedAction === "wrong" ? penalty : 0, awardedTeamId: normalizedAction === "wrong" ? teamId || null : null, action: normalizedAction, nextTeamId: hasNext ? ranked[nextIndex].teamId : null });
    }

    const points = reward;
    if (teamId && state.teams[teamId]) {
      state.teams[teamId].score += points;
    }

    state.round.scoring = {
      resolved: true,
      awardedTeamId: teamId || null,
      awardedPoints: points,
      wasCorrect: true
    };
    state.round.lastAction = "correct";
    state.round.actionSerial += 1;

    // Auto-reveal answer on correct
    state.phase = state.mode === "activity" ? "activity-answer" : "answer";
    resetTimer();

    // Auto-advance turn in turn mode
    if (state.gameMode === "turn") {
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
    }

    emitState();
    ack?.({ ok: true, points, awardedTeamId: teamId || null, action: "correct" });
  });

  socket.on("host:setTimers", ({ biddingSeconds, questionSeconds }, ack) => {
    state.timers.biddingSeconds = Math.max(5, Math.min(300, Number(biddingSeconds) || 20));
    state.timers.questionSeconds = Math.max(5, Math.min(300, Number(questionSeconds) || 25));
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:award", ({ teamId, delta }, ack) => {
    if (!TEAM_IDS.includes(teamId)) return ack?.({ ok: false });
    state.teams[teamId].score += Number(delta) || 0;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:renameTeam", ({ teamId, name }, ack) => {
    if (!TEAM_IDS.includes(teamId)) return ack?.({ ok: false });
    state.teams[teamId].name = String(name || state.teams[teamId].name).slice(0, 28);
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:movePlayer", ({ playerId, teamId }, ack) => {
    const p = state.players[playerId];
    if (!p || !TEAM_IDS.includes(teamId)) return ack?.({ ok: false });
    p.teamId = teamId;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:toggleQuestionAvailability", ({ category, level }, ack) => {
    const key = questionKey(category, level);
    const matchingIds = questions.filter((q) => q.category === category && Number(q.level) === Number(level)).map((q) => q.id);
    const hasUsed = matchingIds.some((id) => state.usedQuestionIds.includes(id));

    if (hasUsed) {
      state.usedQuestionIds = state.usedQuestionIds.filter((id) => !matchingIds.includes(id));
      delete state.manuallyDisabledQuestions[key];
      emitState();
      return ack?.({ ok: true, disabled: false, restored: true });
    }

    if (state.manuallyDisabledQuestions[key]) delete state.manuallyDisabledQuestions[key];
    else state.manuallyDisabledQuestions[key] = true;
    emitState();
    ack?.({ ok: true, disabled: Boolean(state.manuallyDisabledQuestions[key]) });
  });


  socket.on("host:controlMedia", ({ side, command, mediaType }, ack) => {
    if (!state.selectedQuestion) return ack?.({ ok: false, error: "No active question." });
    const normalizedSide = side === "answer" ? "answer" : "question";
    const normalizedType = mediaType === "video" ? "video" : "audio";
    let src = null;
    if (normalizedType === "video") {
      src = normalizedSide === "answer" ? state.selectedQuestion.answerVideo : state.selectedQuestion.questionVideo;
    } else {
      src = normalizedSide === "answer" ? state.selectedQuestion.answerAudio : state.selectedQuestion.questionAudio;
    }
    state.mediaControl = {
      serial: (state.mediaControl?.serial || 0) + 1,
      command: command || "play",
      side: normalizedSide,
      mediaType: normalizedType,
      src: src || null
    };
    emitState();
    ack?.({ ok: true, src: src || null });
  });

  socket.on("display:mediaEnded", ({ serial, side }, ack) => {
    if ((state.mediaControl?.serial || 0) !== serial) return ack?.({ ok: false });
    if (
      state.phase === "question" &&
      side === "question" &&
      state.selectedQuestion?.questionAudio &&
      !state.timers.hasStartedOnce
    ) {
      startTimer("question", Number(state.timers.remaining ?? state.timers.questionSeconds) || state.timers.questionSeconds);
      emitState();
    }
    ack?.({ ok: true });
  });

  socket.on("host:toggleImageMaximize", (_p, ack) => {
    state.imageMaximized = !state.imageMaximized;
    emitState();
    ack?.({ ok: true, maximized: state.imageMaximized });
  });

  socket.on("host:setGameMode", ({ gameMode }, ack) => {
    if (!["bidding", "turn"].includes(gameMode)) return ack?.({ ok: false, error: "Invalid mode." });
    state.gameMode = gameMode;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:setTurnOrder", ({ turnOrder }, ack) => {
    if (!Array.isArray(turnOrder) || turnOrder.length !== TEAM_IDS.length) return ack?.({ ok: false, error: "Invalid order." });
    state.turnOrder = turnOrder;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:advanceTurn", (_p, ack) => {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:pickQuestion", ({ category, level }, ack) => {
    if (state.gameMode !== "turn") return ack?.({ ok: false, error: "Not in turn mode." });
    const pool = remainingByCategory(category);
    const picked = pool.find((q) => q.level === Number(level));
    if (!picked) return ack?.({ ok: false, error: "Question not available." });

    const currentTeamId = state.turnOrder[state.currentTurnIndex] || "A";
    state.selectedQuestion = picked;
    state.usedQuestionIds.push(picked.id);
    state.currentCategory = category;
    state.round.winningBid = picked.level;
    state.round.winningTeamId = currentTeamId;
    state.round.activeBidTeamIndex = 0;
    // Add all teams in turn order starting from the picking team so pass/wrong cycles through
    const orderedTeams = [];
    for (let i = 0; i < state.turnOrder.length; i++) {
      orderedTeams.push(state.turnOrder[(state.currentTurnIndex + i) % state.turnOrder.length]);
    }
    orderedTeams.forEach((tid, idx) => {
      state.round.bids[tid] = {
        bid: picked.level - idx,
        elapsedMs: idx * 1000,
        playerId: null,
        bidderName: state.teams[tid].name,
        bidderAvatarKey: null
      };
    });
    state.round.bidsRevealed = true;
    state.mode = "question";
    state.phase = "bids-revealed";
    emitState();
    ack?.({ ok: true, question: picked.question });
  });

  socket.on("host:resetActiveTimer", (_p, ack) => {
    if (state.phase === "bidding") {
      startTimer("bidding", state.timers.biddingSeconds);
      emitState();
      return ack?.({ ok: true });
    }
    if (state.phase === "question") {
      setTimerReady("question", state.timers.questionSeconds);
      emitState();
      return ack?.({ ok: true });
    }
    ack?.({ ok: false, error: "No active timer." });
  });

  socket.on("host:toggleQuestionTimer", (_p, ack) => {
    if (state.phase !== "question") return ack?.({ ok: false, error: "Question timer unavailable." });
    if (!state.timers.activeType) {
      setTimerReady("question", state.timers.questionSeconds);
    }
    if (state.timers.running) {
      pauseTimer();
      emitState();
      return ack?.({ ok: true, running: false, remaining: state.timers.remaining });
    }
    // Host explicitly starting timer overrides audio-wait
    state.timers.hasStartedOnce = true;
    resumeTimer();
    emitState();
    ack?.({ ok: true, running: true, remaining: state.timers.remaining });
  });

  socket.on("host:setAvatar", ({ playerId, avatarKey }, ack) => {
    const p = state.players[playerId];
    if (!p) return ack?.({ ok: false });
    p.avatarKey = avatarKey || null;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:kickPlayer", ({ playerId }, ack) => {
    const p = state.players[playerId];
    if (!p) return ack?.({ ok: false, error: "Player not found." });
    // Notify the kicked player's socket before removing
    if (p.socketId) {
      const kickedSocket = io.sockets.sockets.get(p.socketId);
      if (kickedSocket) kickedSocket.emit("kicked");
    }
    delete state.players[playerId];
    emitState();
    ack?.({ ok: true });
  });

  socket.on("host:resetGame", (_p, ack) => {
    state = initialState();
    categoryCursor = -1;
    blindCursor = -1;
    emitState();
    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    Object.values(state.players).forEach((p) => {
      if (p.socketId === socket.id) p.socketId = null;
    });
    emitState();
  });
});

// Serve client build in production (after `npm run build` in client/)
const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  console.log("Serving client from", clientDist);
}

server.listen(PORT, () => console.log(`Trivia server running on http://localhost:${PORT}`));
