from datetime import datetime, timezone
from app import db
from app.models.base import BaseModel


class Part(BaseModel):
    """Simple parts inventory. Stock is decremented atomically when used on a repair."""

    __tablename__ = "parts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, unique=True)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "unit_price": float(self.unit_price or 0),
            "stock_quantity": self.stock_quantity,
        }


class PartUsed(BaseModel):
    __tablename__ = "parts_used"

    id = db.Column(db.Integer, primary_key=True)
    repair_id = db.Column(db.Integer, db.ForeignKey("repair_requests.id"), nullable=False)
    part_id = db.Column(db.Integer, db.ForeignKey("parts.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)  # price snapshot at time of use
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    repair_request = db.relationship("RepairRequest", back_populates="parts_used")
    part = db.relationship("Part")

    @property
    def line_total(self):
        return float(self.quantity * self.unit_price)

    def to_dict(self):
        return {
            "id": self.id,
            "repair_id": self.repair_id,
            "part_id": self.part_id,
            "part_name": self.part.name if self.part else None,
            "quantity": self.quantity,
            "unit_price": float(self.unit_price or 0),
            "line_total": self.line_total,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
