import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate  # type: ignore
from flask_jwt_extended import JWTManager
from flask_cors import CORS  # type: ignore

from config import Config

from flask_sqlalchemy.model import Model

class BaseModel(Model):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

db = SQLAlchemy(model_class=BaseModel)
migrate = Migrate()
jwt = JWTManager()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)

    with app.app_context():
        try:
            from sqlalchemy import text
            with db.engine.begin() as conn:
                conn.execute(text("""
                    ALTER TABLE quotations 
                    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID' NOT NULL,
                    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS utr VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS verified_by_id INTEGER REFERENCES users(id),
                    ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0 NOT NULL,
                    ADD COLUMN IF NOT EXISTS revision_reason VARCHAR(150),
                    ADD COLUMN IF NOT EXISTS revision_message TEXT,
                    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

                    CREATE TABLE IF NOT EXISTS quotation_histories (
                        id SERIAL PRIMARY KEY,
                        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
                        version INTEGER NOT NULL DEFAULT 1,
                        diagnosis TEXT,
                        labour_cost NUMERIC(10, 2) DEFAULT 0 NOT NULL,
                        discount NUMERIC(10, 2) DEFAULT 0 NOT NULL,
                        total_amount NUMERIC(10, 2) DEFAULT 0 NOT NULL,
                        items_json TEXT,
                        revision_reason VARCHAR(150),
                        revision_message TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """))
        except Exception as e:
            print(f"[DB Migration Note] {e}")

    from app.models import (  # noqa: F401
        user,
        technician,
        device,
        repair_request,
        assignment,
        repair_photo,
        status_history,
        message,
        quotation,
        notification,
        part,
        repair_action,
    )

    from app.routes.auth import auth_bp
    from app.routes.customer import customer_bp
    from app.routes.technician import technician_bp
    from app.routes.admin import admin_bp
    from app.routes.chat import chat_bp
    from app.routes.quotation import quotation_bp
    from app.routes.notifications import notifications_bp
    from app.routes.parts import parts_bp
    from app.routes.repair_actions import repair_actions_bp
    from app.routes.voice import voice_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(customer_bp, url_prefix="/api/customer")
    app.register_blueprint(technician_bp, url_prefix="/api/technician")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    # These four are shared between customer + technician (access is
    # enforced per-repair inside each route via app.utils.access), so they
    # sit directly under /api rather than under a single role's prefix.
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(quotation_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(parts_bp, url_prefix="/api")
    app.register_blueprint(repair_actions_bp, url_prefix="/api")
    app.register_blueprint(voice_bp, url_prefix="/api/voice")

    from flask import send_from_directory

    @app.route("/api/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.route("/api/health")
    def health():
        return jsonify({"success": True, "message": "API is running"})

    register_error_handlers(app)
    register_jwt_handlers(jwt)

    return app


def register_jwt_handlers(jwt_manager):
    @jwt_manager.unauthorized_loader
    def missing_token(reason):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    @jwt_manager.invalid_token_loader
    def invalid_token(reason):
        return jsonify({"success": False, "message": "Invalid authentication token"}), 401

    @jwt_manager.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({"success": False, "message": "Session expired, please log in again"}), 401


def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"success": False, "message": "Bad request"}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"success": False, "message": "You are not authorized to perform this action"}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "message": "Resource not found"}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"success": False, "message": "Uploaded file is too large"}), 400

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"success": False, "message": "Internal server error"}), 500
