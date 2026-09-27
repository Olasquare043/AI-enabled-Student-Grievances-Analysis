"""Generate the synthetic Nigerian student-grievance dataset.

Usage:
    python -m app.data_gen.generate_dataset --seed 42 --count 4000

Outputs (in backend/data/):
    grievances_synthetic.csv   one row per grievance, with ground-truth labels
    students_synthetic.csv     the simulated student population

The generator is fully deterministic for a given seed. See
backend/data/DATASET_CARD.md for the design rationale.
"""

from __future__ import annotations

import argparse
import csv
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from app.data_gen.scenarios import (
    CATEGORIES,
    PLANTED_EVENTS,
    SCENARIOS,
    VAGUE_CUES,
    VAGUE_FRAMES,
    Scenario,
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
START_DATE = date(2025, 4, 6)  # 540 days -> ends 2026-09-27
SPAN_DAYS = 540
URGENCY_LEVELS = ("low", "medium", "high", "critical")

# Relative grievance volume by calendar month (Nigerian academic calendar:
# resumption/registration Oct-Nov, first-semester exams Feb, results Mar-Apr,
# second-semester exams Jul, long vacation Aug).
MONTH_VOLUME = {
    1: 0.9, 2: 1.1, 3: 1.2, 4: 1.1, 5: 0.9, 6: 0.9,
    7: 1.1, 8: 0.5, 9: 0.9, 10: 1.5, 11: 1.3, 12: 0.6,
}

# Category multipliers by month.
SEASONALITY: dict[str, dict[int, float]] = {
    "bursary": {10: 2.0, 11: 1.6, 3: 1.5, 4: 1.2},
    "ict": {10: 1.8, 11: 1.3, 3: 1.5},
    "academic": {2: 1.5, 3: 1.6, 4: 1.4, 7: 1.4, 9: 1.5},
    "hostel": {10: 1.6, 11: 1.3, 4: 1.3, 5: 1.4, 8: 0.5},
    "security": {12: 1.3, 1: 1.4},
    "registry": {9: 1.5, 10: 1.4, 11: 1.3},
    "welfare": {},
}

# Median hours to resolution per category (log-normal around the median).
RESOLUTION_MEDIAN_HOURS = {
    "ict": 40, "bursary": 90, "registry": 130, "hostel": 60,
    "security": 30, "academic": 110, "welfare": 45,
}
FIRST_RESPONSE_MEDIAN_HOURS = {
    "ict": 1.6, "bursary": 2.8, "registry": 3.5, "hostel": 2.5,
    "security": 0.8, "academic": 3.2, "welfare": 2.0,
}

FACULTIES: dict[str, tuple[str, ...]] = {
    "Science": ("Computer Science", "Microbiology", "Physics", "Biochemistry", "Mathematics"),
    "Management Sciences": ("Accounting", "Business Administration", "Economics"),
    "Engineering": ("Civil Engineering", "Electrical Engineering", "Mechanical Engineering"),
    "Social Sciences": ("Mass Communication", "Political Science", "Sociology"),
    "Education": ("Educational Management", "Guidance and Counselling"),
    "Arts": ("English", "History and International Studies"),
}
DEPT_CODES = {
    "Computer Science": "CSC", "Microbiology": "MCB", "Physics": "PHY",
    "Biochemistry": "BCH", "Mathematics": "MTH", "Accounting": "ACC",
    "Business Administration": "BUS", "Economics": "ECO",
    "Civil Engineering": "CVE", "Electrical Engineering": "EEE",
    "Mechanical Engineering": "MEE", "Mass Communication": "MAC",
    "Political Science": "POL", "Sociology": "SOC",
    "Educational Management": "EDM", "Guidance and Counselling": "GAC",
    "English": "ENG", "History and International Studies": "HIS",
}
FIRST_NAMES = (
    "Adebayo", "Chinedu", "Aisha", "Tunde", "Ngozi", "Ibrahim", "Funmilayo", "Emeka",
    "Zainab", "Olumide", "Chiamaka", "Musa", "Temitope", "Ifeanyi", "Halima", "Segun",
    "Blessing", "Yusuf", "Kemi", "Obinna", "Fatima", "Damilola", "Uche", "Hauwa",
    "Seun", "Chioma", "Abdullahi", "Bukola", "Nnamdi", "Amina", "Femi", "Ebere",
    "Sadiq", "Tolulope", "Chukwudi", "Maryam", "Gbenga", "Adaeze", "Bello", "Yetunde",
)
LAST_NAMES = (
    "Adeyemi", "Okafor", "Bello", "Ogunleye", "Eze", "Abubakar", "Olatunji", "Nwosu",
    "Suleiman", "Adeleke", "Obi", "Mohammed", "Akinola", "Okonkwo", "Usman", "Balogun",
    "Chukwu", "Ibrahim", "Oyelaran", "Nnaji", "Aliyu", "Fashola", "Ugwu", "Danjuma",
    "Ojo", "Anyanwu", "Garba", "Adebisi", "Onyeka", "Lawal",
)
HOSTELS = (
    "Moremi Hall", "Queen Amina Hall", "Awolowo Hall", "Zik Hall",
    "Tafawa Balewa Hall", "Block C Male Hostel", "Female Hostel Block D",
)
LOCATIONS = (
    "the back gate", "the main library", "the Faculty of Science", "the Engineering block",
    "the lecture theatre", "the sports complex", "the e-library", "the SUG building",
)
SCHOLARSHIPS = ("state government", "NNPC/Total", "Tertiary Education Trust Fund", "MTN Foundation")
FEE_TYPES = ("acceptance fee", "school fees", "hostel fee", "departmental dues", "medical fee")

OPENERS = (
    "", "", "", "Good day. ", "Good afternoon sir/ma. ", "Please I need help. ",
    "I am writing to complain about this issue. ", "Dear Sir/Ma, ",
)
CLOSERS = (
    "", "", "", " Please help.", " Kindly look into this.", " Thank you.",
    " I will appreciate a quick response.", " Please treat this as a matter of priority.",
)
PIDGIN = (
    " Abeg make una help us.", " E don tey wey we dey complain.", " Nobody dey answer us.",
    " This wahala don too much.", " We dey suffer for this matter.",
)
FOLLOW_UP = (
    " I have reported this {n_times} times already.",
    " I reported this to the office on {date} but nothing has been done.",
    " This is my second complaint about the same issue.",
)
URGENT_TAILS = (
    " This is urgent!", " Please act quickly!!", " I need this resolved today.",
    " It is very urgent.",
)

GENERIC_TITLES = (
    "Complaint", "Urgent complaint", "Need assistance", "Unresolved issue", "Request for help",
    "Follow up on my complaint", "No response from the office", "Problem", "Please help",
)

COURSE_PREFIXES = ("CSC", "MTH", "GST", "PHY", "ACC", "ECO", "EEE", "MCB", "BUS", "ENG")


@dataclass
class Student:
    ref: str
    first_name: str
    last_name: str
    faculty: str
    department: str
    level: str
    matric: str


def _weighted_choice(rng: random.Random, items, weights):
    return rng.choices(items, weights=weights, k=1)[0]


def _course(rng: random.Random) -> str:
    return f"{rng.choice(COURSE_PREFIXES)}{rng.choice((1, 2, 3, 4))}{rng.randint(0, 2)}{rng.randint(1, 9)}"


def _fmt_date(d: date) -> str:
    return d.strftime("%d/%m/%Y") if d.toordinal() % 2 else d.strftime("%d %B")


class Generator:
    def __init__(self, seed: int) -> None:
        self.rng = random.Random(seed)
        self.students: list[Student] = []

    # -------------------------------------------------------------- students
    def build_students(self, count: int) -> list[Student]:
        rng = self.rng
        faculties = list(FACULTIES)
        for index in range(1, count + 1):
            faculty = rng.choice(faculties)
            department = rng.choice(FACULTIES[faculty])
            level = rng.choice(("100", "200", "300", "400", "400", "500"))
            entry_year = 26 - int(level) // 100
            self.students.append(
                Student(
                    ref=f"S{index:04d}",
                    first_name=rng.choice(FIRST_NAMES),
                    last_name=rng.choice(LAST_NAMES),
                    faculty=faculty,
                    department=department,
                    level=level,
                    matric=f"{DEPT_CODES[department]}/{entry_year:02d}/{rng.randint(1000, 9999)}",
                )
            )
        return self.students

    # -------------------------------------------------------------- slots
    def _slots(self, created: date, student: Student) -> dict[str, str]:
        rng = self.rng
        course = _course(rng)
        course2 = _course(rng)
        while course2 == course:
            course2 = _course(rng)
        session_start = created.year if created.month >= 9 else created.year - 1
        return {
            "course": course,
            "course2": course2,
            "semester": rng.choice(("first", "second")),
            "n_times": rng.choice(("two", "three", "four", "several")),
            "weeks": str(rng.randint(2, 7)),
            "days": str(rng.randint(3, 12)),
            "hours": str(rng.randint(2, 6)),
            "months": str(rng.randint(2, 8)),
            "ca_score": str(rng.randint(18, 29)),
            "amount": f"{rng.choice((15, 25, 45, 60, 85, 120, 150, 185, 210)) * 1000:,}",
            "rrr": "".join(str(rng.randint(0, 9)) for _ in range(12)),
            "date": _fmt_date(created - timedelta(days=rng.randint(0, 30))),
            "deadline": _fmt_date(created + timedelta(days=rng.randint(2, 21))),
            "session": f"{session_start}/{session_start + 1}",
            "scholarship": rng.choice(SCHOLARSHIPS),
            "fee_type": rng.choice(FEE_TYPES),
            "hostel": rng.choice(HOSTELS),
            "location": rng.choice(LOCATIONS),
            "room": f"{rng.choice('ABCDE')}{rng.randint(1, 3)}{rng.randint(0, 2)}{rng.randint(1, 9)}",
            "floor": rng.choice(("ground", "first", "second", "third")),
            "time": rng.choice(("9pm", "10pm", "8:30pm", "11pm")),
            "level": student.level,
        }

    def _typo(self, text: str) -> str:
        rng = self.rng
        words = text.split(" ")
        for _ in range(rng.randint(1, 3)):
            i = rng.randrange(len(words))
            w = words[i]
            if len(w) > 4 and w.isalpha():
                j = rng.randrange(1, len(w) - 2)
                words[i] = w[:j] + w[j + 1] + w[j] + w[j + 2:]
        return " ".join(words)

    # -------------------------------------------------------------- dates
    def _daily_weights(self) -> list[float]:
        return [MONTH_VOLUME[(START_DATE + timedelta(days=d)).month] for d in range(SPAN_DAYS)]

    def _category_weights(self, month: int) -> list[float]:
        weights = []
        for scenario in SCENARIOS:
            multiplier = SEASONALITY.get(scenario.category, {}).get(month, 1.0)
            weights.append(scenario.weight * multiplier)
        return weights

    # -------------------------------------------------------------- rows
    def _shift_urgency(self, level: str, step: int) -> str:
        idx = max(0, min(len(URGENCY_LEVELS) - 1, URGENCY_LEVELS.index(level) + step))
        return URGENCY_LEVELS[idx]

    def _lifecycle(self, category: str, urgency: str) -> dict[str, str]:
        rng = self.rng
        urgency_factor = {"low": 1.25, "medium": 1.0, "high": 0.75, "critical": 0.55}[urgency]
        route = rng.lognormvariate(math.log(4.0), 0.9)
        first = rng.lognormvariate(math.log(FIRST_RESPONSE_MEDIAN_HOURS[category] * urgency_factor), 0.9)
        stalled = rng.random() < 0.06
        resolution = (
            ""
            if stalled
            else f"{rng.lognormvariate(math.log(RESOLUTION_MEDIAN_HOURS[category] * urgency_factor), 0.75):.2f}"
        )
        close = f"{rng.uniform(12, 96):.2f}" if resolution and rng.random() < 0.8 else ""
        return {
            "route_after_hours": f"{route:.2f}",
            "first_response_after_hours": f"{first:.2f}",
            "resolution_after_hours": resolution,
            "close_after_hours": close,
        }

    def _student_category(self, true_category: str, confusable: tuple[str, ...]) -> str:
        rng = self.rng
        roll = rng.random()
        if roll < 0.80:
            return true_category
        if roll < 0.92 and confusable:
            return rng.choice(confusable)
        if roll < 0.95:
            return rng.choice([c for c in CATEGORIES if c != true_category])
        return "other"

    def _compose(self, scenario: Scenario, created: date, student: Student) -> tuple[str, str, str, bool]:
        rng = self.rng
        slots = self._slots(created, student)
        title = rng.choice(scenario.titles).format(**slots)
        urgency = scenario.urgency
        parts: list[str] = [rng.choice(OPENERS), rng.choice(scenario.bodies).format(**slots)]

        short_form = rng.random() < 0.08
        if not short_form:
            impact = rng.choice(scenario.impacts) if scenario.impacts else ""
            if impact:
                parts.append(" " + impact.format(**slots))
                if "{deadline}" in impact:
                    urgency = self._shift_urgency(urgency, 1)
            if rng.random() < 0.3:
                parts.append(rng.choice(FOLLOW_UP).format(**slots))
            if rng.random() < 0.12:
                parts.append(rng.choice(PIDGIN))
            if rng.random() < 0.10:
                parts.append(rng.choice(URGENT_TAILS))
            parts.append(rng.choice(CLOSERS))

        ambiguous = False
        if rng.random() < 0.14:
            # Vague complaint: a generic frame with a weak (sometimes misleading)
            # cue. The true category is still the scenario's category.
            roll = rng.random()
            if roll < 0.70:
                cue_category = scenario.category
            elif roll < 0.85 and scenario.confusable_with:
                cue_category = rng.choice(scenario.confusable_with)
            else:
                cue_category = rng.choice(CATEGORIES)
            cue = rng.choice(VAGUE_CUES[cue_category])
            vague = rng.choice(VAGUE_FRAMES).format(cue=cue, **slots)
            title = rng.choice(GENERIC_TITLES) if rng.random() < 0.6 else vague.split(".")[0][:60].rstrip(" ,?")
            parts = [rng.choice(OPENERS), vague, rng.choice(CLOSERS)]
            short_form = False
            ambiguous = cue_category != scenario.category
        elif rng.random() < 0.12:
            # Multi-issue complaint: a secondary issue from another category is
            # mentioned; the label is the primary issue, which may come second.
            other = rng.choice([s for s in SCENARIOS if s.category != scenario.category])
            extra = rng.choice(other.bodies).format(**slots)
            if rng.random() < 0.4:
                title = rng.choice(other.titles).format(**slots)
            if rng.random() < 0.5:
                parts.append(" Also, " + extra[0].lower() + extra[1:])
            else:
                parts.insert(1, extra + " Apart from that, ")
            ambiguous = True

        # Human judgement is not perfectly consistent.
        if rng.random() < 0.10:
            urgency = self._shift_urgency(urgency, rng.choice((-1, 1)))

        description = "".join(parts).strip()
        if short_form:
            description = description.split(". ")[0].rstrip(".") + "."
        if rng.random() < 0.10:
            description = self._typo(description)
        if rng.random() < 0.04:
            description = description.lower()
        return title, description, urgency, ambiguous

    def build_grievances(self, count: int) -> list[dict[str, str]]:
        rng = self.rng
        rows: list[dict[str, str]] = []
        planted_total = sum(event.count for event in PLANTED_EVENTS)
        base_count = max(0, count - planted_total)
        day_weights = self._daily_weights()
        day_indexes = list(range(SPAN_DAYS))

        def created_at(day_offset: int) -> datetime:
            d = START_DATE + timedelta(days=day_offset)
            hour = _weighted_choice(rng, list(range(24)), [0.2] * 7 + [1.0] * 12 + [0.8] * 3 + [0.4] * 2)
            return datetime(d.year, d.month, d.day, hour, rng.randint(0, 59))

        for _ in range(base_count):
            offset = _weighted_choice(rng, day_indexes, day_weights)
            ts = created_at(offset)
            scenario = _weighted_choice(rng, SCENARIOS, self._category_weights(ts.month))
            student = rng.choice(self.students)
            title, description, urgency, ambiguous = self._compose(scenario, ts.date(), student)
            rows.append(
                self._row(ts, title, description, scenario.category, scenario.id, urgency,
                          ambiguous, "", student, scenario.confusable_with)
            )

        for event in PLANTED_EVENTS:
            for _ in range(event.count):
                offset = event.start_offset_days + min(
                    event.duration_days - 1, int(rng.triangular(0, event.duration_days, event.duration_days * 0.3))
                )
                ts = created_at(offset)
                student = rng.choice(self.students)
                slots = self._slots(ts.date(), student)
                description = (rng.choice(OPENERS) + rng.choice(event.bodies)
                               + (rng.choice(PIDGIN) if rng.random() < 0.15 else "")
                               + rng.choice(CLOSERS)).strip().format(**slots)
                if rng.random() < 0.10:
                    description = self._typo(description)
                rows.append(
                    self._row(ts, rng.choice(event.titles), description, event.category,
                              f"event_{event.tag}", event.urgency, False, event.tag, student, ())
                )

        rows.sort(key=lambda row: row["created_at"])
        for index, row in enumerate(rows, start=1):
            row["grievance_id"] = f"GRV-{index:05d}"
        return rows

    def _row(self, ts, title, description, category, scenario_id, urgency, ambiguous,
             event_tag, student: Student, confusable) -> dict[str, str]:
        row = {
            "grievance_id": "",
            "created_at": ts.isoformat(timespec="minutes"),
            "title": title,
            "description": description,
            "true_category": category,
            "student_selected_category": self._student_category(category, confusable),
            "expected_urgency": urgency,
            "scenario_id": scenario_id,
            "event_tag": event_tag,
            "is_ambiguous": "1" if ambiguous else "0",
            "is_anonymous": "1" if self.rng.random() < 0.08 else "0",
            "student_ref": student.ref,
            "faculty": student.faculty,
            "department": student.department,
            "level": student.level,
        }
        row.update(self._lifecycle(category, urgency))
        return row


GRIEVANCE_FIELDS = (
    "grievance_id", "created_at", "title", "description", "true_category",
    "student_selected_category", "expected_urgency", "scenario_id", "event_tag",
    "is_ambiguous", "is_anonymous", "student_ref", "faculty", "department", "level",
    "route_after_hours", "first_response_after_hours", "resolution_after_hours",
    "close_after_hours",
)
STUDENT_FIELDS = ("student_ref", "first_name", "last_name", "faculty", "department", "level", "matric")


def generate(seed: int = 42, count: int = 4000, students: int = 320, out_dir: Path = DATA_DIR) -> tuple[Path, Path]:
    generator = Generator(seed)
    population = generator.build_students(students)
    rows = generator.build_grievances(count)

    out_dir.mkdir(parents=True, exist_ok=True)
    grievance_path = out_dir / "grievances_synthetic.csv"
    student_path = out_dir / "students_synthetic.csv"

    with grievance_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=GRIEVANCE_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    with student_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=STUDENT_FIELDS)
        writer.writeheader()
        for student in population:
            writer.writerow({field: getattr(student, field if field != "student_ref" else "ref") for field in STUDENT_FIELDS})

    return grievance_path, student_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--count", type=int, default=4000)
    parser.add_argument("--students", type=int, default=320)
    args = parser.parse_args()
    grievance_path, student_path = generate(args.seed, args.count, args.students)
    print(f"Wrote {grievance_path}")
    print(f"Wrote {student_path}")


if __name__ == "__main__":
    main()
