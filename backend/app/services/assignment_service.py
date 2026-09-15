from datetime import datetime, timezone
from typing import Any

from sqlalchemy import update

from app import db
from app.models.technician import Technician
from app.models.assignment import RepairAssignment
from app.models.repair_request import RepairRequest
from app.models.status_history import RepairStatusHistory
from app.services.notification_service import notify, notify_available_technicians

# Statuses that count as "technician is currently busy with this job"
ACTIVE_ASSIGNMENT_STATUSES = {
    "ASSIGNED",
    "ACCEPTED",
    "ON_THE_WAY",
    "DEVICE_RECEIVED",
    "REPAIRING",
}


class AlreadyClaimedError(Exception):
    """Raised when a technician tries to claim a request another technician already took."""


class TechnicianUnavailableError(Exception):
    """Raised when a technician tries to claim work while BUSY/OFFLINE."""


def get_available_technicians():
    """
    Returns technicians where availability_status = AVAILABLE and who do not
    currently have an active (unfinished) assignment.
    """
    technicians = Technician.query.filter_by(availability_status="AVAILABLE").all()

    available = []
    for tech in technicians:
        has_active_job = any(
            a.repair_request.status in ACTIVE_ASSIGNMENT_STATUSES for a in tech.assignments
        )
        if not has_active_job:
            available.append(tech)
    return available


def get_available_repair_requests():
    """
    Requests that are waiting for a technician to claim them, i.e. have not
    yet been assigned to anyone. Repair requests are visible to technicians
    the moment a customer creates them (REQUESTED) - admin approval is
    optional and does not gate this. APPROVED is included too, since an
    admin may still choose to review/approve a request before it's claimed;
    either status just means "not yet assigned".
    """
    return (
        RepairRequest.query.filter(RepairRequest.status.in_(("REQUESTED", "APPROVED")))
        .order_by(RepairRequest.created_at)
        .all()
    )


def claim_repair_request(repair_id, technician):
    """
    Automatic technician assignment: a technician claims an APPROVED repair
    request for themselves. This replaces manual admin assignment.

    Concurrency safety: the transition to ASSIGNED is performed as a single
    conditional UPDATE (UPDATE ... WHERE status IN ('REQUESTED', 'APPROVED')).
    If two technicians race to claim the same request, only the first
    UPDATE will affect a row (rowcount == 1); the second will affect zero
    rows and raise AlreadyClaimedError. This is enforced by PostgreSQL's
    per-row locking during the UPDATE itself, so no separate
    application-level lock is needed.

    Caller is responsible for db.session.commit().
    """
    if technician.availability_status != "AVAILABLE":
        raise TechnicianUnavailableError("You are currently unavailable for new repair requests.")

    result: Any = db.session.execute(
        update(RepairRequest)
        .where(RepairRequest.id == repair_id, RepairRequest.status.in_(("REQUESTED", "APPROVED")))
        .values(status="ACCEPTED")
    )

    if result.rowcount == 0:
        raise AlreadyClaimedError("This repair request has already been accepted by another technician.")

    repair = db.session.get(RepairRequest, repair_id)
    if not repair:
        raise AlreadyClaimedError("This repair request was not found.")

    now_utc = datetime.now(timezone.utc)

    history_entry = RepairStatusHistory()  # type: ignore
    history_entry.repair_request_id = repair.id
    history_entry.status = "ACCEPTED"
    history_entry.changed_by = technician.user_id
    history_entry.remarks = f"Accepted by technician #{technician.id}"
    db.session.add(history_entry)

    assignment = RepairAssignment()  # type: ignore
    assignment.repair_request_id = repair.id
    assignment.technician_id = technician.id
    assignment.assigned_by = technician.user_id
    assignment.assigned_at = now_utc
    assignment.accepted_at = now_utc
    db.session.add(assignment)

    # Atomically flip the technician to BUSY too, guarding against the (rare)
    # case where they were claiming two requests in quick succession.
    tech_result: Any = db.session.execute(
        update(Technician)
        .where(Technician.id == technician.id, Technician.availability_status == "AVAILABLE")
        .values(availability_status="BUSY")
    )
    if tech_result.rowcount == 0:
        # Shouldn't normally happen since we checked above, but stay safe.
        db.session.rollback()
        raise TechnicianUnavailableError("You are currently unavailable for new repair requests.")

    notify(
        user_id=repair.customer_id,
        title="Technician assigned",
        message=f"{technician.user.name} accepted your repair request #{repair.id}.",
        notif_type="ACCEPTED",
        repair_id=repair.id,
    )

    return assignment


def release_technician(technician):
    """Called when a technician finishes all their assigned repair work."""
    technician.availability_status = "AVAILABLE"


def announce_new_request(repair):
    """Notify all currently-available technicians that a request is ready to claim."""
    notify_available_technicians(repair)
