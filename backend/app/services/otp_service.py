import secrets
from datetime import datetime, timezone

from app import db
from app.models.repair_otp import RepairOTP


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def generate_random_otp():
    """Generates a random 6-digit OTP string (100000 to 999999)."""
    return str(secrets.randbelow(900000) + 100000)


def generate_otp_on_start_travel(repair_id):
    """
    Generated ONLY when technician clicks Start Travel.
    Prevents duplicate generation: if an unused OTP already exists for this job,
    it reuses the existing active OTP.
    """
    existing = RepairOTP.query.filter_by(repair_request_id=repair_id).first()
    if existing and not existing.is_used and not existing.is_expired():
        return existing, existing.otp_code

    raw_otp = generate_random_otp()
    otp_record = RepairOTP.create_for_job(
        repair_request_id=repair_id,
        raw_otp=raw_otp,
    )
    db.session.commit()
    return otp_record, raw_otp


def verify_otp_for_job(repair_id, entered_otp):
    """
    Verifies the entered 6-digit OTP for a given repair job.
    Returns (success: bool, message: str).
    """
    entered_otp = str(entered_otp or "").strip()
    if len(entered_otp) != 6 or not entered_otp.isdigit():
        return {"success": False, "message": "Invalid OTP"}

    otp_record = RepairOTP.query.filter_by(repair_request_id=repair_id).first()
    if not otp_record:
        return {"success": False, "message": "No OTP found for this repair request"}

    if otp_record.is_used:
        return {"success": False, "message": "OTP has already been used"}

    if otp_record.is_expired():
        return {"success": False, "message": "OTP has expired"}

    if not otp_record.verify(entered_otp):
        return {"success": False, "message": "Invalid OTP"}

    # Mark OTP as verified and used
    now_utc = utc_now()
    otp_record.is_used = True
    otp_record.verified_at = now_utc

    db.session.commit()

    return {
        "success": True,
        "message": "Customer visit verified successfully",
        "verified_at": now_utc.isoformat(),
    }
