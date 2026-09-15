from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import update

from app import db
from app.utils.decorators import role_required
from app.models.technician import Technician
from app.models.repair_request import RepairRequest
from app.models.repair_photo import RepairPhoto
from app.models.status_history import RepairStatusHistory
from app.services.repair_service import change_status, InvalidTransitionError
from app.services.assignment_service import (
    get_available_repair_requests,
    claim_repair_request,
    release_technician,
    AlreadyClaimedError,
    TechnicianUnavailableError,
)
from app.utils.file_upload import save_upload

technician_bp = Blueprint("technician", __name__)


def _get_technician_profile():
    user_id = int(get_jwt_identity())
    return Technician.query.filter_by(user_id=user_id).first()


def _get_owned_repair(repair_id, technician):
    """
    Returns the repair only if the currently logged-in technician has an
    assignment on it. Otherwise returns None. This is the enforcement point
    for "a technician cannot access another technician's assigned repair".
    """
    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        return None
    owns_it = any(a.technician_id == technician.id for a in repair.assignments)
    return repair if owns_it else None


@technician_bp.route("/dashboard", methods=["GET"])
@role_required("TECHNICIAN")
def dashboard():
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair_ids = [a.repair_request_id for a in technician.assignments]
    repairs = RepairRequest.query.filter(RepairRequest.id.in_(repair_ids)).all() if repair_ids else []

    counts = {
        "assigned": sum(1 for r in repairs if r.status == "ASSIGNED"),
        "accepted": sum(1 for r in repairs if r.status == "ACCEPTED"),
        "active": sum(1 for r in repairs if r.status in ("ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING")),
        "completed": sum(1 for r in repairs if r.status == "COMPLETED"),
    }

    return jsonify({
        "success": True,
        "stats": counts,
        "is_available": technician.is_available,
        "availability_status": technician.availability_status,
    }), 200


@technician_bp.route("/jobs", methods=["GET"])
@role_required("TECHNICIAN")
def list_jobs():
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair_ids = list(dict.fromkeys(a.repair_request_id for a in technician.assignments))
    repairs = (
        RepairRequest.query.filter(RepairRequest.id.in_(repair_ids))
        .order_by(RepairRequest.updated_at.desc())
        .all()
        if repair_ids
        else []
    )
    seen_ids = set()
    unique_repairs = []
    for r in repairs:
        if r.id not in seen_ids:
            seen_ids.add(r.id)
            unique_repairs.append(r)

    return jsonify({"success": True, "jobs": [r.to_dict(include_relations=False) for r in unique_repairs]}), 200


@technician_bp.route("/availability", methods=["PATCH"])
@role_required("TECHNICIAN")
def set_availability():
    """
    Lets a technician toggle themselves AVAILABLE <-> OFFLINE outside of a
    job. BUSY is set automatically by the system (claiming/completing a
    job) and cannot be set directly here.

    Implemented as a single conditional UPDATE (not a read-then-write) so
    it can't silently clobber a BUSY status that gets set concurrently -
    e.g. the technician claims a job in one tab while toggling availability
    in another. If the row no longer matches AVAILABLE/OFFLINE by the time
    the UPDATE runs (because they just became BUSY), the update simply
    matches zero rows and the request is rejected with a clear message,
    exactly like the claim/parts-stock endpoints.
    """
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    data = request.get_json(silent=True) or {}
    new_status = (data.get("availability_status") or "").upper()
    if new_status not in ("AVAILABLE", "OFFLINE"):
        return jsonify({"success": False, "message": "availability_status must be AVAILABLE or OFFLINE"}), 400

    result = db.session.execute(
        update(Technician)
        .where(Technician.id == technician.id, Technician.availability_status.in_(("AVAILABLE", "OFFLINE")))
        .values(availability_status=new_status)
    )

    if getattr(result, "rowcount", 0) == 0:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "You cannot change availability while you have an active job.",
        }), 400

    db.session.commit()
    db.session.refresh(technician)
    return jsonify({"success": True, "availability_status": technician.availability_status}), 200


@technician_bp.route("/available-requests", methods=["GET"])
@role_required("TECHNICIAN")
def available_requests():
    """
    Repair requests that have been approved by an admin and are waiting for
    any available technician to claim. This is what makes assignment
    automatic instead of admin-picked.
    """
    requests = get_available_repair_requests()
    return jsonify({
        "success": True,
        "requests": [r.to_dict(include_relations=False) for r in requests],
    }), 200


@technician_bp.route("/available-requests/<int:repair_id>/accept", methods=["POST"])
@role_required("TECHNICIAN")
def accept_available_request(repair_id):
    """
    A technician claims an unassigned, approved repair request for
    themselves. Safe under concurrent access — see
    assignment_service.claim_repair_request for the locking strategy.
    """
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        return jsonify({"success": False, "message": "Repair request not found"}), 404

    try:
        claim_repair_request(repair_id, technician)
    except AlreadyClaimedError as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 409
    except TechnicianUnavailableError as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 400

    db.session.commit()
    db.session.refresh(repair)
    return jsonify({"success": True, "message": "Repair request accepted", "job": repair.to_dict()}), 200


