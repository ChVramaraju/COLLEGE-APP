# =============================================================
# utils/test_flow.py - Full ERP API Flow Test
# =============================================================
# Automated end-to-end test of the entire route layer.
# Run with:
#   .\venv\Scripts\python.exe -m backend.utils.test_flow
# =============================================================

import urllib.request
import urllib.error
import json

BASE = "http://127.0.0.1:8000"


def call(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print('='*55)


def ok(label, condition, detail=""):
    status = "[PASS]" if condition else "[FAIL]"
    print(f"  {status}  {label}" + (f"  [{detail}]" if detail else ""))


# ---------------------------------------------
section("TEST 1 - Admin Login")
# ---------------------------------------------
code, res = call("POST", "/auth/login", {"username": "admin", "password": "Admin@1234"})
ok("Admin login returns 200", code == 200, f"code={code}")
ok("Token present", "access_token" in res)
ok("Role is admin", res.get("role") == "admin")
ADMIN_TOKEN = res.get("access_token", "")
print(f"  Token: {ADMIN_TOKEN[:40]}...")

# ---------------------------------------------
section("TEST 2 - Create Section")
# ---------------------------------------------
code, res = call("POST", "/sections/", {
    "name": "A",
    "department": "cse",
    "semester": 3,
    "academic_year": "2024-25",
    "max_strength": 60
}, ADMIN_TOKEN)
ok("Create section returns 201", code == 201, f"code={code}")
ok("Section has id", "id" in res, f"id={res.get('id')}")
SECTION_ID = res.get("id")
print(f"  Section ID: {SECTION_ID}")

# ---------------------------------------------
section("TEST 3 - Duplicate Section (Conflict)")
# ---------------------------------------------
code, res = call("POST", "/sections/", {
    "name": "A", "department": "cse",
    "semester": 3, "academic_year": "2024-25"
}, ADMIN_TOKEN)
ok("Duplicate section returns 409", code == 409, f"code={code}")
ok("Error message present", "detail" in res, res.get("detail", ""))

# ---------------------------------------------
section("TEST 4 - Create Faculty")
# ---------------------------------------------
code, res = call("POST", "/faculty/", {
    "full_name": "Dr. Ananya Sharma",
    "email": "ananya@college.edu",
    "password": "Faculty@1234",
    "employee_id": "FAC2024001",
    "department": "cse",
    "designation": "asst_prof",
    "specialization": "Machine Learning"
}, ADMIN_TOKEN)
ok("Create faculty returns 201", code == 201, f"code={code}")
ok("Faculty has id", "id" in res, f"id={res.get('id')}")
FACULTY_ID = res.get("id")
print(f"  Faculty ID: {FACULTY_ID}")

# ---------------------------------------------
section("TEST 5 - Assign Faculty to Section")
# ---------------------------------------------
code, res = call(
    "POST",
    f"/sections/{SECTION_ID}/assign-faculty?faculty_id={FACULTY_ID}",
    token=ADMIN_TOKEN
)
ok("Assign faculty returns 200", code == 200, f"code={code}")
ok("Section incharge updated", res.get("incharge_faculty_id") == FACULTY_ID,
   f"incharge_faculty_id={res.get('incharge_faculty_id')}")

# ---------------------------------------------
section("TEST 6 - Create Student")
# ---------------------------------------------
code, res = call("POST", "/students/", {
    "full_name": "Ravi Kumar",
    "email": "ravi@student.college.edu",
    "password": "Student@1234",
    "roll_number": "21CSE001",
    "department": "cse",
    "semester": 3,
    "admission_year": 2021,
    "section_id": SECTION_ID,
    "phone": "9876543210",
    "guardian_name": "Suresh Kumar"
}, ADMIN_TOKEN)
ok("Create student returns 201", code == 201, f"code={code}")
ok("Student has id", "id" in res, f"id={res.get('id')}")
STUDENT_ID = res.get("id")
print(f"  Student ID: {STUDENT_ID}")

# ---------------------------------------------
section("TEST 7 - Duplicate Roll Number (Conflict)")
# ---------------------------------------------
code, res = call("POST", "/students/", {
    "full_name": "Duplicate Test", "password": "Test@1234",
    "roll_number": "21CSE001", "department": "cse",
    "semester": 3, "admission_year": 2021
}, ADMIN_TOKEN)
ok("Duplicate roll number returns 409", code == 409, f"code={code}")
ok("Error message present", "detail" in res, res.get("detail", ""))

# ---------------------------------------------
section("TEST 8 - Student Login + View Own Profile")
# ---------------------------------------------
code, res = call("POST", "/auth/login", {"username": "21CSE001", "password": "Student@1234"})
ok("Student login returns 200", code == 200, f"code={code}")
ok("Role is student", res.get("role") == "student")
STUDENT_TOKEN = res.get("access_token", "")

code, res = call("GET", "/students/me", token=STUDENT_TOKEN)
ok("Student /me returns 200", code == 200, f"code={code}")
ok("Roll number matches", res.get("roll_number") == "21CSE001", res.get("roll_number"))
ok("Section embedded", res.get("section") is not None)
ok("Password NOT in response", "password" not in res and "hashed_password" not in res)

# ---------------------------------------------
section("TEST 9 - Faculty Login + View Own Sections")
# ---------------------------------------------
code, res = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
ok("Faculty login returns 200", code == 200, f"code={code}")
ok("Role is faculty", res.get("role") == "faculty")
FACULTY_TOKEN = res.get("access_token", "")

code, res = call("GET", "/faculty/me/sections", token=FACULTY_TOKEN)
ok("Faculty /me/sections returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(res, list))
ok("Section A visible", any(s.get("name") == "A" for s in res) if isinstance(res, list) else False)

# ---------------------------------------------
section("TEST 10 - Section Roster via Faculty Token")
# ---------------------------------------------
code, res = call("GET", f"/sections/{SECTION_ID}/students", token=FACULTY_TOKEN)
ok("Section roster returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(res, list))
ok("Student 21CSE001 in roster",
   any(s.get("roll_number") == "21CSE001" for s in res) if isinstance(res, list) else False)

# ---------------------------------------------
section("TEST 11 - Role Restriction Tests")
# ---------------------------------------------
# Student tries to create a section (should fail 403)
code, res = call("POST", "/sections/", {
    "name": "B", "department": "cse",
    "semester": 3, "academic_year": "2024-25"
}, STUDENT_TOKEN)
ok("Student cannot create section (403)", code == 403, f"code={code}")

# Faculty tries to create a student (should fail 403)
code, res = call("POST", "/students/", {
    "full_name": "Hack", "password": "Test@123",
    "roll_number": "HACK001", "department": "cse",
    "semester": 1, "admission_year": 2024
}, FACULTY_TOKEN)
ok("Faculty cannot create student (403)", code == 403, f"code={code}")

# ---------------------------------------------
section("TEST 12 - Invalid/No Token (401)")
# ---------------------------------------------
code, res = call("GET", "/students/me", token="invalid.token.here")
ok("Invalid token returns 401", code == 401, f"code={code}")

code, res = call("GET", "/students/")
ok("No token on protected route returns 401", code == 401, f"code={code}")

# ---------------------------------------------
section("TEST 13 - Section Full Detail")
# ---------------------------------------------
code, res = call("GET", f"/sections/{SECTION_ID}/full", token=ADMIN_TOKEN)
ok("Section full detail returns 200", code == 200, f"code={code}")
ok("Incharge faculty present", res.get("incharge_faculty") is not None)
ok("Students list present", isinstance(res.get("students"), list))
ok("Student count > 0", len(res.get("students", [])) > 0,
   f"count={len(res.get('students', []))}")

print(f"\n{'='*55}")
print("  All tests complete.")
print(f"{'='*55}\n")
