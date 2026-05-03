import json
from http.server import BaseHTTPRequestHandler

from room_analysis import analyze_room


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8"))
            response = analyze_room(payload)
            self.send_json(response, 200)
        except Exception as error:
            self.send_json({"error": str(error)}, 400)

    def do_GET(self):
        self.send_json({"ok": True, "endpoint": "model-room"}, 200)

    def send_json(self, payload, status_code):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
