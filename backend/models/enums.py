# =============================================================
# models/enums.py — Shared Domain Enumerations
# =============================================================
# WHY a dedicated enums file?
#
#   If Department is defined in student.py AND faculty.py AND
#   section.py, you get THREE separate SQLAlchemy Enum types,
#   which creates THREE separate PostgreSQL enum types.
#   That's duplicate definitions, harder to maintain.
#
#   ONE central enums file = one source of truth.
#   All models import from here.
#
# SQLAlchemy Enum columns:
#   → Stored as a PostgreSQL ENUM type (enforced at DB level)
#   → Python-level validation via str(enum.Enum)
#   → Invalid values rejected BEFORE hitting the database
# =============================================================

import enum


class Department(str, enum.Enum):
    """
    Academic departments in the college.
    str inheritance means: Department.cse == "cse" (True)
    This makes JSON serialization and comparisons seamless.
    """
    cse   = "cse"    # Computer Science & Engineering
    ece   = "ece"    # Electronics & Communication
    mech  = "mech"   # Mechanical Engineering
    civil = "civil"  # Civil Engineering
    eee   = "eee"    # Electrical & Electronics
    it    = "it"     # Information Technology
    aids  = "aids"   # AI & Data Science


class Designation(str, enum.Enum):
    """
    Faculty job titles / designations.
    Used in faculty profiles to show seniority level.
    """
    hod            = "hod"             # Head of Department
    professor      = "professor"
    assoc_prof     = "assoc_prof"      # Associate Professor
    asst_prof      = "asst_prof"       # Assistant Professor
    lecturer       = "lecturer"
    lab_instructor = "lab_instructor"


class AttendanceStatus(str, enum.Enum):
    """
    Possible values for a single attendance record.

    present  → student was physically in class
    absent   → student was not present
    late     → student arrived after roll call (counts as present for % calculation)
    excused  → officially approved absence (medical, event, etc.)
               Excused is usually excluded from percentage denominator
               in strict systems — here we count it in denominator for simplicity.
    """
    present = "present"
    absent  = "absent"
    late    = "late"
    excused = "excused"


class ExamType(str, enum.Enum):
    """
    Types of examinations in a semester.
    Each type can have its own result row per student per subject.
    Internal + semester_end together form the final result.
    """
    internal      = "internal"       # Continuous assessment / class test
    midterm       = "midterm"        # Mid-semester exam
    semester_end  = "semester_end"   # End semester (main exam)
    supplementary = "supplementary"  # Re-exam for students who failed
    practical     = "practical"      # Lab exam


class ResultStatus(str, enum.Enum):
    """
    Overall result status after semester evaluation.
    'pass' = all subjects cleared with grade >= P (40%)
    'fail' = one or more subjects failed (F grade)
    'withheld' = result held back (disciplinary/fee issues)
    'pending' = not all results entered/published yet
    """
    pass_status = "pass"
    fail_status = "fail"
    withheld    = "withheld"
    pending     = "pending"


class NotificationType(str, enum.Enum):
    """
    Categories of notifications in the ERP system.

    announcement   → Admin/Faculty broadcasts (college events, holidays)
    test_result    → Auto-generated when student's test is graded
    low_attendance → Auto-generated when student drops below 75%
    notes_uploaded → Auto-generated when faculty uploads notes for a section
    general        → Any ad-hoc message between users
    """
    announcement    = "announcement"
    test_result     = "test_result"
    low_attendance  = "low_attendance"
    notes_uploaded  = "notes_uploaded"
    placement_update = "placement_update"
    general         = "general"


class CorrectOption(str, enum.Enum):
    """
    The four MCQ option identifiers.
    Stored as a single character in the DB.
    Used in both Question.correct_option and TestAnswer.selected_option.

    WHY an enum and not a plain String?
    → Database enforces only 'a','b','c','d' are storable
    → Python schema validation rejects anything else
    → Analytics code can compare directly: answer.selected == question.correct
    """
    a = "a"
    b = "b"
    c = "c"
    d = "d"


class Semester(int, enum.Enum):
    """
    Academic semesters 1 through 8.
    int inheritance means: Semester.sem1 == 1 (True)
    Stored as INTEGER in PostgreSQL.
    """
    sem1 = 1
    sem2 = 2
    sem3 = 3
    sem4 = 4
    sem5 = 5
    sem6 = 6
    sem7 = 7
    sem8 = 8


class ApplicationStatus(str, enum.Enum):
    """
    Lifecycle of a student's placement application.

    applied       → Student submitted the application
    under_review  → Company is reviewing (set by admin)
    shortlisted   → Shortlisted for interview (set by admin)
    selected      → Offer made — student is PLACED (set by admin)
    rejected      → Not selected (set by admin)
    withdrawn     → Student withdrew their own application

    WHY store this in the DB?
    → Full audit trail of every status change
    → Multiple students can be at different stages for the same job
    → Analytics: funnel view (applied → shortlisted → selected rates)
    """
    applied      = "applied"
    under_review = "under_review"
    shortlisted  = "shortlisted"
    selected     = "selected"
    rejected     = "rejected"
    withdrawn    = "withdrawn"
