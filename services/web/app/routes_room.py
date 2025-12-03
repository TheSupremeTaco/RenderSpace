from flask import Blueprint, request, jsonify
from .llm_client import call_style_source   # note the leading dot
import uuid


bp_room = Blueprint("room", __name__)


@bp_room.route("/api/room-setup", methods=["POST"])
def room_setup():
    data = request.get_json() or {}

    room_type = (data.get("roomType") or "").strip().lower()
    room_size = (data.get("roomSize") or "").strip()
    style = (data.get("style") or "").strip()

    if not room_type or not style:
        return jsonify({"error": "roomType and style are required"}), 400

    style_query = f"{style} {room_type} furniture"

    try:
        style_data = call_style_source(style_query, max_items=5)
    except Exception as e:
        # Log full traceback to Cloud Run logs
        current_app.logger.exception("call_style_source failed")
        # Return readable error to the browser for now
        return jsonify(
            {"error": "style_source_failed", "detail": str(e)}
        ), 500

    products = style_data.get("products", [])

    project_id = str(uuid.uuid4())
    project = {
        "id": project_id,
        "roomType": room_type,
        "roomSize": room_size,
        "style": style,
        "styleQuery": style_query,
    }

    return jsonify(
        {
            "project": project,
            "moodBoard": {
                "style": style_data.get("style", style_query),
                "products": products,
            },
        }
    )