from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class Notification(BaseModel):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    repair_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=True)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    type = db.Column(db.String(50), nullable=False, default="GENERAL")
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "repair_id": self.repair_id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
