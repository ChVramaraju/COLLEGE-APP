# =============================================================
# utils/test_online_test.py - Online Test Module Test
# Run: .\venv\Scripts\python.exe -m backend.utils.test_online_test
# =============================================================

import urllib.request
import urllib.error
import json
from datetime import datetime, timezone, timedelta

BASE = "http://127.0.0.1:8000"


def call(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body, default=str).encode() if body else None
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


# ------------------------------------------------------------------
section("SETUP - Login all roles")
# ------------------------------------------------------------------
_, res = call("POST", "/auth/login", {"username": "admin", "password": "Admin@1234"})
ADMIN = res.get("access_token", "")
ok("Admin login", bool(ADMIN))

_, res = call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
FAC = res.get("access_token", "")
ok("Faculty login", bool(FAC))

_, res = call("POST", "/auth/login", {"username": "21CSE001", "password": "Student@1234"})
STU = res.get("access_token", "")
ok("Student login", bool(STU))


# ------------------------------------------------------------------
section("TEST 1 - Create Test (Draft)")
# ------------------------------------------------------------------
# Timing: window starts 1 hour ago, ends 2 hours from now
now = datetime.now(timezone.utc)
start = (now - timedelta(hours=1)).isoformat()
end   = (now + timedelta(hours=2)).isoformat()

code, res = call("POST", "/tests/", {
    "section_id": 1,
    "subject": "data structures",
    "title": "DS Unit 1 Test",
    "description": "Chapter 1-3 MCQs",
    "duration_minutes": 30,
    "start_time": start,
    "end_time": end,
}, FAC)
ok("Create test returns 201", code == 201, f"code={code}")
ok("Test in draft state", res.get("is_published") == False)
ok("Subject normalized", res.get("subject") == "Data Structures", res.get("subject"))
ok("No questions yet", res.get("question_count") == 0)
TEST_ID = res.get("id")
print(f"  Test ID: {TEST_ID}")


# ------------------------------------------------------------------
section("TEST 2 - Publish Without Questions (400)")
# ------------------------------------------------------------------
code, res = call("PATCH", f"/tests/{TEST_ID}/publish", token=FAC)
ok("Publish empty test returns 400", code == 400, f"code={code}")
ok("Error detail present", "detail" in res, res.get("detail", "")[:60])


# ------------------------------------------------------------------
section("TEST 3 - Add Questions (Bulk)")
# ------------------------------------------------------------------
code, res = call("POST", f"/tests/{TEST_ID}/questions", {
    "questions": [
        {
            "question_text": "What is the time complexity of binary search?",
            "option_a": "O(n)", "option_b": "O(log n)",
            "option_c": "O(n^2)", "option_d": "O(1)",
            "correct_option": "b", "marks": 2, "order_number": 1
        },
        {
            "question_text": "Which data structure uses LIFO?",
            "option_a": "Queue", "option_b": "Tree",
            "option_c": "Stack", "option_d": "Graph",
            "correct_option": "c", "marks": 2, "order_number": 2
        },
        {
            "question_text": "What is the height of a balanced BST with 7 nodes?",
            "option_a": "7", "option_b": "4",
            "option_c": "3", "option_d": "2",
            "correct_option": "d", "marks": 1, "order_number": 3
        },
    ]
}, FAC)
ok("Add 3 questions returns 201", code == 201, f"code={code}")
ok("Question count = 3", res.get("question_count") == 3, str(res.get("question_count")))


# ------------------------------------------------------------------
section("TEST 4 - Publish Test")
# ------------------------------------------------------------------
code, res = call("PATCH", f"/tests/{TEST_ID}/publish", token=FAC)
ok("Publish returns 200", code == 200, f"code={code}")
ok("is_published = True", res.get("is_published") == True)
ok("total_marks = 5", res.get("total_marks") == 5, str(res.get("total_marks")))
ok("Question count = 3", res.get("question_count") == 3)


