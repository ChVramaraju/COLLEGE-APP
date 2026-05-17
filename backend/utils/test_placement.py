# =============================================================
# utils/test_placement.py - Placement Module Tests
# Run: .\venv\Scripts\python.exe -m backend.utils.test_placement
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

_, prof = call("GET", "/students/me", token=STU)
STUDENT_ID = prof.get("id")
print(f"  Student profile ID: {STUDENT_ID}")


# ---------------------------------------------------------------
section("SETUP CLEANUP - Delete prior-run applications for test student")
# ---------------------------------------------------------------
_, prior_apps = call("GET", f"/placement/admin/student/{STUDENT_ID}", token=ADMIN)
prior_apps = prior_apps if isinstance(prior_apps, list) else []
deleted = []
for a in prior_apps:
    dc, _ = call("DELETE", f"/placement/applications/{a['id']}", token=ADMIN)
    if dc == 200:
        deleted.append(a["id"])
print(f"  Deleted {len(deleted)} prior applications: {deleted}")


# ---------------------------------------------------------------
section("TEST 1 - Create Job Postings (Admin)")
# ---------------------------------------------------------------
code, p1 = call("POST", "/placement/postings/", {
    "company_name": "TechCorp Pvt Ltd",
    "role_title": "Software Engineer",
    "description": "Backend development role",
    "location": "Bangalore",
    "package_lpa": 8.5,
    "allowed_departments": "cse,it",
    "min_cgpa": 7.0,
    "min_attendance_pct": 75.0,
}, ADMIN)
ok("Create posting 1 returns 201", code == 201, f"code={code}")
ok("Company name correct", p1.get("company_name") == "TechCorp Pvt Ltd")
ok("Package 8.5 LPA stored", p1.get("package_lpa") == 8.5)
ok("min_cgpa stored", p1.get("min_cgpa") == 7.0)
ok("is_open = True", p1.get("is_open") == True)
ok("is_active = True", p1.get("is_active") == True)
POSTING_ID_1 = p1.get("id")
print(f"  TechCorp posting ID: {POSTING_ID_1}")

# Create a second posting — lower requirements (student definitely eligible)
code, p2 = call("POST", "/placement/postings/", {
    "company_name": "DataSoft Solutions",
    "role_title": "Data Analyst",
    "location": "Chennai",
    "package_lpa": 6.0,
    "allowed_departments": "cse",
    "min_cgpa": 6.0,
    "min_attendance_pct": 0.0,
}, ADMIN)
ok("Create posting 2 (DataSoft) returns 201", code == 201, f"code={code}")
POSTING_ID_2 = p2.get("id")
print(f"  DataSoft posting ID: {POSTING_ID_2}")

# Create a posting the student is NOT eligible for (ECE only)
code, p3 = call("POST", "/placement/postings/", {
    "company_name": "CircuitBoard Inc",
    "role_title": "Hardware Engineer",
    "allowed_departments": "ece,eee",
    "min_cgpa": 6.0,
    "min_attendance_pct": 0.0,
    "package_lpa": 5.0,
}, ADMIN)
ok("Create posting 3 (ECE only) returns 201", code == 201, f"code={code}")
POSTING_ID_3 = p3.get("id")


# ---------------------------------------------------------------
section("TEST 2 - List Postings (All roles)")
# ---------------------------------------------------------------
code, postings = call("GET", "/placement/postings/", token=ADMIN)
ok("Admin lists postings (200)", code == 200, f"code={code}")
ok("At least 3 postings", len(postings) >= 3, f"count={len(postings)}")
ok("total_applications field present", "total_applications" in postings[0])

# Student gets eligibility flag
code, stu_postings = call("GET", "/placement/postings/", token=STU)
ok("Student lists postings (200)", code == 200, f"code={code}")
ok("is_eligible field present for student", "is_eligible" in stu_postings[0])
# CSE student with CGPA=8.0 should be eligible for DataSoft (min 6.0 CSE)
datasoft = next((p for p in stu_postings if p["company_name"] == "DataSoft Solutions"), None)
ok("Student eligible for DataSoft", datasoft and datasoft.get("is_eligible") == True,
   str(datasoft.get("is_eligible") if datasoft else "not found"))
# CSE student NOT eligible for ECE-only posting
circuit = next((p for p in stu_postings if p["company_name"] == "CircuitBoard Inc"), None)
ok("Student NOT eligible for CircuitBoard (ECE only)",
   circuit and circuit.get("is_eligible") == False,
   str(circuit.get("is_eligible") if circuit else "not found"))


