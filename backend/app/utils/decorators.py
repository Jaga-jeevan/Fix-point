from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

from app import db
from app.models.user import User


def role_required(*allowed_roles):
    """
    Restricts a route to one or more roles.

    Usage:
        @role_required("ADMIN")
        @role_required("ADMIN", "TECHNICIAN")
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()  # raises -> caught by JWT error handlers -> 401
            claims = get_jwt()
            role = claims.get("role")
            if role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "message": "You are not authorized to perform this action",
                }), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def get_current_user():
    """Call only from inside a route already protected by verify_jwt_in_request."""
    from flask_jwt_extended import get_jwt_identity

    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))
