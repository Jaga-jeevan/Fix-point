from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash

from app import db
from app.models.base import BaseModel


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RepairOTP(BaseModel):
    __tablename__ = "job_otps"

    id = db.Column(db.Integer, primary_key=True)
    repair_request_id = db.Column(
        db.Integer, db.ForeignKey("repair_requests.id"), nullable=False, unique=True, index=True
    )
    otp_code = db.Column(db.String(6), nullable=False)
    otp_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    repair_request = db.relationship("RepairRequest", back_populates="otp")

    @classmethod
    def create_for_job(cls, repair_request_id, raw_otp):
        now_utc = utc_now()
        otp_hash = generate_password_hash(raw_otp)

        existing = cls.query.filter_by(repair_request_id=repair_request_id).first()
        if existing:
            if not existing.is_used and not existing.is_expired():
                return existing
            from datetime import timedelta
            existing.otp_code = raw_otp
            existing.otp_hash = otp_hash
            existing.verified_at = None
            existing.is_used = False
            existing.created_at = now_utc
            existing.expires_at = now_utc + timedelta(days=365)
            return existing

        from datetime import timedelta
        expires_at = now_utc + timedelta(days=365)
        otp_entry = cls(
            repair_request_id=repair_request_id,
            otp_code=raw_otp,
            otp_hash=otp_hash,
            expires_at=expires_at,
            is_used=False,
            created_at=now_utc,
        )
        db.session.add(otp_entry)
        return otp_entry

    def is_expired(self):
        if not self.expires_at:
            return False
        return utc_now() > self.expires_at

    def verify(self, raw_otp):
        return check_password_hash(self.otp_hash, raw_otp)

    def to_customer_dict(self):
        return {
            "otp_code": self.otp_code,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "is_used": self.is_used,
            "status": "Verified" if self.is_used else "Pending",
        }

    def to_technician_dict(self):
        return {
            "is_verified": self.is_used,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
        }