# ---------------------------------------------------------------
section("TEST 3 - Single Posting Detail")
# ---------------------------------------------------------------
code, detail = call("GET", f"/placement/postings/{POSTING_ID_1}", token=STU)
ok("Get posting detail returns 200", code == 200, f"code={code}")
ok("Correct company", detail.get("company_name") == "TechCorp Pvt Ltd")
ok("is_eligible present", "is_eligible" in detail)
print(f"  Student eligible for TechCorp: {detail.get('is_eligible')}")


# ---------------------------------------------------------------
section("TEST 4 - Student Applies to Jobs")
# ---------------------------------------------------------------
code, app1 = call("POST", "/placement/apply", {"job_posting_id": POSTING_ID_2}, STU)
ok("Apply to DataSoft returns 201", code == 201, f"code={code}")
ok("Status = applied", app1.get("status") == "applied")
ok("Company name in response", app1.get("company_name") == "DataSoft Solutions")
ok("roll_number in response", app1.get("roll_number") == "21CSE001")
APP_ID_1 = app1.get("id")
print(f"  Application ID: {APP_ID_1}")


# ---------------------------------------------------------------
section("TEST 5 - Duplicate Application Rejected (409)")
# ---------------------------------------------------------------
code, res = call("POST", "/placement/apply", {"job_posting_id": POSTING_ID_2}, STU)
ok("Duplicate application returns 409", code == 409, f"code={code}")
ok("Detail message present", "detail" in res)


# ---------------------------------------------------------------
section("TEST 6 - Ineligible Application Rejected (403)")
# ---------------------------------------------------------------
code, res = call("POST", "/placement/apply", {"job_posting_id": POSTING_ID_3}, STU)
ok("ECE-only job rejected for CSE student (403)", code == 403, f"code={code}")
ok("Not eligible detail present", "detail" in res)
print(f"  Rejection reason: {res.get('detail')}")


# ---------------------------------------------------------------
section("TEST 7 - Student Views Own Applications")
# ---------------------------------------------------------------
code, my_apps = call("GET", "/placement/applications/me", token=STU)
ok("My applications returns 200", code == 200, f"code={code}")
ok("1 application visible", len(my_apps) == 1, f"count={len(my_apps)}")
ok("DataSoft application present",
   any(a["company_name"] == "DataSoft Solutions" for a in my_apps))


# ---------------------------------------------------------------
section("TEST 8 - Admin Updates Application Status")
# ---------------------------------------------------------------
code, updated = call("PATCH", f"/placement/applications/{APP_ID_1}/status", {
    "status": "under_review",
    "remarks": "Resume looks good"
}, ADMIN)
ok("Status update to under_review (200)", code == 200, f"code={code}")
ok("Status = under_review", updated.get("status") == "under_review")
ok("Remarks saved", updated.get("remarks") == "Resume looks good")

code, updated = call("PATCH", f"/placement/applications/{APP_ID_1}/status", {
    "status": "shortlisted"
}, ADMIN)
ok("Status update to shortlisted (200)", code == 200, f"code={code}")
ok("Status = shortlisted", updated.get("status") == "shortlisted")


# ---------------------------------------------------------------
section("TEST 9 - Cannot Withdraw After Shortlisted")
# ---------------------------------------------------------------
code, res = call("DELETE", f"/placement/applications/{APP_ID_1}/withdraw", token=STU)
ok("Withdraw after shortlisted returns 400", code == 400, f"code={code}")


# ---------------------------------------------------------------
section("TEST 10 - Admin Marks as Selected (PLACED!)")
# ---------------------------------------------------------------
code, selected = call("PATCH", f"/placement/applications/{APP_ID_1}/status", {
    "status": "selected",
    "remarks": "Offer letter will be sent by email"
}, ADMIN)
ok("Status update to selected (200)", code == 200, f"code={code}")
ok("Status = selected (PLACED)", selected.get("status") == "selected")


# ---------------------------------------------------------------
section("TEST 11 - Admin Lists All Applications for a Posting")
# ---------------------------------------------------------------
code, all_apps = call("GET", f"/placement/postings/{POSTING_ID_2}/applications", token=ADMIN)
ok("List applications returns 200", code == 200, f"code={code}")
ok("1 application for DataSoft", len(all_apps) == 1, f"count={len(all_apps)}")
ok("roll_number present", all_apps[0].get("roll_number") == "21CSE001")
ok("student_name present", all_apps[0].get("student_name") is not None)

# Filter by status
code, selected_apps = call(
    "GET",
    f"/placement/postings/{POSTING_ID_2}/applications?status_filter=selected",
    token=ADMIN
)
ok("Filter by selected returns 200", code == 200, f"code={code}")
ok("1 selected application", len(selected_apps) == 1, f"count={len(selected_apps)}")

code, shortlisted_apps = call(
    "GET",
    f"/placement/postings/{POSTING_ID_2}/applications?status_filter=shortlisted",
    token=ADMIN
)
ok("Filter by shortlisted returns 0 (moved to selected)", len(shortlisted_apps) == 0,
   f"count={len(shortlisted_apps)}")


