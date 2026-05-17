# =============================================================
# utils/test_notifications.py - Notification Module Test
# Run: .\venv\Scripts\python.exe -m backend.utils.test_notifications
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


def ok(label, condition, detail=""):
    s = "[PASS]" if condition else "[FAIL]"
    print(f"  {s}  {label}" + (f"  [{detail}]" if detail else ""))


def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print("="*55)


# --- Login ---
section("SETUP - Login all roles")
_, res = call("POST", "/auth/login", {"username": "admin", "password": "Admin@1234"})
ADMIN = res.get("access_token", "")
ADMIN_USER_ID = None
ok("Admin login", bool(ADMIN))

_, res = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
FAC = res.get("access_token", "")
ok("Faculty login", bool(FAC))

_, res = call("POST", "/auth/login", {"username": "21CSE001", "password": "Student@1234"})
STU = res.get("access_token", "")
ok("Student login", bool(STU))

# Get student user_id (for direct notification target)
_, prof = call("GET", "/students/me", token=STU)
STUDENT_USER_ID = prof.get("user_id") or prof.get("id")

# Get faculty user_id
_, fac_prof = call("GET", "/faculty/me", token=FAC)
FAC_USER_ID = fac_prof.get("user_id")


section("TEST 1 - Admin Sends Direct Notification to Student")
code, res = call("POST", "/notifications/send", {
    "recipient_user_id": STUDENT_USER_ID,
    "title": "Important: Exam Schedule Updated",
    "message": "The Data Structures exam has been rescheduled to 20th May.",
    "notification_type": "announcement"
}, ADMIN)
ok("Direct notification returns 201", code == 201, f"code={code}")
ok("Notification has id", "id" in res)
ok("is_read = False", res.get("is_read") == False)
ok("sender_name present", res.get("sender_name") is not None, res.get("sender_name", ""))
NOTIF_ID = res.get("id")
print(f"  Notification ID: {NOTIF_ID}")


section("TEST 2 - Faculty Sends Section Broadcast")
code, res = call("POST", "/notifications/section", {
    "section_id": 1,
    "title": "Lab session moved to Room 204",
    "message": "Tomorrow's Data Structures lab will be in Room 204 instead of 101.",
    "notification_type": "announcement"
}, FAC)
ok("Section broadcast returns 201", code == 201, f"code={code}")
ok("Recipients = 1 (only 1 student in section)", res.get("recipients") == 1,
   f"recipients={res.get('recipients')}")


section("TEST 3 - Admin Global Broadcast")
code, res = call("POST", "/notifications/broadcast", {
    "title": "College Holiday: 15th May",
    "message": "College will remain closed on 15th May for National Holiday.",
    "notification_type": "announcement"
}, ADMIN)
ok("Broadcast returns 201", code == 201, f"code={code}")
ok("All users notified", res.get("recipients", 0) >= 3,
   f"recipients={res.get('recipients')}")


