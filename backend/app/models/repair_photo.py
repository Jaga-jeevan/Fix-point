from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel

PHOTO_TYPES = ("CUSTOMER_DEVICE", "DEVICE_RECEIVED")


class RepairPhoto(BaseModel):
    __tablename__ = "repair_photos"

    id = db.Column(db.Integer, primary_key=True)
    repair_request_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=False)
    photo_type = db.Column(db.String(30), nullable=False)
    photo_path = db.Column(db.String(255), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    repair_request = db.relationship("RepairRequest", back_populates="photos")

    def to_dict(self):
        return {
            "id": self.id,
            "repair_request_id": self.repair_request_id,
            "photo_type": self.photo_type,
            "photo_url": f"/api/uploads/{self.photo_path}",
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
