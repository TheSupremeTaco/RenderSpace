# services/web/app/__init__.py
from flask import Flask
from .routes import bp as main_bp
from .routes_room import bp_room


def create_app():
    app = Flask(
        __name__,
        static_folder="static",      # points to services/web/app/static
        template_folder="templates", # if you use templates anywhere
    )

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(bp_room)

    return app


# Cloud Run / gunicorn expects `app` at package level
app = create_app()
