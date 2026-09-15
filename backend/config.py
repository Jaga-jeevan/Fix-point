import os
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


DEV_FALLBACK_SECRET = "fixpoint_dev_jwt_hmac_sha256_secret_key_minimum_32_bytes_long_2026"


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET_KEY") or DEV_FALLBACK_SECRET

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://username:password@localhost:5432/electronic_repair",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_MB", 5)) * 1024 * 1024

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

