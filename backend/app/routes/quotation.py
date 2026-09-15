import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from app import db
from app.models.quotation import Quotation, QuotationItem, QuotationHistory
from app.models.status_history import RepairStatusHistory
from app.utils.access import get_repair_for_current_user
from app.services.notification_service import notify

quotation_bp = Blueprint("quotation", __name__)


def _validate_items(raw_items):
    """Returns (items, error_message). items is a list of dicts ready to build QuotationItem rows."""
    items = []
    for raw in raw_items or []:
        part_name = (raw.get("part_name") or "").strip()
        quantity = raw.get("quantity")
        unit_price = raw.get("unit_price")

        if not part_name:
            return None, "Each part needs a name"
        try:
            quantity = int(quantity)
            unit_price = float(unit_price)
        except (TypeError, ValueError):
            return None, "Quantity and unit price must be numbers"

        if quantity <= 0:
            return None, "Quantity must be greater than zero"
        if unit_price < 0:
            return None, "Unit price cannot be negative"

        items.append({"part_name": part_name, "quantity": quantity, "unit_price": unit_price})
    return items, None


@quotation_bp.route("/repairs/<int:repair_id>/quotation", methods=["GET"])
def get_quotation(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False:
        return jsonify({"success": False, "message": "You are not authorized to view this quotation"}), 403

    if not repair.quotation:
        return jsonify({"success": True, "quotation": None}), 200

    # Customers should only see a quotation once the technician has sent it.
    if role == "CUSTOMER" and repair.quotation.status == "DRAFT":
        return jsonify({"success": True, "quotation": None}), 200

    return jsonify({"success": True, "quotation": repair.quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation", methods=["POST"])
def create_or_update_quotation(repair_id):
    """Technician or Admin creates the quotation, or edits it while DRAFT or REVISION_REQUESTED."""
    verify_jwt_in_request()
    repair, role, technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role not in ("TECHNICIAN", "ADMIN"):
        return jsonify({"success": False, "message": "Only the assigned technician or admin can edit this quotation"}), 403

    data = request.get_json(silent=True) or {}
    diagnosis = (data.get("diagnosis") or "").strip()
    try:
        labour_cost = float(data.get("labour_cost", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "labour_cost must be a number"}), 400
    if labour_cost < 0:
        return jsonify({"success": False, "message": "labour_cost cannot be negative"}), 400

    try:
        discount = float(data.get("discount", 0))
    except (TypeError, ValueError):
        discount = 0.0
    if discount < 0:
        return jsonify({"success": False, "message": "discount cannot be negative"}), 400

    items, error = _validate_items(data.get("items"))
    if error:
        return jsonify({"success": False, "message": error}), 400

    quotation = repair.quotation
    if quotation and quotation.status not in ("DRAFT", "REVISION_REQUESTED"):
        return jsonify({"success": False, "message": "This quotation can no longer be modified in its current status"}), 400

    tech_id = technician.id if technician else (quotation.technician_id if quotation else 1)

    if not quotation:
        quotation = Quotation(repair_id=repair.id, technician_id=tech_id, status="DRAFT")
        db.session.add(quotation)
        db.session.flush()
    else:
        # Replace existing line items with the newly submitted set
        for existing_item in list(quotation.items):
            db.session.delete(existing_item)

    quotation.diagnosis = diagnosis
    quotation.labour_cost = labour_cost
    quotation.discount = discount

    for item in items:
        db.session.add(QuotationItem(quotation_id=quotation.id, **item))

    db.session.commit()
    db.session.refresh(quotation)
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation/send", methods=["POST"])
def send_quotation(repair_id):
    verify_jwt_in_request()
    repair, role, technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role not in ("TECHNICIAN", "ADMIN"):
        return jsonify({"success": False, "message": "Only the assigned technician or admin can send this quotation"}), 403

    quotation = repair.quotation
    if not quotation:
        return jsonify({"success": False, "message": "No quotation has been created yet"}), 404
    if quotation.status not in ("DRAFT", "REVISION_REQUESTED"):
        return jsonify({"success": False, "message": "This quotation cannot be sent in its current status"}), 400

    is_revision = quotation.status == "REVISION_REQUESTED"
    if is_revision:
        quotation.version = (quotation.version or 1) + 1
        quotation.status = "REVISED_SENT"
    else:
        quotation.status = "SENT"

    notif_title = "Revised Quotation Ready" if is_revision else "Quotation ready"
    notif_msg = (
        f"A revised quotation (v{quotation.version}) for repair #{repair.id} is ready for your review (total: ₹{quotation.total_amount:.2f})."
        if is_revision
        else f"A quotation for repair #{repair.id} is ready for your review (total: ₹{quotation.total_amount:.2f})."
    )

    notify(
        user_id=repair.customer_id,
        title=notif_title,
        message=notif_msg,
        notif_type="QUOTATION",
        repair_id=repair.id,
    )

    db.session.commit()
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation/request-revision", methods=["POST"])
def request_revision(repair_id):
    """Customer requests a revised quotation with reason and optional message."""
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "CUSTOMER":
        return jsonify({"success": False, "message": "Only the customer can request a quotation revision"}), 403

    quotation = repair.quotation
    if not quotation:
        return jsonify({"success": False, "message": "No quotation found for this repair"}), 404
    if quotation.status not in ("SENT", "REVISED_SENT"):
        return jsonify({"success": False, "message": "Quotation is not in a status where revision can be requested"}), 400

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "Cost is too high").strip()
    message = (data.get("message") or "").strip()

    # Create history snapshot of the quotation version being revised/rejected
    items_snapshot = [item.to_dict() for item in quotation.items]
    history_entry = QuotationHistory(
        quotation_id=quotation.id,
        version=quotation.version or 1,
        diagnosis=quotation.diagnosis,
        labour_cost=quotation.labour_cost,
        discount=quotation.discount or 0,
        total_amount=quotation.total_amount,
        items_json=json.dumps(items_snapshot),
        revision_reason=reason,
        revision_message=message,
    )
    db.session.add(history_entry)

    quotation.status = "REVISION_REQUESTED"
    quotation.revision_reason = reason
    quotation.revision_message = message

    if quotation.technician and quotation.technician.user_id:
        notify(
            user_id=quotation.technician.user_id,
            title="Quotation Revision Requested",
            message=f"Customer requested a revision for repair #{repair.id}. Reason: {reason}",
            notif_type="QUOTATION",
            repair_id=repair.id,
        )

    db.session.commit()
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation/approve", methods=["POST"])
def approve_quotation(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "CUSTOMER":
        return jsonify({"success": False, "message": "Only the customer can approve this quotation"}), 403

    quotation = repair.quotation
    if not quotation:
        return jsonify({"success": False, "message": "No quotation to approve"}), 404
    if quotation.status not in ("SENT", "REVISED_SENT"):
        return jsonify({"success": False, "message": "This quotation cannot be approved in its current status"}), 400

    quotation.status = "APPROVED"

    if quotation.technician and quotation.technician.user_id:
        notify(
            user_id=quotation.technician.user_id,
            title="Quotation approved",
            message=f"The customer approved your quotation for repair #{repair.id}.",
            notif_type="QUOTATION",
            repair_id=repair.id,
        )

    db.session.commit()
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation/reject", methods=["POST"])
def reject_quotation(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "CUSTOMER":
        return jsonify({"success": False, "message": "Only the customer can reject this quotation"}), 403

    quotation = repair.quotation
    if not quotation:
        return jsonify({"success": False, "message": "No quotation to reject"}), 404
    if quotation.status not in ("SENT", "REVISED_SENT"):
        return jsonify({"success": False, "message": "This quotation can no longer be modified"}), 400

    quotation.status = "REJECTED"

    if quotation.technician and quotation.technician.user_id:
        notify(
            user_id=quotation.technician.user_id,
            title="Quotation rejected",
            message=f"The customer rejected your quotation for repair #{repair.id}.",
            notif_type="QUOTATION",
            repair_id=repair.id,
        )

    db.session.commit()
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation/pay", methods=["POST"])
def submit_payment(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role != "CUSTOMER":
        return jsonify({"success": False, "message": "Only the customer can pay for this quotation"}), 403

    quotation = repair.quotation
    if not quotation:
        return jsonify({"success": False, "message": "No quotation found to pay"}), 404
    if quotation.status != "APPROVED":
        return jsonify({"success": False, "message": "Quotation must be approved before payment"}), 400
    if quotation.payment_status == "PAID":
        return jsonify({"success": False, "message": "This quotation has already been paid"}), 400
    if quotation.payment_status == "PENDING_VERIFICATION":
        return jsonify({"success": False, "message": "Payment is already pending verification"}), 400

    data = request.get_json(silent=True) or {}
    payment_method = (data.get("payment_method") or "UPI").strip().upper()
    if payment_method not in ("UPI", "UPI_QR", "CASH"):
        return jsonify({"success": False, "message": "Invalid payment method"}), 400

    if payment_method in ("UPI", "UPI_QR"):
        utr = (data.get("utr") or data.get("transaction_id") or "").strip()
        if not utr:
            return jsonify({"success": False, "message": "Transaction ID / UTR is required"}), 400
        quotation.payment_method = "UPI"
        quotation.utr = utr
        notif_msg = f"Customer submitted UPI payment UTR {utr} for repair #{repair.id}. Pending verification."
    else:
        quotation.payment_method = "CASH"
        quotation.utr = None
        notif_msg = f"Customer selected cash payment for repair #{repair.id}. Pending technician collection & verification."

    quotation.payment_status = "PENDING_VERIFICATION"
    quotation.payment_date = datetime.now(timezone.utc)

    if quotation.technician and quotation.technician.user_id:
        notify(
            user_id=quotation.technician.user_id,
            title="Payment Submitted",
            message=notif_msg,
            notif_type="PAYMENT",
            repair_id=repair.id,
        )

    db.session.commit()
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200


@quotation_bp.route("/repairs/<int:repair_id>/quotation/verify-payment", methods=["POST"])
def verify_payment(repair_id):
    verify_jwt_in_request()
    repair, role, _technician = get_repair_for_current_user(repair_id)

    if repair is None:
        return jsonify({"success": False, "message": "Repair request not found"}), 404
    if repair is False or role not in ("TECHNICIAN", "ADMIN"):
        return jsonify({"success": False, "message": "Only technicians or admins can verify payments"}), 403

    quotation = repair.quotation
    if not quotation:
        return jsonify({"success": False, "message": "No quotation found"}), 404
    if quotation.payment_status != "PENDING_VERIFICATION":
        return jsonify({"success": False, "message": "No pending payment verification found for this quotation"}), 400

    user_id = int(get_jwt_identity())
    quotation.payment_status = "PAID"
    quotation.verified_at = datetime.now(timezone.utc)
    quotation.verified_by_id = user_id

    # Log PAYMENT_DONE history entry upon technician verification
    history_entry = RepairStatusHistory(
        repair_request_id=repair.id,
        status="PAYMENT_DONE",
        changed_by=user_id,
        remarks=f"Payment verified by {role.lower()} ({quotation.payment_method})"
    )
    db.session.add(history_entry)

    notif_msg = (
        f"Your cash payment for repair #{repair.id} has been collected and verified as PAID."
        if quotation.payment_method == "CASH"
        else f"Your payment for repair #{repair.id} (UTR: {quotation.utr}) has been verified and marked as PAID."
    )

    notify(
        user_id=repair.customer_id,
        title="Payment Verified",
        message=notif_msg,
        notif_type="PAYMENT",
        repair_id=repair.id,
    )

    db.session.commit()
    return jsonify({"success": True, "quotation": quotation.to_dict()}), 200

