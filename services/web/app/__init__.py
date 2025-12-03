# services/web/app/__init__.py
from flask import Flask
from .routes import bp as main_bp
from .routes_room import bp_room


def create_app():
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(bp_room)

    return app


# For environments that expect `app` at module level (gunicorn, etc.)
app = create_app()
