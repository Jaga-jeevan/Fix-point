from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity

from app import db
from app.utils.decorators import role_required
from app.models.device import Device
from app.models.repair_request import RepairRequest
from app.models.repair_photo import RepairPhoto
from app.models.status_history import RepairStatusHistory
from app.utils.file_upload import save_upload
from app.services.assignment_service import announce_new_request

customer_bp = Blueprint("customer", __name__)


@customer_bp.route("/repairs", methods=["POST"])
@role_required("CUSTOMER")
def create_repair():
    customer_id = int(get_jwt_identity())

    # multipart/form-data: text fields + optional photo file
    form = request.form
    device_type = (form.get("device_type") or "").strip()
    brand = (form.get("brand") or "").strip()
    model = (form.get("model") or "").strip()
    problem_description = (form.get("problem_description") or "").strip()
    preferred_date = (form.get("preferred_date") or "").strip()
    preferred_time = (form.get("preferred_time") or "").strip()
    address = (form.get("address") or "").strip()

    required = [device_type, brand, model, problem_description, preferred_date, preferred_time, address]
    if not all(required):
        return jsonify({"success": False, "message": "All fields are required"}), 400

    # Prevent creating duplicate repair requests if an active job is already in progress
    active_statuses = (
        "REQUESTED",
        "APPROVED",
        "ASSIGNED",
        "ACCEPTED",
        "ON_THE_WAY",
        "DEVICE_RECEIVED",
        "REPAIRING",
        "PENDING_PARTS",
        "REPAIRED",
    )
    active_repair = (
        RepairRequest.query.filter_by(customer_id=customer_id)
        .filter(RepairRequest.status.in_(active_statuses))
        .first()
    )
    if active_repair:
        dev_name = f"{active_repair.device.brand} {active_repair.device.model}" if active_repair.device else "Device"
        return jsonify({
            "success": False,
            "message": f"You already have an active repair request (#{active_repair.id} for {dev_name}) currently in '{active_repair.status}' status. Only one active repair is permitted from acceptance to completion."
        }), 400

    device = Device(
        customer_id=customer_id,
        device_type=device_type,
        brand=brand,
        model=model,
    )
    db.session.add(device)
    db.session.flush()

    repair = RepairRequest(
        customer_id=customer_id,
        device_id=device.id,
        problem_description=problem_description,
        preferred_date=preferred_date,
        preferred_time=preferred_time,
        address=address,
        status="REQUESTED",
    )
    db.session.add(repair)
    db.session.flush()

    history = RepairStatusHistory(
        repair_request_id=repair.id,
        status="REQUESTED",
        changed_by=customer_id,
        remarks="Repair request submitted by customer",
    )
    db.session.add(history)

    photo_file = request.files.get("photo")
    if photo_file:
        try:
            relative_path = save_upload(photo_file, subfolder="repairs")
        except ValueError as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 400

        if relative_path:
            photo = RepairPhoto(
                repair_request_id=repair.id,
                photo_type="CUSTOMER_DEVICE",
                photo_path=relative_path,
                uploaded_by=customer_id,
            )
            db.session.add(photo)

    # Requests go straight to every currently-available technician - no
    # admin approval gate. Admin can still review/approve or reject for
    # record-keeping, but that no longer controls technician visibility.
    announce_new_request(repair)

    db.session.commit()

    return jsonify({"success": True, "message": "Repair request created", "repair": repair.to_dict()}), 201


@customer_bp.route("/repairs", methods=["GET"])
@role_required("CUSTOMER")
def list_my_repairs():
    customer_id = int(get_jwt_identity())
    repairs = (
        RepairRequest.query.filter_by(customer_id=customer_id)
        .order_by(RepairRequest.created_at.desc())
        .all()
    )
    seen_ids = set()
    unique_repairs = []
    for r in repairs:
        if r.id not in seen_ids:
            seen_ids.add(r.id)
            unique_repairs.append(r)
    return jsonify({"success": True, "repairs": [r.to_dict(include_relations=False) for r in unique_repairs]}), 200


@customer_bp.route("/repairs/<int:repair_id>", methods=["GET"])
@role_required("CUSTOMER")
def get_my_repair(repair_id):
    customer_id = int(get_jwt_identity())
    repair = db.session.get(RepairRequest, repair_id)

    if not repair:
        return jsonify({"success": False, "message": "Repair request not found"}), 404

    if repair.customer_id != customer_id:
        return jsonify({"success": False, "message": "You are not authorized to view this repair request"}), 403

    repair_dict = repair.to_dict()
    repair_dict["otp"] = repair.otp.to_customer_dict() if repair.otp else None
    if repair.quotation:
        repair_dict["quotation"] = repair.quotation.to_dict()

    return jsonify({"success": True, "repair": repair_dict}), 200


@customer_bp.route("/repairs/<int:repair_id>", methods=["DELETE"])
@role_required("CUSTOMER")
def delete_my_repair(repair_id):
    customer_id = int(get_jwt_identity())
    repair = db.session.get(RepairRequest, repair_id)

    if not repair:
        return jsonify({"success": False, "message": "Repair request not found"}), 404

    if repair.customer_id != customer_id:
        return jsonify({"success": False, "message": "You are not authorized to delete this repair request"}), 403

    non_deletable_statuses = (
        "ACCEPTED",
        "ON_THE_WAY",
        "DEVICE_RECEIVED",
        "REPAIRING",
        "PAYMENT_DONE",
        "COMPLETED",
    )
    if repair.status in non_deletable_statuses:
        return jsonify({
            "success": False,
            "message": f"Cannot delete repair request once it has been accepted by a technician or is in status '{repair.status}'."
        }), 400

    device = repair.device
    from app.models.notification import Notification
    Notification.query.filter_by(repair_id=repair.id).delete(synchronize_session=False)

    db.session.delete(repair)

    if device and len(device.repair_requests) <= 1:
        db.session.delete(device)

    db.session.commit()

    return jsonify({"success": True, "message": f"Repair request #{repair_id} has been deleted successfully."}), 200

