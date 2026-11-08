import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

os.environ["GIVEMEASIGN_DB"] = os.path.join(tempfile.mkdtemp(), "test.sqlite")
os.environ["GIVEMEASIGN_BOARD"] = "http://127.0.0.1:9"

from fastapi.testclient import TestClient

from main import LETTERS, app


class GameTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def player(self, name="Ada"):
        response = self.client.post("/api/players", json={"name": name})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_returning_player_keeps_the_same_id(self):
        first = self.player("Ada")
        second = self.player(" ada ")
        self.assertEqual(first["id"], second["id"])
        self.assertTrue(second["returning"])

    def test_round_scores_once_and_ignores_unknown_poses(self):
        player = self.player("Bea")
        started = self.client.post(
            "/api/rounds", json={"player_id": player["id"], "mode": "learn"}
        )
        self.assertEqual(started.status_code, 200)
        body = started.json()
        self.assertIn(body["letter"], LETTERS)
        self.assertFalse(body["board"])

        waiting = self.client.post(
            f"/api/rounds/{body['id']}/attempt",
            json={"label": "unknown", "confidence": 0.2},
        )
        self.assertEqual(waiting.json()["status"], "waiting")

        wrong = "A" if body["letter"] != "A" else "B"
        missed = self.client.post(
            f"/api/rounds/{body['id']}/attempt",
            json={"label": wrong, "confidence": 0.9},
        )
        self.assertEqual(missed.json()["status"], "wrong")
        again = self.client.post(
            f"/api/rounds/{body['id']}/attempt",
            json={"label": body["letter"], "confidence": 0.99},
        )
        self.assertEqual(again.json()["status"], "wrong")

        stats = self.client.get(f"/api/players/{player['id']}/stats").json()
        self.assertEqual(stats["attempts"], 1)
        self.assertEqual(stats["correct"], 0)
        self.assertEqual(stats["by_letter"][body["letter"]]["attempts"], 1)

    def test_correct_recall_updates_stats(self):
        player = self.player("Cam")
        started = self.client.post(
            "/api/rounds", json={"player_id": player["id"], "mode": "recall"}
        ).json()
        scored = self.client.post(
            f"/api/rounds/{started['id']}/attempt",
            json={"label": started["letter"], "confidence": 0.8},
        ).json()
        self.assertEqual(scored["status"], "correct")
        self.assertEqual(scored["mode"], "recall")
        stats = self.client.get(f"/api/players/{player['id']}/stats").json()
        self.assertEqual(stats["correct"], 1)
        self.assertEqual(stats["by_letter"][started["letter"]]["correct"], 1)

    def test_blank_name_is_rejected(self):
        response = self.client.post("/api/players", json={"name": "   "})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
