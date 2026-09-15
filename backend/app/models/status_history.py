from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class RepairStatusHistory(BaseModel):
    __tablename__ = "repair_status_history"

    id = db.Column(db.Integer, primary_key=True)
    repair_request_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=False)
    status = db.Column(db.String(30), nullable=False)
    changed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    remarks = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    repair_request = db.relationship("RepairRequest", back_populates="status_history")

    def to_dict(self):
        return {
            "id": self.id,
            "repair_request_id": self.repair_request_id,
            "status": self.status,
            "changed_by": self.changed_by,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
