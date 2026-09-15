from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app import db
from app.models.notification import Notification

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/notifications", methods=["GET"])
def list_notifications():
    verify_jwt_in_request()
    user_id = int(get_jwt_identity())

    notifications = (
        Notification.query.filter_by(user_id=user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).count()

    return jsonify({
        "success": True,
        "notifications": [n.to_dict() for n in notifications],
        "unread_count": unread_count,
    }), 200


@notifications_bp.route("/notifications/<int:notification_id>/read", methods=["PATCH"])
def mark_read(notification_id):
    verify_jwt_in_request()
    user_id = int(get_jwt_identity())

    notification = db.session.get(Notification, notification_id)
    if not notification:
        return jsonify({"success": False, "message": "Notification not found"}), 404
    if notification.user_id != user_id:
        return jsonify({"success": False, "message": "You are not authorized to update this notification"}), 403

    notification.is_read = True
    db.session.commit()
    return jsonify({"success": True, "notification": notification.to_dict()}), 200


@notifications_bp.route("/notifications/read-all", methods=["PATCH"])
def mark_all_read():
    verify_jwt_in_request()
    user_id = int(get_jwt_identity())

    Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"success": True}), 200
