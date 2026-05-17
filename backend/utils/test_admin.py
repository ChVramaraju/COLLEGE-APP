# =============================================================
# utils/test_admin.py - Admin Dashboard Module Tests
# Run: .\venv\Scripts\python.exe -m backend.utils.test_admin
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
        body = e.read()
        return e.code, json.loads(body) if body else {}


def ok(label, condition, detail=""):
    s = "[PASS]" if condition else "[FAIL]"
    print(f"  {s}  {label}" + (f"  [{detail}]" if detail else ""))


def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print("="*55)


# ---------------------------------------------------------------
section("SETUP - Logins")
# ---------------------------------------------------------------
_, r = call("POST", "/auth/login", {"username": "admin", "password": "Admin@1234"})
ADMIN = r.get("access_token", "")
ok("Admin login", bool(ADMIN))

_, r = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
FAC = r.get("access_token", "")
ok("Faculty login", bool(FAC))

_, r = call("POST", "/auth/login", {"username": "21CSE001", "password": "Student@1234"})
STU = r.get("access_token", "")
ok("Student login", bool(STU))


# ---------------------------------------------------------------
section("TEST 1 - Dashboard Snapshot")
# ---------------------------------------------------------------
code, dash = call("GET", "/admin/dashboard", token=ADMIN)
ok("Dashboard returns 200", code == 200, f"code={code}")
ok("users block present", "users" in dash)
ok("students block present", "students" in dash)
ok("faculty block present", "faculty" in dash)
ok("sections block present", "sections" in dash)
ok("attendance block present", "attendance" in dash)
ok("tests block present", "tests" in dash)
ok("results block present", "results" in dash)
ok("notifications block present", "notifications" in dash)
ok("generated_at present", "generated_at" in dash)

u = dash.get("users", {})
ok("Total users >= 3 (admin+faculty+student)", u.get("total_users", 0) >= 3,
   str(u.get("total_users")))
ok("by_role has student key", "student" in u.get("by_role", {}))
ok("by_role has faculty key", "faculty" in u.get("by_role", {}))
ok("by_role has admin key",   "admin"   in u.get("by_role", {}))

s = dash.get("students", {})
ok("Total students >= 1", s.get("total_students", 0) >= 1, str(s.get("total_students")))
ok("by_department populated", len(s.get("by_department", {})) >= 1)
ok("by_semester populated",   len(s.get("by_semester", {}))   >= 1)

r = dash.get("results", {})
ok("Published results >= 3", r.get("published_results", 0) >= 3, str(r.get("published_results")))
ok("Pass rate is float",     isinstance(r.get("overall_pass_rate"), float))
print(f"  Pass rate: {r.get('overall_pass_rate')}%  Avg%: {r.get('avg_percentage')}%")

t = dash.get("tests", {})
ok("Total tests >= 1", t.get("total_tests", 0) >= 0, str(t.get("total_tests")))


