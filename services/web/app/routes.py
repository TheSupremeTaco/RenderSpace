# services/web/app/routes.py
import os
from flask import Flask, request, jsonify

# static folder is ../static relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/upload", methods=["POST"])
def upload():
    """
    Initial stub: ignore the uploaded file and always return the demo model.
    We'll wire GCS + GPU worker later.
    """
    if "file" not in request.files:
        return jsonify({"error": "no file field"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    # Stub: hard-coded local model path
    demo_model_url = "/static/models/couch_test_gaussian.ply"

    return jsonify({
        "jobId": "demo",
        "modelUrl": demo_model_url,
    })

@app.route("/healthz")
def healthz():
    return "ok", 200
