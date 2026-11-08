import { startCamera } from "./camera.js";
import { handSvg } from "./hands.js";
import { LETTERS } from "./classify.js";

const HOLD_MS = 650;
const ARM_MS = 400;

const gate = document.querySelector("#gate");
const shell = document.querySelector("#shell");
const nameForm = document.querySelector("#nameForm");
const nameInput = document.querySelector("#nameInput");
const gateError = document.querySelector("#gateError");
const recentPlayers = document.querySelector("#recentPlayers");
const playerName = document.querySelector("#playerName");
const boardStatus = document.querySelector("#boardStatus");
const video = document.querySelector("#video");
const overlay = document.querySelector("#overlay");
const seen = document.querySelector("#seen");
const meter = document.querySelector("#meter");
const cameraError = document.querySelector("#cameraError");
const prompt = document.querySelector("#prompt");
const letterEl = document.querySelector("#letter");
const diagram = document.querySelector("#diagram");
const feedback = document.querySelector("#feedback");
const oledLetter = document.querySelector("#oledLetter");
const oledBanner = document.querySelector("#oledBanner");
const lampGreen = document.querySelector("#lampGreen");
const lampRed = document.querySelector("#lampRed");
const scoreLine = document.querySelector("#scoreLine");
const stats = document.querySelector("#stats");
const learnMode = document.querySelector("#learnMode");
const recallMode = document.querySelector("#recallMode");

const state = {
  player: null,
  mode: "learn",
  round: null,
  pose: { reason: "no-hand", label: "unknown", confidence: 0 },
  holdLabel: null,
  holdSince: 0,
  sending: false,
  nextTimer: 0,
  cameraStarted: false,
};

function loadPlayer() {
  try {
    return JSON.parse(localStorage.getItem("givemeasign.player") || "null");
  } catch {
    return null;
  }
}

function savePlayer(player) {
  localStorage.setItem("givemeasign.player", JSON.stringify(player));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    const message = typeof detail === "string" ? detail : "That didn't go through.";
    throw new Error(message);
  }
  return body;
}

function setLamps(status) {
  lampGreen.classList.toggle("on", status === "correct");
  lampRed.classList.toggle("on", status === "wrong");
  oledBanner.textContent = status === "correct" ? "CORRECT" : status === "wrong" ? "TRY AGAIN" : "";
}

function renderStats(data) {
  if (!data) return;
  if (data.attempts === 0) {
    scoreLine.textContent = "No scored rounds yet";
  } else {
    scoreLine.textContent = `${data.correct} of ${data.attempts} correct`;
  }
  stats.replaceChildren();
  for (const letter of LETTERS) {
    const row = data.by_letter[letter] || { attempts: 0, correct: 0 };
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = letter;
    const track = document.createElement("span");
    track.className = "bar";
    const fill = document.createElement("span");
    const ratio = row.attempts ? row.correct / row.attempts : 0;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    track.append(fill);
    const count = document.createElement("span");
    count.textContent = row.attempts ? `${row.correct}/${row.attempts}` : "–";
    item.append(name, track, count);
    stats.append(item);
  }
}

function renderRound() {
  const round = state.round;
  learnMode.setAttribute("aria-pressed", String(state.mode === "learn"));
  recallMode.setAttribute("aria-pressed", String(state.mode === "recall"));
  if (!round) {
    letterEl.textContent = "–";
    oledLetter.textContent = "–";
    diagram.replaceChildren();
    feedback.textContent = "";
    setLamps("waiting");
    return;
  }
  letterEl.textContent = round.letter;
  oledLetter.textContent = round.letter;
  prompt.textContent = state.mode === "learn" ? "Match this sign" : "Sign this letter from memory";
  const reveal = state.mode === "learn" || round.status !== "waiting";
  diagram.innerHTML = reveal ? handSvg(round.letter) : "";
  diagram.classList.toggle("empty", !reveal);
  if (!reveal) diagram.textContent = "The diagram stays hidden until you try.";
  if (round.status === "correct") {
    feedback.textContent = "That's right.";
  } else if (round.status === "wrong") {
    feedback.textContent = `That was ${round.guess}. Here's ${round.letter}.`;
  } else {
    feedback.textContent = "";
  }
  setLamps(round.status);
}

function renderSeen() {
  const pose = state.pose;
  if (cameraError.textContent) return;
  if (pose.reason === "no-hand") {
    seen.textContent = "Show your hand to the camera.";
    return;
  }
  if (pose.reason !== "letter") {
    seen.textContent = "Not a letter yet. Hold a clear sign.";
    return;
  }
  seen.textContent = `Holding ${pose.label}`;
}

