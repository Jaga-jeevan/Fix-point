import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app


def allowed_file(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def save_upload(file_storage, subfolder=""):
    """
    Saves an uploaded file to UPLOAD_FOLDER/subfolder with a unique name.
    Returns the relative path (e.g. "repairs/uuid.jpg") to store in the DB,
    or None if there was no file.

    Raises ValueError if the file type is not allowed.
    """
    if file_storage is None or file_storage.filename == "":
        return None

    if not allowed_file(file_storage.filename):
        raise ValueError("Only jpg, jpeg and png images are allowed")

    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    safe_name = secure_filename(unique_name)

    target_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], subfolder)
    os.makedirs(target_dir, exist_ok=True)

    absolute_path = os.path.join(target_dir, safe_name)
    file_storage.save(absolute_path)

    relative_path = os.path.join(subfolder, safe_name) if subfolder else safe_name
    return relative_path.replace("\\", "/")
