from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models.base import BaseModel

ROLES = ("CUSTOMER", "TECHNICIAN", "ADMIN")


class User(BaseModel):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="CUSTOMER")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    technician_profile = db.relationship(
        "Technician", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    devices = db.relationship("Device", back_populates="customer", cascade="all, delete-orphan")
    repair_requests = db.relationship(
        "RepairRequest", back_populates="customer", cascade="all, delete-orphan"
    )

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
