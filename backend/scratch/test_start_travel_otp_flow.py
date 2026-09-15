from datetime import datetime
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
    print("=== START TRAVEL OTP WORKFLOW VERIFICATION TEST ===")
    db.create_all()

    # 1. Setup mock customer & repair request
    customer = User.query.filter_by(role="CUSTOMER").first()
    if not customer:
        customer = User(
            name="Test Customer Travel",
            email="testtravel_otp@example.com",
            phone="9998887776",
            role="CUSTOMER",
            password_hash="dummy_hash",
        )
        db.session.add(customer)
        db.session.flush()

    device = Device.query.filter_by(customer_id=customer.id).first()
    if not device:
        device = Device(customer_id=customer.id, device_type="Mobile", brand="Apple", model="iPhone 13")
        db.session.add(device)
        db.session.flush()

    repair = RepairRequest(
        customer_id=customer.id,
        device_id=device.id,
        problem_description="Test battery replacement",
        preferred_date="2026-09-12",
        preferred_time="14:00",
        address="789 Market Road",
        status="ACCEPTED",
    )
    db.session.add(repair)
    db.session.commit()
    print(f"1. Repair request created & accepted (ID #{repair.id}, Status: {repair.status})")

    # 2. Confirm NO OTP exists before Start Travel
    assert repair.otp is None, "No OTP should exist before Start Travel"
    print("2. Confirmed NO OTP exists before Start Travel.")

    # 3. Customer views job before Start Travel -> OTP is None
    cust_otp = repair.otp.to_customer_dict() if repair.otp else None
    assert cust_otp is None, "Customer should see NO OTP before Start Travel"
    print("3. Confirmed Customer sees NO OTP before Start Travel.")

    # 4. Technician initiates Start Travel
    otp_rec1, raw_otp1 = generate_otp_on_start_travel(repair.id)
    setattr(repair, "status", "ON_THE_WAY")
    db.session.commit()

    assert len(raw_otp1) == 6 and raw_otp1.isdigit(), "OTP must be 6 digits"
    assert otp_rec1.is_used is False, "New OTP must be unused"
    print(f"4. Technician clicked Start Travel -> 6-digit OTP generated: {raw_otp1}, Job Status: {repair.status}")

    # 5. Repeated Start Travel clicks do NOT generate multiple OTPs
    otp_rec2, raw_otp2 = generate_otp_on_start_travel(repair.id)
    assert raw_otp2 == raw_otp1, "Repeated Start Travel must reuse the existing active OTP"
    assert otp_rec2.id == otp_rec1.id, "No duplicate OTP record created"
    print("5. Confirmed repeated Start Travel clicks reuse the same active OTP (No duplicates).")

    # 6. Customer views job after Start Travel -> Sees plain OTP code
    db.session.refresh(repair)
    cust_otp_after = repair.otp.to_customer_dict() if repair.otp else None
    assert cust_otp_after is not None, "Customer must see OTP after Start Travel"
    assert cust_otp_after["otp_code"] == raw_otp1
    assert cust_otp_after["status"] == "Pending"
    print(f"6. Confirmed Customer sees OTP '{cust_otp_after['otp_code']}' with status '{cust_otp_after['status']}'.")

    # 7. Technician views job after Start Travel -> Does NOT see plain OTP code/hash
    tech_otp_status = repair.otp.to_technician_dict() if repair.otp else {"is_verified": False}
    assert "otp_code" not in tech_otp_status and "otp_hash" not in tech_otp_status
    assert tech_otp_status["is_verified"] is False
    print("7. Confirmed Technician view conceals plain OTP code & hash.")

    # 8. Technician enters wrong OTP
    wrong_res = verify_otp_for_job(repair.id, "111111")
    assert wrong_res["success"] is False and wrong_res["message"] == "Invalid OTP"
    print("8. Wrong OTP verification failed as expected: 'Invalid OTP'")

    # 9. Technician enters correct OTP
    correct_res = verify_otp_for_job(repair.id, raw_otp1)
    assert correct_res["success"] is True and "verified" in str(correct_res["message"]).lower()
    print("9. Correct OTP verification succeeded!")

    # 10. Re-verifying used OTP fails
    reuse_res = verify_otp_for_job(repair.id, raw_otp1)
    assert reuse_res["success"] is False and reuse_res["message"] == "OTP has already been used"
    print("10. Re-using same OTP rejected: 'OTP has already been used'")

    # 11. Refresh Customer view -> Shows Verified status
    db.session.refresh(repair)
    cust_verified_dict = repair.otp.to_customer_dict()
    assert cust_verified_dict["is_used"] is True
    assert cust_verified_dict["status"] == "Verified"
    print("11. Customer view updated to 'Verified' upon refresh.")

    print("=== ALL START TRAVEL OTP TESTS PASSED SUCCESSFULLY! ===")
