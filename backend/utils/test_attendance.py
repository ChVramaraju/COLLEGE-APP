# =============================================================
# utils/test_attendance.py - Attendance Module Test
# =============================================================
# Run: .\venv\Scripts\python.exe -m backend.utils.test_attendance
# =============================================================

import urllib.request
import urllib.error
import json
from datetime import date

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


def ok(label, condition, detail=""):
    status = "[PASS]" if condition else "[FAIL]"
    print(f"  {status}  {label}" + (f"  [{detail}]" if detail else ""))


def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print("="*50)


# Login all roles
section("SETUP - Login all roles")
_, res = call("POST", "/auth/login", {"username": "admin", "password": "Admin@1234"})
ADMIN = res.get("access_token", "")
ok("Admin login", bool(ADMIN))

_, res = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
FAC = res.get("access_token", "")
ok("Faculty login", bool(FAC))

_, res = call("POST", "/auth/login", {"username": "21CSE001", "password": "Student@1234"})
STU = res.get("access_token", "")
ok("Student login", bool(STU))


# Mark bulk attendance
section("TEST 1 - Mark Bulk Attendance (Faculty)")
TODAY = str(date.today())
code, res = call("POST", "/attendance/mark", {
    "section_id": 1,
    "subject": "Data Structures",
    "attendance_date": TODAY,
    "period_number": 2,
    "entries": [
        {"student_id": 1, "status": "present", "remarks": "On time"}
    ]
}, FAC)
ok("Bulk mark returns 201", code == 201, f"code={code}")
ok("Records created = 1", res.get("records_created") == 1, str(res.get("records_created")))
ok("Present count = 1", res.get("present_count") == 1)
ok("Subject normalized", res.get("subject") == "Data Structures", res.get("subject"))


# Duplicate prevention
section("TEST 2 - Duplicate Attendance Prevention (409)")
code, res = call("POST", "/attendance/mark", {
    "section_id": 1, "subject": "Data Structures",
    "attendance_date": TODAY, "period_number": 2,
    "entries": [{"student_id": 1, "status": "absent"}]
}, FAC)
ok("Duplicate returns 409", code == 409, f"code={code}")
ok("Error detail present", "detail" in res, res.get("detail", "")[:60])


# Future date validation
section("TEST 3 - Future Date Validation (422)")
code, res = call("POST", "/attendance/mark", {
    "section_id": 1, "subject": "Mathematics",
    "attendance_date": "2099-12-31", "period_number": 1,
    "entries": [{"student_id": 1, "status": "present"}]
}, FAC)
ok("Future date returns 422", code == 422, f"code={code}")


# Mark a second subject (different period)
section("TEST 4 - Mark Second Subject Same Day (Period 3)")
code, res = call("POST", "/attendance/mark", {
    "section_id": 1, "subject": "Mathematics",
    "attendance_date": TODAY, "period_number": 3,
    "entries": [{"student_id": 1, "status": "absent", "remarks": "Sick leave"}]
}, FAC)
ok("Second subject marked 201", code == 201, f"code={code}")


# Student views own attendance
section("TEST 5 - Student Views Own Attendance")
code, res = call("GET", "/attendance/me", token=STU)
ok("Student /me returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(res, list))
ok("2 records (2 subjects)", len(res) == 2, f"count={len(res) if isinstance(res, list) else 0}")


# Student filters by subject
section("TEST 6 - Student Filters Attendance by Subject")
code, res = call("GET", "/attendance/me?subject=Data+Structures", token=STU)
ok("Filtered by subject returns 200", code == 200, f"code={code}")
ok("Only 1 record returned", len(res) == 1 if isinstance(res, list) else False,
   f"count={len(res) if isinstance(res, list) else 0}")


# Student analytics
section("TEST 7 - Student Attendance Analytics")
code, res = call("GET", "/attendance/me/analytics", token=STU)
ok("Analytics returns 200", code == 200, f"code={code}")
ok("Roll number present", res.get("roll_number") == "21CSE001")
ok("Overall percentage calculated", isinstance(res.get("overall_percentage"), float),
   str(res.get("overall_percentage")))
ok("Subject breakdown has 2 subjects", len(res.get("subject_breakdown", [])) == 2,
   f"count={len(res.get('subject_breakdown', []))}")
ok("Data Structures: 100%",
   any(s["subject"] == "Data Structures" and s["percentage"] == 100.0
       for s in res.get("subject_breakdown", [])))
ok("Mathematics: 0%",
   any(s["subject"] == "Mathematics" and s["percentage"] == 0.0
       for s in res.get("subject_breakdown", [])))


# Admin views section analytics
section("TEST 8 - Section Analytics (Admin)")
code, res = call("GET", "/attendance/analytics/section/1", token=ADMIN)
ok("Section analytics returns 200", code == 200, f"code={code}")
ok("Total students", res.get("total_students") == 1, str(res.get("total_students")))
ok("Avg percentage calculated", isinstance(res.get("average_attendance_percentage"), float),
   str(res.get("average_attendance_percentage")))


# Low attendance alerts
section("TEST 9 - Low Attendance Alerts")
code, res = call("GET", "/attendance/analytics/low/1?threshold=75", token=ADMIN)
ok("Low attendance returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(res, list))
# Student has 1 present + 1 absent = 50% → below 75%
ok("Student flagged as low attendance", len(res) == 1 if isinstance(res, list) else False,
   f"count={len(res) if isinstance(res, list) else 0}")
if isinstance(res, list) and len(res) > 0:
    ok("Classes needed calculated", "classes_needed_to_reach_75" in res[0])
    ok("Percentage shown", res[0].get("overall_percentage") == 50.0,
       str(res[0].get("overall_percentage")))


# Role restrictions
section("TEST 10 - Role Restrictions")
code, _ = call("POST", "/attendance/mark", {
    "section_id": 1, "subject": "Test", "attendance_date": TODAY,
    "period_number": 5, "entries": [{"student_id": 1, "status": "present"}]
}, STU)
ok("Student cannot mark attendance (403)", code == 403, f"code={code}")

code, _ = call("GET", "/attendance/student/1", token=STU)
ok("Student cannot view others attendance (403)", code == 403, f"code={code}")

code, _ = call("GET", "/attendance/me", token=FAC)
ok("Faculty cannot use student /me route (403)", code == 403, f"code={code}")

code, _ = call("GET", "/attendance/analytics/section/1")
ok("No token returns 401", code == 401, f"code={code}")


print(f"\n{'='*50}")
print("  All attendance tests complete.")
print("="*50 + "\n")
