"""GiveMeASign console service.

On the Uno Q this is the App Lab entry point: it accepts a letter and a
result from the laptop and forwards them to the microcontroller over Bridge.
On a laptop, the same file is a mock console that prints what the OLED and
LEDs would do. Do not run the mock while `adb forward` is using port 8765.
"""

import json
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8765
ON_BOARD = False

try:
    from arduino.app_utils import App, Bridge

    ON_BOARD = True
except ImportError:
    App = None
    Bridge = None

state_lock = threading.Lock()
state = {"letter": "-", "leds": "off"}
commands = queue.Queue()


def apply_local(method, arg):
    with state_lock:
        if method == "show_letter":
            text = (arg or "-").strip().upper()[:1] or "-"
            state["letter"] = text
            state["leds"] = "off"
        elif method == "show_result":
            outcome = (arg or "clear").strip().lower()
            if outcome == "correct":
                state["leds"] = "green"
            elif outcome == "wrong":
                state["leds"] = "red"
            else:
                state["leds"] = "off"
        snapshot = dict(state)
    print(f"[board] {method} {arg} -> {snapshot['letter']} leds={snapshot['leds']}", flush=True)


def user_loop():
    try:
        method, arg, done, box = commands.get(timeout=0.05)
    except queue.Empty:
        return
    try:
        Bridge.call(method, arg)
        apply_local(method, arg)
        box["ok"] = True
    except Exception as exc:
        box["ok"] = False
        box["error"] = str(exc)
        print(f"[board] bridge error: {exc}", flush=True)
    finally:
        done.set()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/health":
            self._send(404, {"ok": False})
            return
        with state_lock:
            snapshot = dict(state)
        self._send(200, {"ok": True, "mode": "board" if ON_BOARD else "mock", **snapshot})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > 2048:
            self._send(413, {"ok": False})
            return
        try:
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            self._send(400, {"ok": False})
            return

        if path == "/prompt":
            method, arg = "show_letter", str(body.get("letter", "-"))
        elif path == "/result":
            method, arg = "show_result", str(body.get("outcome", "clear"))
        else:
            self._send(404, {"ok": False})
            return

        if ON_BOARD:
            done = threading.Event()
            box = {"ok": False}
            commands.put((method, arg, done, box))
            done.wait(2.5)
            self._send(200 if box.get("ok") else 503, {"ok": bool(box.get("ok"))})
            return

        apply_local(method, arg)
        self._send(200, {"ok": True})


def serve():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    where = "Uno Q bridge" if ON_BOARD else "laptop mock"
    print(f"GiveMeASign console ({where}) on port {PORT}", flush=True)
    return server


if ON_BOARD:
    serve()
    App.run(user_loop=user_loop)
elif __name__ == "__main__":
    serve()
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
