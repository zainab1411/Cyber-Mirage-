from flask import Flask, render_template, jsonify, request, redirect, session, url_for
from collections import deque
from datetime import datetime, timezone, timedelta
from threading import Lock
import json
import os
ELASTIC_URL = "https://127.0.0.1:64298"
app = Flask(__name__)
app.secret_key = "cybermirage_secret_key_2026"

ATTEMPTS = deque(maxlen=50)
ATTEMPTS_LOCK = Lock()
TOTAL_ATTEMPTS = {"count": 0}
LOCAL_TZ = timezone(timedelta(hours=3))

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "results.json")

USERNAME = "admin"
PASSWORD = "cybermirage2026"

def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def mask_ip(ip):
    parts = ip.split(".")
    if len(parts) == 4:
        return ".".join(parts[:3]) + ".xxx"
    return ip[:10] + "..."

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        user = request.form.get("username")
        pw = request.form.get("password")
        if user == USERNAME and pw == PASSWORD:
            session["logged_in"] = True
            return redirect(url_for("dashboard"))
        else:
            error = "اسم المستخدم أو كلمة المرور غير صحيحة"
    return render_template("login.html", error=error)

@app.route("/dashboard")
def dashboard():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("dashboard.html")

@app.route("/logout")
def logout():
    session.pop("logged_in", None)
    return redirect(url_for("login"))

@app.route("/api/data")
def api_data():
    if not session.get("logged_in"):
        return jsonify({"error": "unauthorized"}), 401
    return jsonify(load_data())

@app.route("/portal", methods=["GET", "POST"])
def portal():
    error = False
    if request.method == "POST":
        username = request.form.get("username", "")[:40]
        password = request.form.get("password", "")
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
        ip = ip.split(",")[0].strip()

        with ATTEMPTS_LOCK:
            TOTAL_ATTEMPTS["count"] += 1
            ATTEMPTS.appendleft({
                "time": datetime.now(LOCAL_TZ).strftime("%H:%M:%S"),
                "username": username,
                "password_length": len(password),
                "ip": mask_ip(ip),
            })
        error = True
    return render_template("portal.html", error=error)

@app.route("/api/attempts")
def api_attempts():
    if not session.get("logged_in"):
        return jsonify({"error": "unauthorized"}), 401

    with ATTEMPTS_LOCK:
        return jsonify({
            "total": TOTAL_ATTEMPTS["count"],
            "attempts": list(ATTEMPTS)[:10],
        })
@app.route("/live")
def live():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("live.html")
@app.route("/counter")
def counter():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("counter.html")

if __name__ == "__main__":
    app.run(debug=True, port=5000)