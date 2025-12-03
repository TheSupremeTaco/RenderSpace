# services/web/app/__init__.py
from .routes import app

__all__ = ["app"]
from flask import Flask
from .routes import bp as main_bp

def create_app():
    app = Flask(__name__,
                static_folder="static",
                template_folder="templates")

    app.register_blueprint(main_bp)

    return app