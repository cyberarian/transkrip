"""Loopback-only pyannote.audio Community-1 diarization sidecar."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import tempfile

MAX_AUDIO_BYTES = 250 * 1024 * 1024
MODEL = os.environ.get("TRANSKRIP_DIARIZATION_MODEL", "pyannote/speaker-diarization-community-1")


def load_pipeline():
    from pyannote.audio import Pipeline
    token = os.environ.get("HF_TOKEN")
    return Pipeline.from_pretrained(MODEL, token=token)


PIPELINE = load_pipeline()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Never place paths, headers, tokens, or audio-derived content in logs.
        print(json.dumps({"event": "diarization_request", "status": args[1]}))

    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        body = b'{"status":"ready"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/diarize" or self.headers.get_content_type() != "audio/wav":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length < 44 or length > MAX_AUDIO_BYTES:
            self.send_error(413)
            return
        with tempfile.NamedTemporaryFile(suffix=".wav") as audio:
            remaining = length
            while remaining:
                chunk = self.rfile.read(min(1024 * 1024, remaining))
                if not chunk:
                    self.send_error(400)
                    return
                audio.write(chunk)
                remaining -= len(chunk)
            audio.flush()
            result = PIPELINE(audio.name)
            track = result.exclusive_speaker_diarization
            turns = [{"start": round(turn.start, 3), "end": round(turn.end, 3), "speaker": speaker}
                     for turn, _, speaker in track.itertracks(yield_label=True)]
        body = json.dumps({"turns": turns}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
