from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app import db
from app.models.message import Message
from app.utils.access import get_repair_for_current_user
from app.services.notification_service import notify

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/repairs/<int:repair_id>/messages", methods=["GET"])
def list_messages(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False:
        return jsonify({"success": False, "message": "You are not authorized to view this conversation"}), 403

    if not repair.current_assignment:
        return jsonify({"success": True, "messages": []}), 200

    messages = (
        Message.query.filter_by(repair_id=repair.id).order_by(Message.created_at).all()
    )
    return jsonify({"success": True, "messages": [m.to_dict() for m in messages]}), 200


@chat_bp.route("/repairs/<int:repair_id>/messages", methods=["POST"])
def send_message(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False:
        return jsonify({"success": False, "message": "You are not authorized to message on this repair"}), 403

    assignment = repair.current_assignment
    if not assignment:
        return jsonify({
            "success": False,
            "message": "Chat opens once a technician has been assigned to this repair.",
        }), 400

    data = request.get_json(silent=True) or {}
    text = (data.get("message") or "").strip()
    if not text:
        return jsonify({"success": False, "message": "Message cannot be empty"}), 400

    sender_id = int(get_jwt_identity())

    message = Message(repair_id=repair.id, sender_id=sender_id, message=text)
    db.session.add(message)

    # Notify the other participant
    if role == "CUSTOMER":
        recipient_id = assignment.technician.user_id
    else:
        recipient_id = repair.customer_id

    notify(
        user_id=recipient_id,
        title="New message",
        message=f"New message on repair #{repair.id}: \"{text[:60]}\"",
        notif_type="MESSAGE",
        repair_id=repair.id,
    )

    db.session.commit()
    return jsonify({"success": True, "message_obj": message.to_dict()}), 201
