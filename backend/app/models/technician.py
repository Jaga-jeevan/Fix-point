from app import db
from app.models.base import BaseModel

# New 3-state availability, replacing the old is_available boolean.
# AVAILABLE -> eligible to see/claim new repair requests
# BUSY      -> currently has an active job
# OFFLINE   -> technician has opted out of receiving new requests
AVAILABILITY_STATES = ("AVAILABLE", "BUSY", "OFFLINE")


class Technician(BaseModel):
    __tablename__ = "technicians"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    skills = db.Column(db.String(255), nullable=True)
    service_area = db.Column(db.String(150), nullable=True)
    availability_status = db.Column(db.String(20), default="AVAILABLE", nullable=False)

    user = db.relationship("User", back_populates="technician_profile")
    assignments = db.relationship("RepairAssignment", back_populates="technician")

    @property
    def is_available(self):
        """Backward-compat helper: True only when eligible for new work."""
        return self.availability_status == "AVAILABLE"

    def to_dict(self, include_user=True):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "skills": self.skills,
            "service_area": self.service_area,
            "availability_status": self.availability_status,
            # kept for any older frontend code paths that still read is_available
            "is_available": self.is_available,
        }
        if include_user and self.user:
            data["name"] = self.user.name
            data["email"] = self.user.email
            data["phone"] = self.user.phone
        return data