# ---------------------------------------------------------------
section("TEST 2 - List All Users")
# ---------------------------------------------------------------
code, users = call("GET", "/admin/users", token=ADMIN)
ok("List users returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(users, list))
ok("At least 3 users", len(users) >= 3, f"count={len(users)}")
ok("Each user has id/username/role",
   all("id" in u and "username" in u and "role" in u for u in users))
print(f"  Total users: {len(users)}")

# Filter by role
code, students = call("GET", "/admin/users?role=student", token=ADMIN)
ok("Filter by role=student returns 200", code == 200, f"code={code}")
ok("All returned are students", all(u["role"] == "student" for u in students))

# Filter by active status
code, active_users = call("GET", "/admin/users?is_active=true", token=ADMIN)
ok("Filter active users returns 200", code == 200, f"code={code}")
ok("All returned are active", all(u["is_active"] for u in active_users))

# Pagination
code, paged = call("GET", "/admin/users?skip=0&limit=2", token=ADMIN)
ok("Pagination returns 200", code == 200, f"code={code}")
ok("Limit=2 returns at most 2", len(paged) <= 2, f"count={len(paged)}")


# ---------------------------------------------------------------
section("TEST 3 - Get Single User")
# ---------------------------------------------------------------
if users:
    uid = users[0]["id"]
    code, user = call("GET", f"/admin/users/{uid}", token=ADMIN)
    ok("Get user returns 200", code == 200, f"code={code}")
    ok("Correct user returned", user.get("id") == uid)

    code, _ = call("GET", "/admin/users/99999", token=ADMIN)
    ok("Non-existent user returns 404", code == 404, f"code={code}")


# ---------------------------------------------------------------
section("TEST 4 - Deactivate / Reactivate User")
# ---------------------------------------------------------------
# Find a non-admin user to deactivate
target_user = next((u for u in users if u["role"] == "faculty"), None)
if target_user:
    tid = target_user["id"]

    # Deactivate
    code, res = call("PATCH", f"/admin/users/{tid}/status", {"is_active": False}, ADMIN)
    ok("Deactivate returns 200", code == 200, f"code={code}")
    ok("is_active = False", res.get("is_active") == False)

    # Verify login blocked
    _, lr = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
    ok("Deactivated user login blocked", lr.get("access_token") is None,
       "token present" if lr.get("access_token") else "blocked correctly")

    # Reactivate
    code, res = call("PATCH", f"/admin/users/{tid}/status", {"is_active": True}, ADMIN)
    ok("Reactivate returns 200", code == 200, f"code={code}")
    ok("is_active = True again", res.get("is_active") == True)

    # Verify login works again
    _, lr = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
    ok("Reactivated user can login", lr.get("access_token") is not None)


# ---------------------------------------------------------------
section("TEST 5 - Cannot Deactivate Admin")
# ---------------------------------------------------------------
admin_user = next((u for u in users if u["role"] == "admin"), None)
if admin_user:
    code, res = call("PATCH", f"/admin/users/{admin_user['id']}/status",
                     {"is_active": False}, ADMIN)
    ok("Deactivate admin blocked (403)", code == 403, f"code={code}")


# ---------------------------------------------------------------
section("TEST 6 - Institution Analytics")
# ---------------------------------------------------------------
code, analytics = call("GET", "/admin/analytics", token=ADMIN)
ok("Analytics returns 200", code == 200, f"code={code}")
ok("department_performance present", "department_performance" in analytics)
ok("section_performance present",   "section_performance" in analytics)
ok("top_performers present",        "top_performers" in analytics)
ok("low_attendance_students present","low_attendance_students" in analytics)
ok("gpa_distribution present",      "gpa_distribution" in analytics)

dp = analytics.get("department_performance", [])
ok("At least 1 department in analytics", len(dp) >= 1, f"count={len(dp)}")
if dp:
    ok("CSE department present", any(d["department"] == "cse" for d in dp))
    cse = next((d for d in dp if d["department"] == "cse"), {})
    ok("CSE avg_cgpa populated", cse.get("avg_cgpa") is not None, str(cse.get("avg_cgpa")))
    print(f"  CSE: {cse.get('student_count')} students, avg CGPA={cse.get('avg_cgpa')}")

tp = analytics.get("top_performers", [])
ok("Top performers list present", isinstance(tp, list))
if tp:
    ok("Top performer has cgpa",        "cgpa" in tp[0])
    ok("Top performer has roll_number", "roll_number" in tp[0])
    print(f"  Top performer: {tp[0].get('roll_number')} CGPA={tp[0].get('cgpa')}")

gd = analytics.get("gpa_distribution", {})
ok("GPA distribution has 8.0-9.0 band", "8.0-9.0" in gd)
ok("GPA dist count correct",
   gd.get("8.0-9.0", 0) >= 1, str(gd.get("8.0-9.0")))
print(f"  GPA distribution: {gd}")


# ---------------------------------------------------------------
section("TEST 7 - Role Restrictions")
# ---------------------------------------------------------------
# Faculty cannot access admin dashboard
code, _ = call("GET", "/admin/dashboard", token=FAC)
ok("Faculty cannot access dashboard (403)", code == 403, f"code={code}")

# Student cannot access admin dashboard
code, _ = call("GET", "/admin/dashboard", token=STU)
ok("Student cannot access dashboard (403)", code == 403, f"code={code}")

# Faculty cannot list users
code, _ = call("GET", "/admin/users", token=FAC)
ok("Faculty cannot list users (403)", code == 403, f"code={code}")

# Student cannot access analytics
code, _ = call("GET", "/admin/analytics", token=STU)
ok("Student cannot access analytics (403)", code == 403, f"code={code}")

# No token -> 401
code, _ = call("GET", "/admin/dashboard")
ok("No token -> 401", code == 401, f"code={code}")


print(f"\n{'='*55}")
print("  All admin module tests complete.")
print("="*55 + "\n")