async function refreshStats() {
  if (!state.player) return;
  const data = await api(`/api/players/${state.player.id}/stats`);
  renderStats(data);
}

async function refreshBoard() {
  try {
    const body = await api("/api/board");
    boardStatus.textContent = body.linked ? "Board linked" : "On-screen console";
    boardStatus.classList.toggle("linked", body.linked);
  } catch {
    boardStatus.textContent = "On-screen console";
    boardStatus.classList.remove("linked");
  }
}

async function startRound() {
  if (!state.player) return;
  clearTimeout(state.nextTimer);
  state.sending = false;
  state.holdLabel = null;
  state.holdSince = 0;
  meter.style.width = "0%";
  const round = await api("/api/rounds", {
    method: "POST",
    body: JSON.stringify({ player_id: state.player.id, mode: state.mode }),
  });
  round.armedAt = performance.now();
  state.round = round;
  renderRound();
  refreshBoard();
}

async function commit(pose) {
  if (!state.round || state.round.status !== "waiting" || state.sending) return;
  state.sending = true;
  const roundId = state.round.id;
  try {
    const result = await api(`/api/rounds/${roundId}/attempt`, {
      method: "POST",
      body: JSON.stringify({ label: pose.label, confidence: pose.confidence }),
    });
    if (!state.round || state.round.id !== roundId) return;
    if (result.status === "waiting") {
      state.holdSince = performance.now();
      return;
    }
    state.round = { ...state.round, ...result, armedAt: state.round.armedAt };
    renderRound();
    await refreshStats();
    state.nextTimer = setTimeout(() => {
      startRound().catch((error) => {
        feedback.textContent = error.message;
      });
    }, 1700);
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    state.sending = false;
  }
}

function onPose(pose) {
  state.pose = pose;
  renderSeen();
  const round = state.round;
  if (!round || round.status !== "waiting" || state.sending) {
    if (!round || round.status !== "waiting") meter.style.width = "0%";
    return;
  }
  if (performance.now() - round.armedAt < ARM_MS || pose.reason !== "letter") {
    state.holdLabel = null;
    meter.style.width = "0%";
    return;
  }
  if (state.holdLabel !== pose.label) {
    state.holdLabel = pose.label;
    state.holdSince = performance.now();
  }
  const elapsed = performance.now() - state.holdSince;
  meter.style.width = `${Math.min(100, (elapsed / HOLD_MS) * 100)}%`;
  if (elapsed >= HOLD_MS) commit(pose);
}

async function ensureCamera() {
  if (state.cameraStarted) return;
  state.cameraStarted = true;
  try {
    await startCamera({ video, canvas: overlay, onPose });
  } catch (error) {
    state.cameraStarted = false;
    cameraError.textContent =
      "The camera is blocked. Allow it for this page, then switch player and come back in.";
    seen.textContent = error.message || "Camera unavailable.";
  }
}

async function enter(player) {
  state.player = player;
  savePlayer(player);
  playerName.textContent = player.name;
  gate.hidden = true;
  shell.hidden = false;
  gateError.textContent = "";
  await ensureCamera();
  await refreshStats();
  await startRound();
}

async function showGate() {
  clearTimeout(state.nextTimer);
  state.round = null;
  shell.hidden = true;
  gate.hidden = false;
  nameInput.focus();
  try {
    const body = await api("/api/players");
    recentPlayers.replaceChildren();
    for (const player of body.players) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = player.name;
      button.addEventListener("click", () => {
        enter(player).catch((error) => {
          gateError.textContent = error.message;
        });
      });
      recentPlayers.append(button);
    }
  } catch {
    recentPlayers.replaceChildren();
  }
}

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  gateError.textContent = "";
  api("/api/players", {
    method: "POST",
    body: JSON.stringify({ name: nameInput.value }),
  })
    .then(enter)
    .catch((error) => {
      gateError.textContent = error.message;
    });
});

document.querySelector("#switchPlayer").addEventListener("click", () => {
  showGate();
});

function chooseMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  startRound().catch((error) => {
    feedback.textContent = error.message;
  });
}

learnMode.addEventListener("click", () => chooseMode("learn"));
recallMode.addEventListener("click", () => chooseMode("recall"));

setInterval(refreshBoard, 3000);

const saved = loadPlayer();
if (saved?.id) {
  api(`/api/players/${saved.id}/stats`)
    .then(() => enter(saved))
    .catch(() => showGate());
} else {
  showGate();
}
