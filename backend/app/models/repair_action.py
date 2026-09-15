from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class RepairAction(BaseModel):
    """A single logged step of work performed on a repair (technician-written checklist)."""

    __tablename__ = "repair_actions"

    id = db.Column(db.Integer, primary_key=True)
    repair_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    repair_request = db.relationship("RepairRequest", back_populates="actions")

    def to_dict(self):
        return {
            "id": self.id,
            "repair_id": self.repair_id,
            "description": self.description,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
