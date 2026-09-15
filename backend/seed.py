"""
Seeds the database with development test accounts:
  1 Admin
  2 Technicians
  1 Customer

Run with:  python seed.py

IMPORTANT: these are development credentials only.
Change them (or remove this script) before deploying to production.
"""

from app import create_app, db
from app.models.user import User
from app.models.technician import Technician
from app.models.part import Part

app = create_app()

SEED_PARTS = [
    {"name": "Power IC", "unit_price": 800, "stock_quantity": 15},
    {"name": "Capacitor", "unit_price": 50, "stock_quantity": 100},
    {"name": "SSD 256GB", "unit_price": 2200, "stock_quantity": 10},
    {"name": "Laptop Battery", "unit_price": 1800, "stock_quantity": 8},
    {"name": "Mobile Display", "unit_price": 1500, "stock_quantity": 12},
    {"name": "Charging Port", "unit_price": 300, "stock_quantity": 25},
]

SEED_USERS = [
    {"name": "Admin User", "email": "admin@example.com", "phone": "9000000001",
     "password": "Admin@123", "role": "ADMIN"},
    {"name": "Ravi Kumar", "email": "tech1@example.com", "phone": "9000000002",
     "password": "Tech@123", "role": "TECHNICIAN",
     "skills": "Laptop, Desktop repair", "service_area": "Chennai Central"},
    {"name": "Suresh Babu", "email": "tech2@example.com", "phone": "9000000003",
     "password": "Tech@123", "role": "TECHNICIAN",
     "skills": "Mobile, Tablet repair", "service_area": "Chennai South"},
    {"name": "Anita Sharma", "email": "customer@example.com", "phone": "9000000004",
     "password": "Customer@123", "role": "CUSTOMER"},
]


def run_seed():
    with app.app_context():
        db.create_all()

        for entry in SEED_USERS:
            existing = User.query.filter_by(email=entry["email"]).first()
            if existing:
                print(f"Skipping {entry['email']} (already exists)")
                continue

            user = User(
                name=entry["name"],
                email=entry["email"],
                phone=entry["phone"],
                role=entry["role"],
            )
            user.set_password(entry["password"])
            db.session.add(user)
            db.session.flush()

            if entry["role"] == "TECHNICIAN":
                technician = Technician(
                    user_id=user.id,
                    skills=entry.get("skills", ""),
                    service_area=entry.get("service_area", ""),
                    availability_status="AVAILABLE",
                )
                db.session.add(technician)

            print(f"Created {entry['role']}: {entry['email']} / {entry['password']}")

        for part_entry in SEED_PARTS:
            existing_part = Part.query.filter_by(name=part_entry["name"]).first()
            if existing_part:
                print(f"Skipping part {part_entry['name']} (already exists)")
                continue
            db.session.add(Part(**part_entry))
            print(f"Added part: {part_entry['name']} (stock: {part_entry['stock_quantity']})")

        db.session.commit()
        print("\nSeeding complete.")


if __name__ == "__main__":
    run_seed()