# ------------------------------------------------------------------
section("TEST 5 - Cannot Add Questions to Published Test (400)")
# ------------------------------------------------------------------
code, res = call("POST", f"/tests/{TEST_ID}/questions", {
    "questions": [{
        "question_text": "Late addition attempt",
        "option_a": "A", "option_b": "B",
        "option_c": "C", "option_d": "D",
        "correct_option": "a", "marks": 1, "order_number": 4
    }]
}, FAC)
ok("Add to published test returns 400", code == 400, f"code={code}")


# ------------------------------------------------------------------
section("TEST 6 - Student Sees Test in Available List")
# ------------------------------------------------------------------
code, res = call("GET", "/tests/available", token=STU)
ok("Available tests returns 200", code == 200, f"code={code}")
ok("Test is in list", isinstance(res, list) and len(res) > 0,
   f"count={len(res) if isinstance(res, list) else 0}")
if isinstance(res, list) and len(res) > 0:
    t = res[0]
    ok("Already attempted = False", t.get("already_attempted") == False)
    ok("No correct_option in list response",
       all("correct_option" not in str(t) for t in res))


# ------------------------------------------------------------------
section("TEST 7 - Student Starts Test Attempt")
# ------------------------------------------------------------------
code, res = call("POST", f"/tests/{TEST_ID}/attempt", token=STU)
ok("Start attempt returns 201", code == 201, f"code={code}")
ok("Questions returned", isinstance(res.get("questions"), list))
ok("3 questions in attempt", len(res.get("questions", [])) == 3,
   f"count={len(res.get('questions', []))}")
ok("correct_option NOT in questions",
   all("correct_option" not in q for q in res.get("questions", [])))
ok("attempt_id present", "attempt_id" in res)
ATTEMPT_ID = res.get("attempt_id")
print(f"  Attempt ID: {ATTEMPT_ID}")

# Get question IDs from the attempt
q_ids = [q["id"] for q in res.get("questions", [])]


# ------------------------------------------------------------------
section("TEST 8 - Duplicate Attempt Prevention (409)")
# ------------------------------------------------------------------
code, res = call("POST", f"/tests/{TEST_ID}/attempt", token=STU)
ok("Second start returns 409 or resumes", code in (201, 409), f"code={code}")


# ------------------------------------------------------------------
section("TEST 9 - Submit Test Answers + Auto-Grading")
# ------------------------------------------------------------------
# Q1: binary search = O(log n) → correct = b → answer b (correct, 2 marks)
# Q2: LIFO = Stack → correct = c → answer c (correct, 2 marks)
# Q3: BST height → correct = d → answer a (wrong, 0 marks)
# Expected score: 4/5 = 80%

if len(q_ids) >= 3:
    code, res = call("POST", f"/tests/attempts/{ATTEMPT_ID}/submit", {
        "answers": [
            {"question_id": q_ids[0], "selected_option": "b"},  # correct
            {"question_id": q_ids[1], "selected_option": "c"},  # correct
            {"question_id": q_ids[2], "selected_option": "a"},  # wrong
        ]
    }, STU)
    ok("Submit returns 200", code == 200, f"code={code}")
    ok("Score = 4", res.get("score") == 4, str(res.get("score")))
    ok("Percentage = 80.0", res.get("percentage") == 80.0, str(res.get("percentage")))
    ok("is_pass = True", res.get("is_pass") == True)
    ok("correct_option NOW revealed", all(
        "correct_option" in q for q in res.get("answered_questions", [])
    ))
    ok("Q3 marked wrong", not res["answered_questions"][2]["is_correct"] if len(res.get("answered_questions",[])) >= 3 else False)
    ok("Q1 marks_awarded = 2", res["answered_questions"][0]["marks_awarded"] == 2 if res.get("answered_questions") else False)


# ------------------------------------------------------------------
section("TEST 10 - Double Submit Blocked (409)")
# ------------------------------------------------------------------
if ATTEMPT_ID:
    code, res = call("POST", f"/tests/attempts/{ATTEMPT_ID}/submit", {
        "answers": [{"question_id": q_ids[0], "selected_option": "a"}]
    }, STU)
    ok("Double submit returns 409", code == 409, f"code={code}")


