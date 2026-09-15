from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, verify_jwt_in_request, get_jwt_identity

from app import db
from app.models.user import User, ROLES
from app.models.technician import Technician

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "CUSTOMER").strip().upper()

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email and password are required"}), 400

    if role not in ROLES:
        return jsonify({"success": False, "message": "Invalid role"}), 400

    # Public registration is only for customers and technicians.
    # (Admins should be created via the seed script, not the public API.)
    if role == "ADMIN":
        return jsonify({"success": False, "message": "Cannot self-register as ADMIN"}), 403

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "message": "An account with this email already exists"}), 400

    user = User(name=name, email=email, phone=phone, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id before commit

    if role == "TECHNICIAN":
        technician = Technician(
            user_id=user.id,
            skills=data.get("skills", ""),
            service_area=data.get("service_area", ""),
            availability_status="AVAILABLE",
        )
        db.session.add(technician)

    db.session.commit()

    return jsonify({"success": True, "message": "Account created", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "email": user.email},
    )

    return jsonify({
        "access_token": access_token,
        "user": user.to_dict(),
    }), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    verify_jwt_in_request()
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    return jsonify({"success": True, "user": user.to_dict()}), 200
