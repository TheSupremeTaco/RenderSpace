# services/web/app/__init__.py
from flask import Flask
from pathlib import Path

from .routes import bp as main_bp
from .routes_room import bp_room


# /app/app/__init__.py  -> BASE_DIR = /app/app
BASE_DIR = Path(__file__).resolve().parent
# Static is one level up: /app/static
STATIC_DIR = BASE_DIR.parent / "static"


def create_app():
    app = Flask(
        __name__,
        static_folder=str(STATIC_DIR),  # /app/static
        template_folder="templates",    # ok even if empty
    )

    app.register_blueprint(main_bp)
    app.register_blueprint(bp_room)

    return app


app = create_app()