# ------------------------------------------------------------------
section("TEST 11 - View Result After Submission")
# ------------------------------------------------------------------
if ATTEMPT_ID:
    code, res = call("GET", f"/tests/attempts/{ATTEMPT_ID}/result", token=STU)
    ok("Result returns 200", code == 200, f"code={code}")
    ok("Score preserved", res.get("score") == 4)
    ok("Answered questions included", len(res.get("answered_questions", [])) == 3)


# ------------------------------------------------------------------
section("TEST 12 - Student My Results List")
# ------------------------------------------------------------------
code, res = call("GET", "/tests/my-results", token=STU)
ok("My results returns 200", code == 200, f"code={code}")
ok("Returns list", isinstance(res, list))
ok("At least 1 result", len(res) >= 1 if isinstance(res, list) else False)


# ------------------------------------------------------------------
section("TEST 13 - Test Analytics (Faculty)")
# ------------------------------------------------------------------
if TEST_ID:
    code, res = call("GET", f"/tests/{TEST_ID}/analytics", token=FAC)
    ok("Analytics returns 200", code == 200, f"code={code}")
    ok("Submitted count = 1", res.get("submitted_count") == 1, str(res.get("submitted_count")))
    ok("Average score = 4.0", res.get("average_score") == 4.0, str(res.get("average_score")))
    ok("Average pct = 80.0", res.get("average_percentage") == 80.0, str(res.get("average_percentage")))
    ok("Pass count = 1", res.get("pass_count") == 1, str(res.get("pass_count")))
    ok("Topper identified", res.get("topper_roll_number") == "21CSE001", res.get("topper_roll_number"))
    ok("Question accuracy computed", len(res.get("question_accuracy", [])) == 3,
       f"count={len(res.get('question_accuracy', []))}")


# ------------------------------------------------------------------
section("TEST 14 - Role Restrictions")
# ------------------------------------------------------------------
code, _ = call("POST", "/tests/", {
    "section_id": 1, "subject": "Hack",
    "title": "Hack Test", "duration_minutes": 10,
    "start_time": start, "end_time": end,
}, STU)
ok("Student cannot create test (403)", code == 403, f"code={code}")

code, _ = call("GET", "/tests/available", token=FAC)
ok("Faculty cannot use /available (403)", code == 403, f"code={code}")

code, _ = call("GET", f"/tests/{TEST_ID}/analytics")
ok("No token on analytics returns 401", code == 401, f"code={code}")


# ------------------------------------------------------------------
section("TEST 15 - Test Not Yet Started (Timing)")
# ------------------------------------------------------------------
future_start = (now + timedelta(hours=1)).isoformat()
future_end   = (now + timedelta(hours=3)).isoformat()
code, future_res = call("POST", "/tests/", {
    "section_id": 1, "subject": "Future Subject",
    "title": "Future Test", "duration_minutes": 20,
    "start_time": future_start, "end_time": future_end,
}, FAC)
if code == 201:
    FUTURE_ID = future_res.get("id")
    # Add a question and publish
    call("POST", f"/tests/{FUTURE_ID}/questions", {
        "questions": [{
            "question_text": "Future question?",
            "option_a": "A", "option_b": "B",
            "option_c": "C", "option_d": "D",
            "correct_option": "a", "marks": 1, "order_number": 1
        }]
    }, FAC)
    call("PATCH", f"/tests/{FUTURE_ID}/publish", token=FAC)

    code, res = call("POST", f"/tests/{FUTURE_ID}/attempt", token=STU)
    ok("Start before start_time returns 400", code == 400, f"code={code}")
    ok("Correct error message", "not started" in res.get("detail", "").lower(),
       res.get("detail", "")[:60])


print(f"\n{'='*55}")
print("  All online test module tests complete.")
print("="*55 + "\n")
