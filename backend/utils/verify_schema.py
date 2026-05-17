# =============================================================
# utils/verify_schema.py — Database Schema Verification Tool
# =============================================================
# Run with:
#   .\venv\Scripts\python.exe -m backend.utils.verify_schema
# =============================================================
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import inspect
from backend.database.connection import engine


def verify_schema():
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    print("\n" + "="*55)
    print("  Smart College Ecosystem - Schema Verification")
    print("="*55)

    print(f"\n  TABLES FOUND ({len(tables)}):")
    for t in sorted(tables):
        cols = inspector.get_columns(t)
        print(f"\n  [{t}]  ({len(cols)} columns)")
        for c in cols:
            nullable = "NULL" if c["nullable"] else "NOT NULL"
            print(f"    - {c['name']:25s} {str(c['type']):20s} {nullable}")

    print("\n  FOREIGN KEYS:")
    for t in sorted(tables):
        fks = inspector.get_foreign_keys(t)
        for fk in fks:
            src_cols = ", ".join(fk["constrained_columns"])
            ref_table = fk["referred_table"]
            ref_cols = ", ".join(fk["referred_columns"])
            print(f"    {t}.{src_cols}  -->  {ref_table}.{ref_cols}")

    print("\n  UNIQUE CONSTRAINTS:")
    for t in sorted(tables):
        uqs = inspector.get_unique_constraints(t)
        for uq in uqs:
            cols = ", ".join(uq["column_names"])
            print(f"    {t}: UNIQUE({cols})  [{uq['name']}]")

    print("\n" + "="*55 + "\n")


if __name__ == "__main__":
    verify_schema()