section("TEST 4 - Student Views Own Inbox")
code, res = call("GET", "/notifications/", token=STU)
ok("Inbox returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(res.get("notifications"), list))
ok("unread_count > 0", res.get("unread_count", 0) > 0,
   f"unread={res.get('unread_count')}")
ok("total > 0", res.get("total", 0) > 0, f"total={res.get('total')}")
print(f"  Student has {res.get('unread_count')} unread, {res.get('total')} total")
# Grab an actual notification ID from inbox for later tests
INBOX_NOTIF_ID = res["notifications"][0]["id"] if res.get("notifications") else None
INBOX_NOTIF_ID_2 = res["notifications"][1]["id"] if len(res.get("notifications", [])) > 1 else INBOX_NOTIF_ID
print(f"  Using notification IDs from inbox: {INBOX_NOTIF_ID}, {INBOX_NOTIF_ID_2}")


section("TEST 5 - Unread Count Endpoint")
code, res = call("GET", "/notifications/unread-count", token=STU)
ok("Unread count returns 200", code == 200, f"code={code}")
ok("Count is integer", isinstance(res.get("unread_count"), int))
UNREAD_BEFORE = res.get("unread_count", 0)
print(f"  Unread count: {UNREAD_BEFORE}")


section("TEST 6 - Filter Inbox: Unread Only")
code, res = call("GET", "/notifications/?unread_only=true", token=STU)
ok("Unread filter returns 200", code == 200, f"code={code}")
ok("All returned notifications are unread",
   all(not n.get("is_read") for n in res.get("notifications", [])))


section("TEST 7 - Mark One Notification as Read")
if INBOX_NOTIF_ID:
    code, res = call("PATCH", f"/notifications/{INBOX_NOTIF_ID}/read", token=STU)
    ok("Mark read returns 200", code == 200, f"code={code}")
    ok("is_read = True", res.get("is_read") == True)
    ok("read_at is set", res.get("read_at") is not None)

    # Verify unread count decreased
    _, cnt = call("GET", "/notifications/unread-count", token=STU)
    ok("Unread count decreased by 1",
       cnt.get("unread_count") == UNREAD_BEFORE - 1,
       f"now={cnt.get('unread_count')} was={UNREAD_BEFORE}")


section("TEST 8 - Mark All as Read")
code, res = call("PATCH", "/notifications/read-all", token=STU)
ok("Mark all read returns 200", code == 200, f"code={code}")
ok("Updated count reported", isinstance(res.get("updated_count"), int),
   str(res.get("updated_count")))

_, cnt = call("GET", "/notifications/unread-count", token=STU)
ok("Unread count is now 0", cnt.get("unread_count") == 0,
   f"unread={cnt.get('unread_count')}")


section("TEST 9 - Soft Delete a Notification")
if INBOX_NOTIF_ID_2:
    code, res = call("DELETE", f"/notifications/{INBOX_NOTIF_ID_2}", token=STU)
    ok("Delete returns 200", code == 200, f"code={code}")

    # Verify it's gone from inbox
    _, inbox = call("GET", "/notifications/", token=STU)
    ids_in_inbox = [n.get("id") for n in inbox.get("notifications", [])]
    ok("Deleted notification not in inbox", INBOX_NOTIF_ID_2 not in ids_in_inbox)


section("TEST 10 - Sender Name on Direct Notification")
# Send a CORRECTLY targeted direct notification now that user_id is fixed
code, res = call("POST", "/notifications/send", {
    "recipient_user_id": STUDENT_USER_ID,
    "title": "Targeted: Exam Tomorrow",
    "message": "Your practicals are scheduled for 9 AM.",
    "notification_type": "general"
}, ADMIN)
ok("Targeted notification returns 201", code == 201, f"code={code}")
ok("Sender name present", res.get("sender_name") is not None, res.get("sender_name", ""))
DIRECT_NOTIF_ID = res.get("id")

# Verify student received it
_, inbox = call("GET", "/notifications/", token=STU)
ids_in_inbox = [n.get("id") for n in inbox.get("notifications", [])]
ok("Student received targeted notification", DIRECT_NOTIF_ID in ids_in_inbox,
   f"id={DIRECT_NOTIF_ID} inbox_ids={ids_in_inbox[:5]}")


section("TEST 11 - Role Restrictions")
# Student cannot send notifications
code, _ = call("POST", "/notifications/send", {
    "recipient_user_id": 1,
    "title": "Hack", "message": "Hacked"
}, STU)
ok("Student cannot send notification (403)", code == 403, f"code={code}")

# Faculty cannot global broadcast
code, _ = call("POST", "/notifications/broadcast", {
    "title": "Fake", "message": "Fake broadcast"
}, FAC)
ok("Faculty cannot global broadcast (403)", code == 403, f"code={code}")

# No token returns 401
code, _ = call("GET", "/notifications/")
ok("No token returns 401", code == 401, f"code={code}")

# Student cannot view analytics
code, _ = call("GET", "/notifications/analytics", token=STU)
ok("Student cannot view analytics (403)", code == 403, f"code={code}")


section("TEST 12 - Admin Notification Analytics")
code, res = call("GET", "/notifications/analytics", token=ADMIN)
ok("Analytics returns 200", code == 200, f"code={code}")
ok("Total sent > 0", res.get("total_sent", 0) > 0, str(res.get("total_sent")))
ok("by_type breakdown present", isinstance(res.get("by_type"), dict),
   str(list(res.get("by_type", {}).keys())))
ok("Read rate is float", isinstance(res.get("read_rate_percentage"), float),
   str(res.get("read_rate_percentage")))
print(f"  Total sent: {res.get('total_sent')}, Read rate: {res.get('read_rate_percentage')}%")
print(f"  By type: {res.get('by_type')}")


print(f"\n{'='*55}")
print("  All notification tests complete.")
print("="*55 + "\n")
