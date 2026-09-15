from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class Device(BaseModel):
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    device_type = db.Column(db.String(80), nullable=False)
    brand = db.Column(db.String(80), nullable=False)
    model = db.Column(db.String(80), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    customer = db.relationship("User", back_populates="devices")
    repair_requests = db.relationship("RepairRequest", back_populates="device")

    def to_dict(self):
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "device_type": self.device_type,
            "brand": self.brand,
            "model": self.model,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
