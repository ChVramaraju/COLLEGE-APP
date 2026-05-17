# =============================================================
# utils/test_notes.py - Notes Module Test
# Run: .\venv\Scripts\python.exe -m backend.utils.test_notes
# =============================================================

import urllib.request
import urllib.error
import json
import os
import tempfile

BASE = "http://127.0.0.1:8000"


def json_call(method, path, body=None, token=None):
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


def multipart_call(path, fields, file_field, file_name, file_content, file_type, token):
    """Send a multipart/form-data request with a file."""
    import email.mime.multipart
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body_parts = []

    for key, value in fields.items():
        body_parts.append(
            f"------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n"
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'
            f"{value}\r\n"
        )

    file_part = (
        f"------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n"
        f'Content-Disposition: form-data; name="{file_field}"; filename="{file_name}"\r\n'
        f"Content-Type: {file_type}\r\n\r\n"
    )

    body = "".join(body_parts).encode() + file_part.encode() + file_content + \
           b"\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n"

    headers = {
        "Content-Type": f"multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW",
        "Authorization": f"Bearer {token}",
    }
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def ok(label, condition, detail=""):
    s = "[PASS]" if condition else "[FAIL]"
    print(f"  {s}  {label}" + (f"  [{detail}]" if detail else ""))


def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print("="*50)


# --- Login ---
section("SETUP - Login all roles")
_, res = json_call("POST", "/auth/login", {"username": "admin", "password": "Admin@1234"})
ADMIN = res.get("access_token", "")
ok("Admin login", bool(ADMIN))

_, res = json_call("POST", "/auth/login", {"username": "FAC2024001", "password": "Faculty@1234"})
FAC = res.get("access_token", "")
ok("Faculty login", bool(FAC))

_, res = json_call("POST", "/auth/login", {"username": "21CSE001", "password": "Student@1234"})
STU = res.get("access_token", "")
ok("Student login", bool(STU))


# --- Create a real minimal PDF (just enough bytes to be valid) ---
# A minimal valid-looking PDF file content
PDF_CONTENT = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF"

section("TEST 1 - Faculty Uploads PDF Note")
code, res = multipart_call(
    "/notes/upload",
    fields={"title": "Data Structures Chapter 1", "subject": "Data Structures",
            "section_id": "1", "description": "Introduction to DS"},
    file_field="file",
    file_name="ds_chapter1.pdf",
    file_content=PDF_CONTENT,
    file_type="application/pdf",
    token=FAC,
)
ok("Upload returns 201", code == 201, f"code={code}")
ok("Note has id", "id" in res, str(res.get("id")))
ok("Title correct", res.get("title") == "Data Structures Chapter 1")
ok("Subject normalized", res.get("subject") == "Data Structures")
ok("file_path NOT in response", "file_path" not in res)
ok("file_name NOT in response", "file_name" not in res)
ok("File size > 0", res.get("file_size", 0) > 0, str(res.get("file_size")))
NOTE_ID = res.get("id")

section("TEST 2 - Upload Second Note (Same Section)")
code, res2 = multipart_call(
    "/notes/upload",
    fields={"title": "Mathematics Week 1", "subject": "Mathematics", "section_id": "1"},
    file_field="file",
    file_name="math_week1.pdf",
    file_content=PDF_CONTENT,
    file_type="application/pdf",
    token=FAC,
)
ok("Second upload returns 201", code == 201, f"code={code}")

section("TEST 3 - Invalid File Type Rejected (415)")
code, res = multipart_call(
    "/notes/upload",
    fields={"title": "Virus Test", "subject": "Hacking", "section_id": "1"},
    file_field="file",
    file_name="malware.exe",
    file_content=b"MZ this is a windows executable",
    file_type="application/x-executable",
    token=FAC,
)
ok("EXE file rejected 415", code == 415, f"code={code}")
ok("Error detail present", "detail" in res, res.get("detail", "")[:60])

