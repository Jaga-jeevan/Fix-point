from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class RepairAssignment(BaseModel):
    __tablename__ = "repair_assignments"

    id = db.Column(db.Integer, primary_key=True)
    repair_request_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    assigned_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    repair_request = db.relationship("RepairRequest", back_populates="assignments")
    technician = db.relationship("Technician", back_populates="assignments")

    def to_dict(self):
        return {
            "id": self.id,
            "repair_request_id": self.repair_request_id,
            "technician_id": self.technician_id,
            "assigned_by": self.assigned_by,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "technician": self.technician.to_dict() if self.technician else None,
        }
