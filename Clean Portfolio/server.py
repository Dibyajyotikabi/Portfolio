"""Serve the portfolio and its persistent, anonymous visitor counter."""

import argparse
from contextlib import closing
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sqlite3
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
COOKIE = "clean_portfolio_visit"
PUBLIC_TYPES = {".html", ".css", ".js", ".svg", ".jpg", ".png", ".webp", ".ico", ".xml"}


class PortfolioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        if path.is_dir():
            path = path / "index.html"
        if not path.is_relative_to(ROOT) or path.suffix not in PUBLIC_TYPES or not path.is_file():
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        if urlsplit(self.path).path != "/api/visitors":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def visitor_total(self, increment=False):
        with closing(sqlite3.connect(self.server.database, timeout=10)) as db, db:
            if increment:
                db.execute("UPDATE visitors SET total = total + 1 WHERE id = 1")
            return db.execute("SELECT total FROM visitors WHERE id = 1").fetchone()[0]

    def send_json(self, status, payload, visit=False):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if visit:
            self.send_header("Set-Cookie", f"{COOKIE}=1; Path=/; Max-Age=1800; HttpOnly; SameSite=Lax")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path != "/api/visitors":
            return super().do_GET()
        try:
            self.send_json(200, {"total": self.visitor_total()})
        except sqlite3.Error:
            self.send_json(503, {"error": "Visitor count unavailable"})

    def do_POST(self):
        if urlsplit(self.path).path != "/api/visitors":
            return self.send_error(404)
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            return self.send_error(403)
        if self.headers.get_content_type() != "application/json":
            return self.send_error(415)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_error(400)
        if not 0 <= length <= 1024:
            return self.send_error(413)
        self.rfile.read(length)
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except CookieError:
            cookie = SimpleCookie()
        counted = cookie.get(COOKIE)
        try:
            total = self.visitor_total(increment=not counted or counted.value != "1")
            self.send_json(200, {"total": total}, visit=True)
        except sqlite3.Error:
            self.send_json(503, {"error": "Visitor count unavailable"})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    default_db = Path.home() / ".local/share/clean-portfolio/visitors.sqlite3"
    database = Path(os.environ.get("PORTFOLIO_VISITOR_DB", str(default_db))).expanduser().resolve()
    if database.is_relative_to(ROOT):
        parser.error("PORTFOLIO_VISITOR_DB must be outside the public website directory")
    database.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database)) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS visitors (id INTEGER PRIMARY KEY CHECK (id = 1), total INTEGER NOT NULL)")
        db.execute("INSERT OR IGNORE INTO visitors (id, total) VALUES (1, 12000)")
    with ThreadingHTTPServer((args.bind, args.port), PortfolioHandler) as server:
        server.database = database
        print(f"Portfolio running at http://{args.bind}:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