@technician_bp.route("/jobs/<int:repair_id>", methods=["GET"])
@role_required("TECHNICIAN")
def get_job(repair_id):
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        return jsonify({"success": False, "message": "You are not authorized to view this job"}), 403

    job_dict = repair.to_dict()
    job_dict["otp_status"] = repair.otp.to_technician_dict() if repair.otp else {"is_verified": False}

    return jsonify({"success": True, "job": job_dict}), 200


@technician_bp.route("/jobs/<int:repair_id>/verify-otp", methods=["POST"])
@role_required("TECHNICIAN")
def verify_job_otp(repair_id):
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        return jsonify({"success": False, "message": "You are not authorized to access this job"}), 403

    data = request.get_json(silent=True) or {}
    entered_otp = data.get("otp")

    from app.services.otp_service import verify_otp_for_job
    result = verify_otp_for_job(repair_id, entered_otp)

    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code


class TechnicianAuthError(Exception):
    """Raised when the technician profile is missing or the job isn't theirs."""

    def __init__(self, message, status_code):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _do_transition(repair_id, new_status, remarks):
    """
    Loads the technician + repair (enforcing ownership) and applies a status
    transition. Returns (technician, repair) on success, or raises
    TechnicianAuthError / InvalidTransitionError on failure.
    """
    technician = _get_technician_profile()
    if not technician:
        raise TechnicianAuthError("Technician profile not found", 404)

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        raise TechnicianAuthError("You are not authorized to update this job", 403)

    change_status(repair, new_status, technician.user_id, remarks=remarks)

    return technician, repair


@technician_bp.route("/jobs/<int:repair_id>/accept", methods=["POST"])
@role_required("TECHNICIAN")
def accept_job(repair_id):
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        return jsonify({"success": False, "message": "You are not authorized to update this job"}), 403

    if repair.status != "ASSIGNED":
        return jsonify({"success": False, "message": "Job has already been accepted"}), 400

    try:
        technician, repair = _do_transition(repair_id, "ACCEPTED", "Technician accepted the job")
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    assignment = repair.current_assignment
    if assignment:
        assignment.accepted_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify({"success": True, "message": "Job accepted", "job": repair.to_dict()}), 200


@technician_bp.route("/jobs/<int:repair_id>/start-travel", methods=["POST"])
@role_required("TECHNICIAN")
def start_travel(repair_id):
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        return jsonify({"success": False, "message": "You are not authorized to update this job"}), 403

    # Generate OTP when Start Travel is initiated (reuses active OTP if already exists)
    from app.services.otp_service import generate_otp_on_start_travel
    otp_record, _ = generate_otp_on_start_travel(repair_id)

    try:
        technician, repair = _do_transition(repair_id, "ON_THE_WAY", "Technician is on the way")
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    db.session.commit()
    job_dict = repair.to_dict()
    job_dict["otp_status"] = otp_record.to_technician_dict()
    return jsonify({"success": True, "message": "Travel started", "job": job_dict}), 200


@technician_bp.route("/jobs/<int:repair_id>/receive-device", methods=["POST"])
@role_required("TECHNICIAN")
def receive_device(repair_id):
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        return jsonify({"success": False, "message": "You are not authorized to update this job"}), 403

    notes = (request.form.get("notes") or "").strip()

    try:
        change_status(repair, "DEVICE_RECEIVED", technician.user_id, remarks=notes or "Device received from customer")
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

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
                photo_type="DEVICE_RECEIVED",
                photo_path=relative_path,
                uploaded_by=technician.user_id,
            )
            db.session.add(photo)

    db.session.commit()
    return jsonify({"success": True, "message": "Device marked as received", "job": repair.to_dict()}), 200


@technician_bp.route("/jobs/<int:repair_id>/start-repair", methods=["POST"])
@role_required("TECHNICIAN")
def start_repair(repair_id):
    try:
        technician, repair = _do_transition(repair_id, "REPAIRING", "Repair started")
    except TechnicianAuthError as e:
        return jsonify({"success": False, "message": e.message}), e.status_code
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    db.session.commit()
    return jsonify({"success": True, "message": "Repair started", "job": repair.to_dict()}), 200


@technician_bp.route("/jobs/<int:repair_id>/complete", methods=["POST"])
@role_required("TECHNICIAN")
def complete_job(repair_id):
    technician = _get_technician_profile()
    if not technician:
        return jsonify({"success": False, "message": "Technician profile not found"}), 404

    repair = _get_owned_repair(repair_id, technician)
    if not repair:
        return jsonify({"success": False, "message": "You are not authorized to update this job"}), 403

    quotation = repair.quotation
    if not quotation or quotation.payment_status != "PAID":
        return jsonify({
            "success": False,
            "message": "Customer payment must be verified as PAID before completing this repair."
        }), 400

    try:
        change_status(repair, "COMPLETED", technician.user_id, remarks="Repair completed")
    except InvalidTransitionError as e:
        return jsonify({"success": False, "message": str(e)}), 400

    assignment = repair.current_assignment
    if assignment:
        assignment.completed_at = datetime.now(timezone.utc)

    release_technician(technician)

    db.session.commit()
    return jsonify({"success": True, "message": "Repair completed", "job": repair.to_dict()}), 200
