import json
from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel

QUOTATION_STATUSES = ("DRAFT", "SENT", "APPROVED", "REJECTED", "REVISION_REQUESTED", "REVISED_SENT")


class Quotation(BaseModel):
    __tablename__ = "quotations"

    id = db.Column(db.Integer, primary_key=True)
    repair_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), unique=True, nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"), nullable=False)
    diagnosis = db.Column(db.Text, nullable=True)
    labour_cost = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    discount = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    status = db.Column(db.String(30), default="DRAFT", nullable=False)
    revision_reason = db.Column(db.String(150), nullable=True)
    revision_message = db.Column(db.Text, nullable=True)
    version = db.Column(db.Integer, default=1, nullable=False)
    payment_status = db.Column(db.String(30), default="UNPAID", nullable=False)
    payment_method = db.Column(db.String(50), default="UPI_QR", nullable=True)
    utr = db.Column(db.String(100), nullable=True)
    payment_date = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    repair_request = db.relationship("RepairRequest", back_populates="quotation")
    technician = db.relationship("Technician")
    items = db.relationship(
        "QuotationItem", back_populates="quotation", cascade="all, delete-orphan"
    )
    history = db.relationship(
        "QuotationHistory",
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="QuotationHistory.version.desc()",
    )

    @property
    def parts_total(self):
        return sum((item.quantity * item.unit_price for item in self.items), 0)

    @property
    def total_amount(self):
        subtotal = float(self.parts_total) + float(self.labour_cost or 0)
        final_amt = subtotal - float(self.discount or 0)
        return max(0.0, final_amt)

    def to_dict(self):
        return {
            "id": self.id,
            "repair_id": self.repair_id,
            "technician_id": self.technician_id,
            "diagnosis": self.diagnosis,
            "labour_cost": float(self.labour_cost or 0),
            "discount": float(self.discount or 0),
            "status": self.status,
            "revision_reason": self.revision_reason,
            "revision_message": self.revision_message,
            "version": self.version or 1,
            "payment_status": self.payment_status or "UNPAID",
            "payment_method": self.payment_method or "UPI_QR",
            "utr": self.utr,
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "verified_by_id": self.verified_by_id,
            "items": [item.to_dict() for item in self.items],
            "parts_total": float(self.parts_total),
            "total_amount": self.total_amount,
            "history": [h.to_dict() for h in self.history] if self.history else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class QuotationItem(BaseModel):
    __tablename__ = "quotation_items"

    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey("quotations.id"), nullable=False)
    part_name = db.Column(db.String(150), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    quotation = db.relationship("Quotation", back_populates="items")

    def to_dict(self):
        return {
            "id": self.id,
            "quotation_id": self.quotation_id,
            "part_name": self.part_name,
            "quantity": self.quantity,
            "unit_price": float(self.unit_price or 0),
            "line_total": float(self.quantity * self.unit_price),
        }


class QuotationHistory(BaseModel):
    __tablename__ = "quotation_histories"

    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey("quotations.id"), nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    diagnosis = db.Column(db.Text, nullable=True)
    labour_cost = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    discount = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    items_json = db.Column(db.Text, nullable=True)  # JSON array of item snapshots
    revision_reason = db.Column(db.String(150), nullable=True)
    revision_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    quotation = db.relationship("Quotation", back_populates="history")

    def to_dict(self):
        parsed_items = []
        if self.items_json:
            try:
                parsed_items = json.loads(self.items_json)
            except Exception:
                parsed_items = []
        return {
            "id": self.id,
            "quotation_id": self.quotation_id,
            "version": self.version,
            "diagnosis": self.diagnosis,
            "labour_cost": float(self.labour_cost or 0),
            "discount": float(self.discount or 0),
            "total_amount": float(self.total_amount or 0),
            "items": parsed_items,
            "revision_reason": self.revision_reason,
            "revision_message": self.revision_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

