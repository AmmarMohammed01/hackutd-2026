"""Local game server for GiveMeASign.

Recognition stays in the browser. This process picks the letter, keeps
player stats, and tells the Uno Q what to show. If the board is unplugged,
the round still runs and the website draws the console itself.
"""

import json
import os
import random
import sqlite3
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

LETTERS = ["A", "B", "C", "D", "F", "I", "L", "V", "W", "Y"]
MODES = {"learn", "recall"}
MIN_CONFIDENCE = 0.62

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("GIVEMEASIGN_DB", ROOT / "server" / "givemeasign.sqlite"))
BOARD_URL = os.environ.get("GIVEMEASIGN_BOARD", "http://127.0.0.1:8765").rstrip("/")
DIST = ROOT / "web" / "dist"

db_lock = threading.Lock()
rounds = {}
last_letter = {}
next_round_id = 1

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=ON")
conn.executescript(
    """
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL,
      last_played_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      target TEXT NOT NULL,
      guess TEXT NOT NULL,
      correct INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
    """
)
conn.commit()

app = FastAPI(title="GiveMeASign")


class NameIn(BaseModel):
    name: str = Field(min_length=1, max_length=24)


class StartIn(BaseModel):
    player_id: int
    mode: str


class AttemptIn(BaseModel):
    label: str = ""
    confidence: float = 0


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def player_dict(row):
    return {"id": row["id"], "name": row["name"]}


def send_board(path, payload):
    data = json.dumps(payload).encode()
    request = urllib.request.Request(
        BOARD_URL + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=0.4) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def board_linked():
    try:
        with urllib.request.urlopen(BOARD_URL + "/health", timeout=0.3) as response:
            if response.status != 200:
                return False
            json.loads(response.read().decode() or "{}")
            return True
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return False


def pick_letter(player_id):
    previous = last_letter.get(player_id)
    choices = [letter for letter in LETTERS if letter != previous] or LETTERS
    choice = random.choice(choices)
    last_letter[player_id] = choice
    return choice


def round_payload(rnd, board):
    return {
        "id": rnd["id"],
        "player_id": rnd["player_id"],
        "mode": rnd["mode"],
        "letter": rnd["letter"],
        "status": rnd["status"],
        "guess": rnd["guess"],
        "board": board,
    }


def require_player(player_id):
    row = conn.execute("SELECT id, name FROM players WHERE id = ?", (player_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="No player with that id.")
    return row


@app.get("/api/health")
def health():
    return {"ok": True, "letters": LETTERS}


@app.get("/api/board")
def board():
    return {"linked": board_linked()}


@app.get("/api/players")
def list_players():
    with db_lock:
        rows = conn.execute(
            "SELECT id, name FROM players ORDER BY last_played_at DESC, name ASC"
        ).fetchall()
    return {"players": [player_dict(row) for row in rows]}


@app.post("/api/players")
def login(body: NameIn):
    name = " ".join(body.name.split())
    if not name:
        raise HTTPException(status_code=400, detail="Enter a name.")
    timestamp = now()
    with db_lock:
        row = conn.execute(
            "SELECT id, name FROM players WHERE name = ? COLLATE NOCASE",
            (name,),
        ).fetchone()
        if row is None:
            cursor = conn.execute(
                "INSERT INTO players (name, created_at, last_played_at) VALUES (?, ?, ?)",
                (name, timestamp, timestamp),
            )
            conn.commit()
            return {"id": cursor.lastrowid, "name": name, "returning": False}
        conn.execute(
            "UPDATE players SET last_played_at = ? WHERE id = ?",
            (timestamp, row["id"]),
        )
        conn.commit()
        return {"id": row["id"], "name": row["name"], "returning": True}


@app.post("/api/rounds")
def start_round(body: StartIn):
    global next_round_id
    if body.mode not in MODES:
        raise HTTPException(status_code=400, detail="Mode must be learn or recall.")
    with db_lock:
        require_player(body.player_id)
        letter = pick_letter(body.player_id)
        round_id = next_round_id
        next_round_id += 1
        rnd = {
            "id": round_id,
            "player_id": body.player_id,
            "mode": body.mode,
            "letter": letter,
            "status": "waiting",
            "guess": None,
        }
        rounds[round_id] = rnd
        conn.execute(
            "UPDATE players SET last_played_at = ? WHERE id = ?",
            (now(), body.player_id),
        )
        conn.commit()
    board = send_board("/prompt", {"letter": letter})
    return round_payload(rnd, board)


@app.post("/api/rounds/{round_id}/attempt")
def attempt(round_id: int, body: AttemptIn):
    outcome = None
    with db_lock:
        rnd = rounds.get(round_id)
        if rnd is None:
            raise HTTPException(status_code=404, detail="That round is gone.")
        if rnd["status"] == "waiting":
            label = body.label.strip().upper()
            confident = label in LETTERS and body.confidence >= MIN_CONFIDENCE
            if not confident:
                waiting = {
                    "id": round_id,
                    "status": "waiting",
                    "letter": rnd["letter"],
                    "guess": None,
                    "mode": rnd["mode"],
                    "player_id": rnd["player_id"],
                    "board": False,
                }
            else:
                waiting = None
                correct = label == rnd["letter"]
                rnd["status"] = "correct" if correct else "wrong"
                rnd["guess"] = label
                outcome = rnd["status"]
                conn.execute(
                    """
                    INSERT INTO attempts (player_id, mode, target, guess, correct, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rnd["player_id"],
                        rnd["mode"],
                        rnd["letter"],
                        label,
                        1 if correct else 0,
                        now(),
                    ),
                )
                conn.commit()
        else:
            waiting = None
        snapshot = dict(rnd)
    if waiting is not None:
        return waiting
    board = send_board("/result", {"outcome": outcome}) if outcome else False
    return round_payload(snapshot, board)


@app.get("/api/players/{player_id}/stats")
def stats(player_id: int):
    with db_lock:
        player = require_player(player_id)
        rows = conn.execute(
            """
            SELECT target, COUNT(*) AS attempts, SUM(correct) AS correct
            FROM attempts
            WHERE player_id = ?
            GROUP BY target
            """,
            (player_id,),
        ).fetchall()
    by_letter = {letter: {"attempts": 0, "correct": 0} for letter in LETTERS}
    total_attempts = 0
    total_correct = 0
    for row in rows:
        attempts = int(row["attempts"])
        correct = int(row["correct"] or 0)
        total_attempts += attempts
        total_correct += correct
        if row["target"] in by_letter:
            by_letter[row["target"]] = {"attempts": attempts, "correct": correct}
    return {
        "player": player_dict(player),
        "attempts": total_attempts,
        "correct": total_correct,
        "by_letter": by_letter,
    }


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="site")
