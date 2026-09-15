import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User
from app.services.voice_service import VoiceService

voice_bp = Blueprint("voice", __name__)


@voice_bp.route("/process", methods=["POST"])
@jwt_required()
def process_voice_message():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    context = data.get("context") or {}
    history = data.get("history") or []

    result = VoiceService.process_query(user, message, context, history)
    return jsonify(result), 200


@voice_bp.route("/process-audio", methods=["POST"])
@jwt_required()
def process_voice_audio():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    audio_file = request.files.get("audio") or request.files.get("file")
    if not audio_file:
        # Check if raw data was posted
        audio_bytes = request.get_data()
        if not audio_bytes:
            return jsonify({"success": False, "message": "No audio file or data received"}), 400
    else:
        audio_bytes = audio_file.read()

    # Parse context and history from form fields if available
    context_raw = request.form.get("context")
    context = {}
    if context_raw:
        try:
            context = json.loads(context_raw)
        except Exception:
            context = {}

    history_raw = request.form.get("history")
    history = []
    if history_raw:
        try:
            history = json.loads(history_raw)
        except Exception:
            history = []

    language = request.form.get("language", "en-IN")

    result = VoiceService.process_audio(user, audio_bytes, context=context, history=history, language=language)
    return jsonify(result), 200


@voice_bp.route("/transcribe", methods=["POST"])
@jwt_required()
def transcribe_voice_audio():
    audio_file = request.files.get("audio") or request.files.get("file")
    if not audio_file:
        audio_bytes = request.get_data()
        if not audio_bytes:
            return jsonify({"success": False, "message": "No audio file received"}), 400
    else:
        audio_bytes = audio_file.read()

    language = request.form.get("language", "en-IN")
    transcript = VoiceService.transcribe_audio(audio_bytes, language=language)
    return jsonify({"success": True, "transcript": transcript}), 200


@voice_bp.route("/confirm", methods=["POST"])
@jwt_required()
def confirm_voice_action():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    confirmed = data.get("confirmed", True)
    confirmation_data = data.get("confirmation_data") or {}
    context = data.get("context") or {}

    if not confirmed:
        context["pending_action"] = None
        return jsonify({
            "success": True,
            "response": "Action cancelled.",
            "intent": "CANCEL_ACTION",
            "context": context,
        }), 200

    if not confirmation_data:
        return jsonify({"success": False, "message": "No action data provided to confirm"}), 400

    result = VoiceService.execute_confirmed_action(user, confirmation_data, context)
    return jsonify(result), 200


@voice_bp.route("/parse-repair", methods=["POST"])
@jwt_required()
def parse_voice_repair():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    res = VoiceService.parse_repair_paragraph(text, user)
    return jsonify(res), 200


@voice_bp.route("/submit-repair", methods=["POST"])
@jwt_required()
def submit_voice_repair():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    res = VoiceService.submit_voice_repair(user, data)
    status_code = 201 if res.get("success") else 400
    return jsonify(res), status_code

