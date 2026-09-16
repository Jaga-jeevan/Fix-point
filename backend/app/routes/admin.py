from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity

from app import db
from app.utils.decorators import role_required
from app.models.user import User
from app.models.technician import Technician
from app.models.repair_request import RepairRequest
from app.services.repair_service import change_status, InvalidTransitionError
from app.services.assignment_service import get_available_technicians

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/dashboard", methods=["GET"])
@role_required("ADMIN")
def dashboard():
    total_customers = User.query.filter_by(role="CUSTOMER").count()
    total_technicians = User.query.filter_by(role="TECHNICIAN").count()

    pending_requests = RepairRequest.query.filter_by(status="REQUESTED").count()
    approved_requests = RepairRequest.query.filter_by(status="APPROVED").count()

    active_statuses = ["ASSIGNED", "ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING"]
    active_repairs = RepairRequest.query.filter(RepairRequest.status.in_(active_statuses)).count()

    completed_repairs = RepairRequest.query.filter_by(status="COMPLETED").count()

    return jsonify({
        "success": True,
        "stats": {
            "total_customers": total_customers,
            "total_technicians": total_technicians,
            "pending_requests": pending_requests,
            "approved_requests": approved_requests,
            "active_repairs": active_repairs,
            "completed_repairs": completed_repairs,
        },
    }), 200


@admin_bp.route("/repairs", methods=["GET"])
@role_required("ADMIN")
def list_all_repairs():
    status_filter = request.args.get("status")
    query = RepairRequest.query
    if status_filter:
        query = query.filter_by(status=status_filter.upper())
    repairs = query.order_by(RepairRequest.created_at.desc()).all()
    seen_ids = set()
    unique_repairs = []
    for r in repairs:
        if r.id not in seen_ids:
            seen_ids.add(r.id)
            unique_repairs.append(r)
    return jsonify({"success": True, "repairs": [r.to_dict(include_relations=False) for r in unique_repairs]}), 200


@admin_bp.route("/repairs/<int:repair_id>", methods=["GET"])
@role_required("ADMIN")
def get_repair(repair_id):
    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    return jsonify({"success": True, "repair": repair.to_dict()}), 200


@admin_bp.route("/repairs/<int:repair_id>/approve", methods=["POST"])
@role_required("ADMIN")
def approve_repair(repair_id):
    admin_id = int(get_jwt_identity())
    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        return jsonify({"success": False, "message": "Repair request not found"}), 404

    try:
        change_status(repair, "APPROVED", admin_id, remarks="Approved by admin")
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    # Note: technicians were already notified when this request was
    # created - approval is now an optional admin review step and does not
    # gate technician visibility or trigger a second notification.
    db.session.commit()
    return jsonify({"success": True, "message": "Repair request approved", "repair": repair.to_dict()}), 200


@admin_bp.route("/repairs/<int:repair_id>/reject", methods=["POST"])
@role_required("ADMIN")
def reject_repair(repair_id):
    admin_id = int(get_jwt_identity())
    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        return jsonify({"success": False, "message": "Repair request not found"}), 404

    data = request.get_json(silent=True) or {}
    remarks = data.get("remarks", "Rejected by admin")

    try:
        change_status(repair, "REJECTED", admin_id, remarks=remarks)
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    db.session.commit()
    return jsonify({"success": True, "message": "Repair request rejected", "repair": repair.to_dict()}), 200


@admin_bp.route("/technicians", methods=["GET"])
@role_required("ADMIN")
def list_technicians():
    only_available = request.args.get("available") == "true"

    if only_available:
        technicians = get_available_technicians()
    else:
        technicians = Technician.query.all()

    return jsonify({"success": True, "technicians": [t.to_dict() for t in technicians]}), 200


@admin_bp.route("/repairs/<int:repair_id>/assign", methods=["POST"])
@role_required("ADMIN")
def assign_repair(repair_id):
    """
    Manual assignment has been replaced by automatic technician assignment:
    every available technician is notified as soon as a customer submits a
    request (admin approval is optional and not required), and any one of
    them can claim it (POST /technician/available-requests/<id>/accept).
    This endpoint is kept (rather than deleted) so old clients get a clear
    explanation instead of a 404.
    """
    return jsonify({
        "success": False,
        "message": (
            "Manual technician assignment is disabled. Technicians now accept "
            "approved repair requests themselves."
        ),
    }), 400


@admin_bp.route("/customers", methods=["GET"])
@role_required("ADMIN")
def list_customers():
    search_q = request.args.get("q", "").strip()
    query = User.query.filter_by(role="CUSTOMER")

    if search_q:
        pattern = f"%{search_q}%"
        query = query.filter(
            (User.name.ilike(pattern))
            | (User.email.ilike(pattern))
            | (User.phone.ilike(pattern))
        )

    customers = query.order_by(User.created_at.desc()).all()

    active_statuses = ["REQUESTED", "APPROVED", "ASSIGNED", "ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING"]

    result = []
    for c in customers:
        total_requests = len(c.repair_requests)
        active_requests = sum(1 for r in c.repair_requests if r.status in active_statuses)
        devices_count = len(c.devices)

        c_dict = c.to_dict()
        c_dict["total_requests"] = total_requests
        c_dict["active_requests"] = active_requests
        c_dict["devices_count"] = devices_count
        result.append(c_dict)

    return jsonify({"success": True, "customers": result}), 200


@admin_bp.route("/customers/<int:customer_id>", methods=["GET"])
@role_required("ADMIN")
def get_customer_details(customer_id):
    customer = db.session.get(User, customer_id)
    if not customer or customer.role != "CUSTOMER":
        return jsonify({"success": False, "message": "Customer not found"}), 404

    c_dict = customer.to_dict()
    c_dict["devices"] = [d.to_dict() for d in customer.devices]

    repairs = []
    active_statuses = ["REQUESTED", "APPROVED", "ASSIGNED", "ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING"]

    customer_requests = (
        RepairRequest.query.filter_by(customer_id=customer.id)
        .order_by(RepairRequest.created_at.desc())
        .all()
    )

    for r in customer_requests:
        r_dict = r.to_dict(include_relations=True)
        repairs.append(r_dict)

    c_dict["repair_requests"] = repairs
    c_dict["total_requests"] = len(repairs)
    c_dict["active_requests"] = sum(1 for r in repairs if r["status"] in active_statuses)

    return jsonify({"success": True, "customer": c_dict}), 200

