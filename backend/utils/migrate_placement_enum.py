"""One-time migration: add 'placement_update' value to notificationtype enum."""
from sqlalchemy import text
from backend.database.connection import engine

with engine.connect() as conn:
    conn.execute(text("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'placement_update'"))
    conn.execute(text("COMMIT"))
    print("Migration complete: 'placement_update' added to notificationtype enum.")
