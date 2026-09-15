from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel

# Ordered list of the "happy path" statuses
STATUS_FLOW = [
    "REQUESTED",
    "APPROVED",
    "ASSIGNED",
    "ACCEPTED",
    "ON_THE_WAY",
    "DEVICE_RECEIVED",
    "REPAIRING",
    "PAYMENT_DONE",
    "COMPLETED",
]

ALL_STATUSES = STATUS_FLOW + ["REJECTED"]

# Map of current status -> set of statuses it may legally move to
VALID_TRANSITIONS = {
    "REQUESTED": {"APPROVED", "ASSIGNED", "ACCEPTED", "REJECTED"},
    "APPROVED": {"ASSIGNED", "ACCEPTED"},
    "ASSIGNED": {"ACCEPTED", "ON_THE_WAY"},
    "ACCEPTED": {"ON_THE_WAY"},
    "ON_THE_WAY": {"DEVICE_RECEIVED"},
    "DEVICE_RECEIVED": {"REPAIRING"},
    "REPAIRING": {"PAYMENT_DONE", "COMPLETED"},
    "PAYMENT_DONE": {"COMPLETED"},
    "COMPLETED": set(),
    "REJECTED": set(),
}


class RepairRequest(BaseModel):
    __tablename__ = "repair_requests"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    device_id = db.Column(db.Integer, db.ForeignKey("devices.id"), nullable=False)
    problem_description = db.Column(db.Text, nullable=False)
    preferred_date = db.Column(db.String(20), nullable=False)
    preferred_time = db.Column(db.String(20), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(30), nullable=False, default="REQUESTED")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer = db.relationship("User", back_populates="repair_requests")
    device = db.relationship("Device", back_populates="repair_requests")
    assignments = db.relationship(
        "RepairAssignment", back_populates="repair_request", cascade="all, delete-orphan"
    )
    photos = db.relationship(
        "RepairPhoto", back_populates="repair_request", cascade="all, delete-orphan"
    )
    status_history = db.relationship(
        "RepairStatusHistory",
        back_populates="repair_request",
        cascade="all, delete-orphan",
        order_by="RepairStatusHistory.created_at",
    )
    messages = db.relationship(
        "Message",
        back_populates="repair_request",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    quotation = db.relationship(
        "Quotation", back_populates="repair_request", uselist=False, cascade="all, delete-orphan"
    )
    parts_used = db.relationship(
        "PartUsed", back_populates="repair_request", cascade="all, delete-orphan"
    )
    actions = db.relationship(
        "RepairAction",
        back_populates="repair_request",
        cascade="all, delete-orphan",
        order_by="RepairAction.created_at",
    )
    otp = db.relationship(
        "RepairOTP", back_populates="repair_request", uselist=False, cascade="all, delete-orphan"
    )
    notifications = db.relationship(
        "Notification", cascade="all, delete-orphan"
    )

    def can_transition_to(self, new_status):
        return new_status in VALID_TRANSITIONS.get(self.status, set())

    @property
    def current_assignment(self):
        # Most recent assignment, if any
        assignments = getattr(self, "assignments", None)
        if not assignments:
            return None
        return max(assignments, key=lambda a: a.assigned_at)

    def to_dict(self, include_relations=True):
        data = {
            "id": self.id,
            "customer_id": self.customer_id,
            "device_id": self.device_id,
            "problem_description": self.problem_description,
            "preferred_date": self.preferred_date,
            "preferred_time": self.preferred_time,
            "address": self.address,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        data["device"] = self.device.to_dict() if self.device else None
        data["customer_name"] = self.customer.name if self.customer else None

        assignment = self.current_assignment
        data["technician"] = assignment.technician.to_dict() if (assignment and assignment.technician) else None

        if include_relations:
            data["customer"] = self.customer.to_dict() if self.customer else None
            data["photos"] = [p.to_dict() for p in self.photos]
            data["status_history"] = [h.to_dict() for h in self.status_history]
            data["assignment"] = assignment.to_dict() if assignment else None
            data["actions"] = [a.to_dict() for a in self.actions]
            data["parts_used"] = [p.to_dict() for p in self.parts_used]
            data["has_quotation"] = self.quotation is not None
            data["quotation"] = self.quotation.to_dict() if self.quotation else None
        return data
