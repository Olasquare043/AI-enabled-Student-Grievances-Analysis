# Dataset card: Synthetic Nigerian Student Grievances (v1)

## Summary

| Item | Value |
| --- | --- |
| Files | `grievances_synthetic.csv` (4,000 rows), `students_synthetic.csv` (320 rows) |
| Period covered | 6 Apr 2025 – 27 Sep 2026 (540 days, two academic sessions) |
| Language | English, with occasional Nigerian Pidgin phrases |
| Labels | `true_category` (7 classes), `expected_urgency` (4 levels), `event_tag` |
| Generator | `backend/app/data_gen/generate_dataset.py --seed 42` (deterministic) |
| Provenance | **Fully synthetic.** No real student, staff or institutional record was collected or used. |

## Why synthetic

No Nigerian institution has released a public, labelled corpus of student complaints. Real grievance records are
also personal data under the Nigeria Data Protection Act 2023. The dataset is therefore simulated. It is built to show
every function of the system and to support a reproducible evaluation. It is **not** a claim about the grievance
profile of any specific institution.

## How it is generated

1. **Student population.** 320 students across 6 faculties and 18 departments, levels 100–500, with plausible matric
   numbers (e.g. `CSC/24/1234`).
2. **Scenario bank.** 37 recurring complaint scenarios (`app/data_gen/scenarios.py`), grouped into the 7 routing
   categories: academic, bursary, registry, ict, hostel, security, welfare. Each scenario has several title and body
   templates, and slots are filled with random course codes, amounts, Remita RRR numbers, hall names, dates and similar.
3. **Academic-calendar seasonality.** Monthly volume and category mix follow the Nigerian calendar: resumption and
   registration in Oct–Nov (bursary and ICT peaks), exams in Feb and Jul, results complaints in Mar–Apr and Sep, and
   a low in the August vacation.
4. **Realistic noise.**
   - About 14% of complaints are vague: generic wording with a weak or misleading cue.
   - About 12% are multi-issue complaints, where a second issue is mentioned and the title may name it.
   - 10% contain typos, 4% are all lower case, 12% include Pidgin phrases, and 8% are very short.
   - 509 records (12.7%) are flagged `is_ambiguous`.
5. **Student-selected category.** This simulates the drop-down choice students make. It differs from the true
   category in 775 records (19.4%), including 195 "other".
6. **Planted emerging issues** (400 records). These test whether topic modelling can detect them:

   | `event_tag` | Category | Start | Records |
   |---|---|---|---|
   | `portal_outage_registration` | ict | 2025-10-13 | 120 |
   | `backgate_robbery_spike` | security | 2025-12-12 | 80 |
   | `hostel_water_crisis` | hostel | 2026-04-11 | 110 |
   | `remita_double_debit` | bursary | 2026-09-08 | 90 |

7. **Lifecycle.** Routing delay, first-response time and resolution time are drawn from log-normal distributions per
   category, and are shorter for more urgent cases. 217 cases are "stalled" and never resolve on time. The seeder
   replays these against the departmental SLA policies to generate status history and SLA breach and escalation events.

## Class distribution

| Category | Records | Share |
| --- | --- | --- |
| academic | 787 | 19.7% |
| ict | 666 | 16.7% |
| hostel | 648 | 16.2% |
| bursary | 647 | 16.2% |
| registry | 495 | 12.4% |
| security | 450 | 11.3% |
| welfare | 307 | 7.7% |

Urgency: low 1,182 · medium 1,489 · high 971 · critical 358. Mean description length: 33 words (range 2–92).

## Label definitions

- **`true_category`**: the department that must act on the primary issue.
- **`expected_urgency`**: the severity an experienced grievance officer would assign. It is set by the *situation*
  (safety threats are critical, blocked registration before a deadline is high), not by the words used. Deadlines
  raise it one level, and 10% of labels are shifted ±1 to reflect inconsistent human judgement.

## Columns (`grievances_synthetic.csv`)

`grievance_id`, `created_at`, `title`, `description`, `true_category`, `student_selected_category`,
`expected_urgency`, `scenario_id`, `event_tag`, `is_ambiguous`, `is_anonymous`, `student_ref`, `faculty`,
`department`, `level`, `route_after_hours`, `first_response_after_hours`, `resolution_after_hours`,
`close_after_hours`.

## Intended use and limitations

- Use it for demonstrating and evaluating the grievance framework, for teaching, and for reproducing the thesis
  results.
- Template-based text is more regular than real complaints. Accuracy on real data is expected to be lower, and the
  models should be retrained on institutional data before any operational use.
- The category set, calendar and vocabulary reflect a generic Nigerian university. They are not tuned to one
  institution.
- Urgency labels come from rules, so urgency metrics measure agreement with those rules.
