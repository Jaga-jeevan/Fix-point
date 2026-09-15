from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class Message(BaseModel):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    repair_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    repair_request = db.relationship("RepairRequest", back_populates="messages")
    sender = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "repair_id": self.repair_id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else None,
            "sender_role": self.sender.role if self.sender else None,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