# ---------------------------------------------------------------
section("TEST 12 - Update Posting (Admin)")
# ---------------------------------------------------------------
code, updated_post = call("PATCH", f"/placement/postings/{POSTING_ID_3}", {
    "is_open": False
}, ADMIN)
ok("Close posting returns 200", code == 200, f"code={code}")
ok("is_open = False", updated_post.get("is_open") == False)

# Try to apply to closed posting
code, _ = call("POST", "/placement/apply", {"job_posting_id": POSTING_ID_3}, STU)
ok("Apply to closed posting returns 400", code == 400, f"code={code}")


# ---------------------------------------------------------------
section("TEST 13 - Placement Analytics")
# ---------------------------------------------------------------
code, analytics = call("GET", "/placement/analytics", token=ADMIN)
ok("Analytics returns 200", code == 200, f"code={code}")
ok("total_job_postings >= 3",   analytics.get("total_job_postings", 0) >= 3, str(analytics.get("total_job_postings")))
ok("total_applications >= 1",   analytics.get("total_applications", 0) >= 1, str(analytics.get("total_applications")))
ok("total_placed_students = 1", analytics.get("total_placed_students") == 1, str(analytics.get("total_placed_students")))
ok("placement_rate > 0",        analytics.get("overall_placement_rate", 0) > 0, str(analytics.get("overall_placement_rate")))
ok("highest_package = 6.0",     analytics.get("highest_package_lpa") == 6.0, str(analytics.get("highest_package_lpa")))

funnel = analytics.get("funnel", {})
ok("Funnel selected = 1", funnel.get("selected") == 1, str(funnel.get("selected")))
print(f"  Funnel: {funnel}")

depts = analytics.get("by_department", [])
ok("Department analytics present", len(depts) >= 1, f"count={len(depts)}")
cse_dept = next((d for d in depts if d["department"] == "cse"), None)
if cse_dept:
    ok("CSE placed_count = 1", cse_dept.get("placed_count") == 1, str(cse_dept.get("placed_count")))
    ok("CSE placement_rate = 100%", cse_dept.get("placement_rate") == 100.0, str(cse_dept.get("placement_rate")))
    print(f"  CSE placement: {cse_dept}")

companies = analytics.get("top_companies", [])
ok("Top companies present", len(companies) >= 1, f"count={len(companies)}")
if companies:
    print(f"  Top companies: {[c['company_name'] for c in companies]}")

# Faculty can also view analytics
code, fac_analytics = call("GET", "/placement/analytics", token=FAC)
ok("Faculty can view analytics (200)", code == 200, f"code={code}")


# ---------------------------------------------------------------
section("TEST 14 - Soft Delete Posting (Admin)")
# ---------------------------------------------------------------
code, res = call("DELETE", f"/placement/postings/{POSTING_ID_3}", token=ADMIN)
ok("Delete posting returns 200", code == 200, f"code={code}")
ok("id in response", res.get("id") == POSTING_ID_3)

# Verify it's gone from active listing
code, active_postings = call("GET", "/placement/postings/", token=ADMIN)
deleted = next((p for p in active_postings if p["id"] == POSTING_ID_3), None)
ok("Deleted posting not in active list", deleted is None)

# But visible with active_only=false
code, all_postings = call("GET", "/placement/postings/?active_only=false", token=ADMIN)
was_there = next((p for p in all_postings if p["id"] == POSTING_ID_3), None)
ok("Deleted posting visible with active_only=false", was_there is not None)
ok("Deleted posting is_active=False", was_there and was_there.get("is_active") == False)


# ---------------------------------------------------------------
section("TEST 15 - Role Restrictions")
# ---------------------------------------------------------------
# Faculty cannot create posting
code, _ = call("POST", "/placement/postings/", {
    "company_name": "Hack", "role_title": "Test", "min_cgpa": 0.0, "min_attendance_pct": 0.0
}, FAC)
ok("Faculty cannot create posting (403)", code == 403, f"code={code}")

# Faculty cannot apply
code, _ = call("POST", "/placement/apply", {"job_posting_id": POSTING_ID_1}, FAC)
ok("Faculty cannot apply (403)", code == 403, f"code={code}")

# Student cannot update status
code, _ = call("PATCH", f"/placement/applications/{APP_ID_1}/status", {"status": "rejected"}, STU)
ok("Student cannot update application status (403)", code == 403, f"code={code}")

# No token -> 401
code, _ = call("GET", "/placement/postings/")
ok("No token -> 401", code == 401, f"code={code}")


print(f"\n{'='*55}")
print("  All placement module tests complete.")
print("="*55 + "\n")