section("TEST 4 - List Notes for Section (Student)")
code, res = json_call("GET", "/notes/section/1", token=STU)
ok("Student can list section notes (200)", code == 200, f"code={code}")
ok("Returns list", isinstance(res, list))
ok("2 notes found", len(res) == 2, f"count={len(res) if isinstance(res, list) else 0}")
ok("file_path NOT in list response", all("file_path" not in n for n in res) if isinstance(res, list) else False)

section("TEST 5 - Filter Notes by Subject (Student)")
code, res = json_call("GET", "/notes/section/1?subject=Mathematics", token=STU)
ok("Subject filter returns 200", code == 200, f"code={code}")
ok("Only 1 note (Mathematics)", len(res) == 1 if isinstance(res, list) else False)

section("TEST 6 - Search Notes by Title")
code, res = json_call("GET", "/notes/section/1?search=data", token=FAC)
ok("Title search returns 200", code == 200, f"code={code}")
ok("Search finds 1 result", len(res) == 1 if isinstance(res, list) else False,
   f"count={len(res) if isinstance(res, list) else 0}")

section("TEST 7 - Get Note Metadata by ID")
if NOTE_ID:
    code, res = json_call("GET", f"/notes/{NOTE_ID}", token=STU)
    ok("Get note by ID returns 200", code == 200, f"code={code}")
    ok("Title present", res.get("title") == "Data Structures Chapter 1")
    ok("Faculty info embedded", res.get("faculty") is not None)

section("TEST 8 - Download Note")
if NOTE_ID:
    url = f"{BASE}/notes/{NOTE_ID}/download"
    headers = {"Authorization": f"Bearer {STU}"}
    req = urllib.request.Request(url, headers=headers)
    try:
        resp = urllib.request.urlopen(req)
        code = resp.status
        content = resp.read()
        cd_header = resp.headers.get("Content-Disposition", "")
        ok("Download returns 200", code == 200, f"code={code}")
        ok("File bytes received", len(content) > 0, f"bytes={len(content)}")
        ok("Original filename in header", "ds_chapter1.pdf" in cd_header, cd_header[:80])
    except urllib.error.HTTPError as e:
        ok("Download returns 200", False, f"code={e.code}")

section("TEST 9 - Student Cannot Access Other Section's Notes")
code, res = json_call("GET", "/notes/section/999", token=STU)
ok("Student blocked from nonexistent/other section (403 or 404)", code in (403, 404), f"code={code}")

section("TEST 10 - Role Restrictions")
code, _ = json_call("GET", f"/notes/{NOTE_ID}/download")
ok("No token returns 401", code == 401, f"code={code}")

code, res = multipart_call(
    "/notes/upload",
    fields={"title": "Hack Upload", "subject": "Test", "section_id": "1"},
    file_field="file",
    file_name="test.pdf",
    file_content=PDF_CONTENT,
    file_type="application/pdf",
    token=STU,
)
ok("Student cannot upload notes (403)", code == 403, f"code={code}")

section("TEST 11 - Update Note Metadata (Faculty)")
if NOTE_ID:
    code, res = json_call("PATCH", f"/notes/{NOTE_ID}",
                          {"title": "Data Structures Chapter 1 - Updated"}, FAC)
    ok("Update returns 200", code == 200, f"code={code}")
    ok("Title updated", res.get("title") == "Data Structures Chapter 1 - Updated",
       res.get("title"))

section("TEST 12 - Deactivate Note (Faculty)")
if NOTE_ID:
    code, res = json_call("DELETE", f"/notes/{NOTE_ID}", token=FAC)
    ok("Delete returns 200", code == 200, f"code={code}")

    # Verify note is gone
    code, res = json_call("GET", f"/notes/{NOTE_ID}", token=FAC)
    ok("Deleted note returns 404", code == 404, f"code={code}")

print(f"\n{'='*50}")
print("  All notes tests complete.")
print("="*50 + "\n")
