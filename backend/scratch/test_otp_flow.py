from datetime import datetime, timezone, timedelta
from app import create_app, db
from app.models.user import User
from app.models.device import Device
from app.models.repair_request import RepairRequest
from app.models.repair_otp import RepairOTP
from app.services.otp_service import (
    generate_otp_on_start_travel,
    verify_otp_for_job,
)

app = create_app()

with app.app_context():
    print("--- STARTING OTP WORKFLOW VERIFICATION TEST ---")
    db.create_all()

    # 1. Setup mock customer & repair request
    customer = User.query.filter_by(role="CUSTOMER").first()
    if not customer:
        customer = User(
            name="Test Customer",
            email="testcustomer_otp@example.com",
            phone="9999999999",
            role="CUSTOMER",
            password_hash="dummy_hash",
        )
        db.session.add(customer)
        db.session.flush()

    device = Device.query.filter_by(customer_id=customer.id).first()
    if not device:
        device = Device(customer_id=customer.id, device_type="Laptop", brand="Dell", model="XPS 13")
        db.session.add(device)
        db.session.flush()

    repair = RepairRequest(
        customer_id=customer.id,
        device_id=device.id,
        problem_description="Test screen issue",
        preferred_date="2026-09-10",
        preferred_time="10:00 AM",
        address="123 Test Street",
        status="ACCEPTED",
    )
    db.session.add(repair)
    db.session.commit()
    print(f"Created test repair request ID #{repair.id}")

    # 2. Test OTP Generation
    otp_record, raw_otp = generate_otp_on_start_travel(repair.id)
    assert len(raw_otp) == 6 and raw_otp.isdigit(), "OTP must be 6 digits"
    assert otp_record.is_used is False, "Initial OTP must not be used"
    assert otp_record.is_expired() is False, "Initial OTP must not be expired"
    print(f"Generated 6-digit OTP: {raw_otp} for job #{repair.id}")

    # 3. Test repeated generate call (should return existing active OTP, not regenerate)
    fetched_otp, fetched_raw = generate_otp_on_start_travel(repair.id)
    assert fetched_otp.otp_code == raw_otp, "generate_otp_on_start_travel must return active OTP"
    print("generate_otp_on_start_travel returned active OTP without invalidating on page refresh")

    # 4. Test Customer Dict (should expose plain OTP to customer)
    cust_dict = fetched_otp.to_customer_dict()
    assert cust_dict["otp_code"] == raw_otp
    assert cust_dict["status"] == "Pending"
    print("Customer dict correctly exposes OTP code and Pending status")

    # 5. Test Technician Dict (must NOT expose plain OTP to technician)
    tech_dict = fetched_otp.to_technician_dict()
    assert "otp_code" not in tech_dict and "otp_hash" not in tech_dict
    assert tech_dict["is_verified"] is False
    print("Technician dict correctly conceals plain OTP code & hash")

    # 6. Test Verification with Incorrect OTP
    wrong_res = verify_otp_for_job(repair.id, "000000")
    assert wrong_res["success"] is False and wrong_res["message"] == "Invalid OTP"
    print("Incorrect OTP verification failed as expected: 'Invalid OTP'")

    # 7. Test Verification with Correct OTP
    correct_res = verify_otp_for_job(repair.id, raw_otp)
    assert correct_res["success"] is True and "verified" in str(correct_res["message"]).lower()
    print("Correct OTP verification succeeded!")

    # 8. Test Re-using the same OTP (must fail)
    reuse_res = verify_otp_for_job(repair.id, raw_otp)
    assert reuse_res["success"] is False and reuse_res["message"] == "OTP has already been used"
    print("Re-verifying used OTP failed as expected: 'OTP has already been used'")

    # 9. Test Expired OTP logic
    otp_record2, raw_otp2 = generate_otp_on_start_travel(repair.id)
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    otp_record2.expires_at = now_utc_naive - timedelta(minutes=5)
    db.session.commit()

    db.session.refresh(otp_record2)
    assert otp_record2.is_expired() is True, f"OTP should be expired (expires_at={otp_record2.expires_at}, now={now_utc_naive})"

    expired_res = verify_otp_for_job(repair.id, raw_otp2)
    assert expired_res["success"] is False and expired_res["message"] == "OTP has expired"
    print("Expired OTP verification failed as expected: 'OTP has expired'")

    # 10. Test Regeneration
    regen_record, regen_raw = generate_otp_on_start_travel(repair.id)
    assert regen_raw != raw_otp2
    assert regen_record.is_expired() is False
    regen_verify = verify_otp_for_job(repair.id, regen_raw)
    assert regen_verify["success"] is True
    print("Regenerated OTP verified successfully!")

    print("--- ALL OTP TESTS PASSED SUCCESSFULLY! ---")
