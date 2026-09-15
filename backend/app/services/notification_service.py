from app import db
from app.models.notification import Notification
from app.models.technician import Technician


def notify(user_id, title, message, notif_type="GENERAL", repair_id=None):
    """
    Creates a notification row. Does NOT commit - caller's existing
    transaction (the one making the underlying change) should commit,
    so the notification and the change it describes are saved together.
    """
    notification = Notification(
        user_id=user_id,
        repair_id=repair_id,
        title=title,
        message=message,
        type=notif_type,
    )
    db.session.add(notification)
    return notification


def notify_customer_status_change(repair, new_status):
    label = new_status.replace("_", " ").title()
    notify(
        user_id=repair.customer_id,
        title="Repair status updated",
        message=f"Your repair request #{repair.id} is now: {label}.",
        notif_type="STATUS_CHANGE",
        repair_id=repair.id,
    )


def notify_available_technicians(repair):
    """Notifies every AVAILABLE technician that a new repair request is ready to be claimed."""
    technicians = Technician.query.filter_by(availability_status="AVAILABLE").all()
    for tech in technicians:
        notify(
            user_id=tech.user_id,
            title="New repair request available",
            message=f"Repair request #{repair.id} ({repair.device.device_type if repair.device else 'device'}) is available to accept.",
            notif_type="NEW_REQUEST",
            repair_id=repair.id,
        )
