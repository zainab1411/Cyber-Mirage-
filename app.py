from flask import Flask, render_template, jsonify, request, redirect, session, url_for
import json
import os
ELASTIC_URL = "https://34.239.26.173:64297"
app = Flask(__name__)
app.secret_key = "cybermirage_secret_key_2026"

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "results.json")

USERNAME = "admin"
PASSWORD = "cybermirage2026"

def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

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

if __name__ == "__main__":
    app.run(debug=True, port=5000)