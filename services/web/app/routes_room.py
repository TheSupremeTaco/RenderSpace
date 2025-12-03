# routes_room.py
from flask import Blueprint, request, jsonify
from .llm_client import call_style_source   # <-- NOTE THE DOT
import uuid

bp_room = Blueprint("room", __name__)


@bp_room.route("/api/room-setup", methods=["POST"])
def room_setup():
    """
    Request JSON:
    {
      "roomType": "bedroom",
      "roomSize": "12x14",  # or "small/medium/large"
      "style": "postmodern"
    }

    Response JSON:
    {
      "project": { ... },
      "moodBoard": {
        "style": "...",
        "products": [ ... ]
      }
    }
    """
    data = request.get_json() or {}

    room_type = (data.get("roomType") or "").strip().lower()
    room_size = (data.get("roomSize") or "").strip()
    style = (data.get("style") or "").strip()

    if not room_type or not style:
        return jsonify({"error": "roomType and style are required"}), 400

    # Combine style + room for a richer query to the agent
    style_query = f"{style} {room_type} furniture"

    # Call LLM style/source agent for 5 pieces
    style_data = call_style_source(style_query, max_items=5)
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
