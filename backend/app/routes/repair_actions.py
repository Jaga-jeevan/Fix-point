from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app import db
from app.models.repair_action import RepairAction
from app.utils.access import get_repair_for_current_user
from app.services.notification_service import notify

repair_actions_bp = Blueprint("repair_actions", __name__)


@repair_actions_bp.route("/repairs/<int:repair_id>/actions", methods=["GET"])
def list_actions(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False:
        return jsonify({"success": False, "message": "You are not authorized to view these repair actions"}), 403

    return jsonify({"success": True, "actions": [a.to_dict() for a in repair.actions]}), 200


@repair_actions_bp.route("/repairs/<int:repair_id>/actions", methods=["POST"])
def add_action(repair_id):
    """Only the assigned technician may log a repair action. Customers are read-only."""
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "TECHNICIAN":
        return jsonify({"success": False, "message": "Only the assigned technician can add repair actions"}), 403

    data = request.get_json(silent=True) or {}
    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"success": False, "message": "description is required"}), 400

    action = RepairAction(
        repair_id=repair.id,
        description=description,
        created_by=int(get_jwt_identity()),
    )
    db.session.add(action)

    notify(
        user_id=repair.customer_id,
        title="Repair action updated",
        message=f"Repair #{repair.id}: {description}",
        notif_type="REPAIR_ACTION",
        repair_id=repair.id,
    )

    db.session.commit()
    return jsonify({"success": True, "action": action.to_dict()}), 201
