from flask import Blueprint, request, jsonify
from flask_jwt_extended import verify_jwt_in_request
from sqlalchemy import update

from app import db
from app.models.part import Part, PartUsed
from app.utils.access import get_repair_for_current_user
from app.utils.decorators import role_required
from app.services.notification_service import notify

parts_bp = Blueprint("parts", __name__)


@parts_bp.route("/parts", methods=["GET"])
@role_required("TECHNICIAN", "ADMIN")
def list_parts():
    """Inventory catalog - available to technicians (to pick from) and admins."""
    parts = Part.query.order_by(Part.name).all()
    return jsonify({"success": True, "parts": [p.to_dict() for p in parts]}), 200


@parts_bp.route("/repairs/<int:repair_id>/parts", methods=["GET"])
def list_parts_used(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False:
        return jsonify({"success": False, "message": "You are not authorized to view these parts"}), 403

    parts_used = [p.to_dict() for p in repair.parts_used]
    total = sum(p["line_total"] for p in parts_used)
    return jsonify({"success": True, "parts_used": parts_used, "total": total}), 200


@parts_bp.route("/repairs/<int:repair_id>/parts", methods=["POST"])
def add_part_used(repair_id):
    """
    Assigned technician logs a part used manually (Part Details, Quantity, Price) or from catalog.
    """
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "TECHNICIAN":
        return jsonify({"success": False, "message": "Only the assigned technician can add parts"}), 403

    data = request.get_json(silent=True) or {}
    part_id = data.get("part_id")
    part_name = (data.get("part_name") or data.get("part_details") or "").strip()
    
    try:
        quantity = int(data.get("quantity", 1))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Quantity must be a valid whole number"}), 400

    try:
        price = float(data.get("price") if data.get("price") is not None else (data.get("unit_price") or 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Price must be a valid number"}), 400

    if quantity <= 0:
        return jsonify({"success": False, "message": "Quantity must be greater than zero"}), 400
    if price < 0:
        return jsonify({"success": False, "message": "Price cannot be negative"}), 400

    if not part_name and not part_id:
        return jsonify({"success": False, "message": "Part Details are required"}), 400

    # 1. Handle manual text input for Part Details
    if part_name:
        part = Part.query.filter(db.func.lower(Part.name) == db.func.lower(part_name)).first()
        if not part:
            part = Part(name=part_name, unit_price=price, stock_quantity=100)
            db.session.add(part)
            db.session.flush()
        else:
            part.unit_price = price
            if part.stock_quantity < quantity:
                part.stock_quantity = 100
    else:
        part = db.session.get(Part, part_id)
        if not part:
            return jsonify({"success": False, "message": "Part not found"}), 404

    part_used = PartUsed(
        repair_id=repair.id,
        part_id=part.id,
        quantity=quantity,
        unit_price=price if data.get("price") is not None or data.get("unit_price") is not None else part.unit_price,
    )
    db.session.add(part_used)

    notify(
        user_id=repair.customer_id,
        title="Parts added",
        message=f"{quantity} x {part.name} added to repair #{repair.id}.",
        notif_type="PARTS",
        repair_id=repair.id,
    )

    db.session.commit()
    db.session.refresh(part_used)
    return jsonify({"success": True, "part_used": part_used.to_dict()}), 201


@parts_bp.route("/repairs/<int:repair_id>/parts/<int:part_used_id>", methods=["PUT"])
def update_part_used(repair_id, part_used_id):
    """
    Update details, quantity, or price of an existing part used entry.
    """
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "TECHNICIAN":
        return jsonify({"success": False, "message": "Only the assigned technician can edit parts"}), 403

    part_used = PartUsed.query.filter_by(id=part_used_id, repair_id=repair.id).first()
    if not part_used:
        return jsonify({"success": False, "message": "Part entry not found"}), 404

    data = request.get_json(silent=True) or {}
    part_name = (data.get("part_name") or data.get("part_details") or "").strip()

    try:
        quantity = int(data.get("quantity", part_used.quantity))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Quantity must be a valid whole number"}), 400

    try:
        price = float(data.get("price") if data.get("price") is not None else (data.get("unit_price") if data.get("unit_price") is not None else part_used.unit_price))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Price must be a valid number"}), 400

    if quantity <= 0:
        return jsonify({"success": False, "message": "Quantity must be greater than zero"}), 400
    if price < 0:
        return jsonify({"success": False, "message": "Price cannot be negative"}), 400

    if part_name:
        part = Part.query.filter(db.func.lower(Part.name) == db.func.lower(part_name)).first()
        if not part:
            part = Part(name=part_name, unit_price=price, stock_quantity=100)
            db.session.add(part)
            db.session.flush()
        part_used.part_id = part.id

    part_used.quantity = quantity
    part_used.unit_price = price

    db.session.commit()
    return jsonify({"success": True, "part_used": part_used.to_dict()}), 200


@parts_bp.route("/repairs/<int:repair_id>/parts/<int:part_used_id>", methods=["DELETE"])
def remove_part_used(repair_id, part_used_id):
    """
    Remove an existing part used entry.
    """
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "TECHNICIAN":
        return jsonify({"success": False, "message": "Only the assigned technician can remove parts"}), 403

    part_used = PartUsed.query.filter_by(id=part_used_id, repair_id=repair.id).first()
    if not part_used:
        return jsonify({"success": False, "message": "Part entry not found"}), 404

    db.session.delete(part_used)
    db.session.commit()
    return jsonify({"success": True, "message": "Part removed successfully"}), 200

