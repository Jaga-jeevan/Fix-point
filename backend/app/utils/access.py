from flask_jwt_extended import get_jwt_identity, get_jwt

from app import db
from app.models.repair_request import RepairRequest
from app.models.technician import Technician


def get_repair_for_current_user(repair_id):
    """
    Loads a repair request and checks that the current JWT user is allowed
    to see it: the owning customer, or the technician currently assigned to
    it. Returns (repair, role, technician_or_none) on success.

    Returns (None, None, None) if the repair doesn't exist, and
    (False, None, None) if it exists but the user isn't authorized -
    callers should turn these into 404 / 403 respectively.
    """
    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        return None, None, None

    user_id = int(get_jwt_identity())
    role = get_jwt().get("role")

    if role == "ADMIN":
        return repair, "ADMIN", None

    if role == "CUSTOMER":
        if repair.customer_id != user_id:
            return False, None, None
        return repair, "CUSTOMER", None

    if role == "TECHNICIAN":
        technician = Technician.query.filter_by(user_id=user_id).first()
        if not technician:
            return False, None, None
        owns_it = any(a.technician_id == technician.id for a in repair.assignments)
        if not owns_it:
            return False, None, None
        return repair, "TECHNICIAN", technician

    return False, None, None
