from app import db
from app.models.repair_request import RepairRequest
from app.models.status_history import RepairStatusHistory
from app.services.notification_service import notify_customer_status_change

# Statuses that already get a more specific, richer notification elsewhere
# (e.g. ASSIGNED is announced by assignment_service with the technician's
# name), so the generic "status updated" ping is skipped for those to avoid
# double notifications.
_SKIP_GENERIC_NOTIFICATION = {"ASSIGNED"}


class InvalidTransitionError(Exception):
    pass


def change_status(repair_request: RepairRequest, new_status: str, changed_by_id: int, remarks: str = None):
    """
    Validates and applies a status transition, and records it in
    repair_status_history. Raises InvalidTransitionError if the
    transition is not allowed. Caller is responsible for db.session.commit().
    """
    if not repair_request.can_transition_to(new_status):
        raise InvalidTransitionError(
            f"Cannot move repair request from {repair_request.status} to {new_status}"
        )

    repair_request.status = new_status

    history_entry = RepairStatusHistory(
        repair_request_id=repair_request.id,
        status=new_status,
        changed_by=changed_by_id,
        remarks=remarks,
    )
    db.session.add(history_entry)

    if new_status not in _SKIP_GENERIC_NOTIFICATION:
        notify_customer_status_change(repair_request, new_status)

    return repair_request
