"""Grievance scenario bank used by the synthetic dataset generator.

Each scenario describes one recurring type of complaint found in Nigerian
tertiary institutions. Templates contain ``{slot}`` placeholders that the
generator fills with randomised, context-appropriate values. ``urgency`` is the
severity an experienced grievance officer would assign to the scenario and is
used as the ground-truth urgency label; it is deliberately defined by the
situation, not by the words used, so the lexicon-based urgency model can be
evaluated against it rather than reproducing it.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Scenario:
    id: str
    category: str
    urgency: str
    weight: float
    titles: tuple[str, ...]
    bodies: tuple[str, ...]
    impacts: tuple[str, ...] = field(default_factory=tuple)
    # Categories a student might plausibly (but wrongly) pick for this case.
    confusable_with: tuple[str, ...] = field(default_factory=tuple)


CATEGORIES: tuple[str, ...] = (
    "academic",
    "bursary",
    "registry",
    "ict",
    "hostel",
    "security",
    "welfare",
)

SCENARIOS: tuple[Scenario, ...] = (
    # ------------------------------------------------------------------ academic
    Scenario(
        id="acad_result_missing",
        category="academic",
        urgency="medium",
        weight=1.4,
        titles=(
            "Result for {course} not released",
            "Missing result for {course}",
            "{course} score still not uploaded",
            "My {course} grade is missing",
        ),
        bodies=(
            "I wrote the {course} examination last semester but my result has still not been released. All my classmates have their scores but mine shows 'NR'.",
            "My result for {course} is missing from the result sheet even though I sat for the exam and submitted my answer script. The course lecturer said he has submitted the scores to the department.",
            "Since the {semester} semester results came out, {course} is the only course without a score for me. I have checked with the exams officer {n_times} times without any clear answer.",
        ),
        impacts=(
            "This is affecting my CGPA computation.",
            "I cannot tell whether I need to register the course again as a carry-over.",
            "My final year clearance depends on this result.",
        ),
        confusable_with=("registry", "ict"),
    ),
    Scenario(
        id="acad_grade_dispute",
        category="academic",
        urgency="medium",
        weight=1.1,
        titles=(
            "Request for remarking of {course}",
            "Wrong grade recorded for {course}",
            "Dispute over {course} continuous assessment",
            "My {course} score does not reflect my performance",
        ),
        bodies=(
            "I was given an F in {course} but I am confident I passed. My continuous assessment alone was {ca_score} out of 30. I want my script to be remarked.",
            "The CA score recorded for me in {course} is lower than what was announced in class. I have my marked test script as evidence and I want the score corrected.",
            "I scored {ca_score} in the {course} test but the portal shows a much lower total. I believe my test score was not added to the exam score.",
        ),
        impacts=(
            "This grade has pulled my CGPA below second class upper.",
            "If it is not corrected I will have to carry over the course.",
            "",
        ),
    ),
    Scenario(
        id="acad_lecturer_absent",
        category="academic",
        urgency="low",
        weight=0.9,
        titles=(
            "Lecturer has not attended {course} classes",
            "No lectures held for {course} this semester",
            "{course} classes keep getting cancelled",
        ),
        bodies=(
            "Since resumption the lecturer taking {course} has only come to class {n_times} times. We are {weeks} weeks into the semester and have not covered the course outline.",
            "Classes for {course} are always cancelled at the last minute. Students come from off-campus and wait for hours without any notice.",
            "We have not had any lecture for {course} for the past {weeks} weeks and nobody in the department is telling us anything.",
        ),
        impacts=(
            "Exams are approaching and we are not prepared.",
            "We are worried the exam will cover topics we were never taught.",
            "",
        ),
    ),
    Scenario(
        id="acad_timetable_clash",
        category="academic",
        urgency="high",
        weight=0.8,
        titles=(
            "Exam timetable clash between {course} and {course2}",
            "Two exams fixed at the same time",
            "Clash in the {semester} semester exam timetable",
        ),
        bodies=(
            "The released exam timetable fixed {course} and {course2} for the same day and time. Both are compulsory courses for my level.",
            "I am a {level} level student and two of my registered courses, {course} and {course2}, have been scheduled at the same time in the exam timetable.",
        ),
        impacts=(
            "The exams start on {deadline}, so I need this resolved before then.",
            "I cannot write both papers and I do not want to miss either.",
        ),
        confusable_with=("registry",),
    ),
    Scenario(
        id="acad_project_supervisor",
        category="academic",
        urgency="low",
        weight=0.6,
        titles=(
            "No project supervisor assigned",
            "Final year project supervisor not responding",
            "Delay in approving my project topic",
        ),
        bodies=(
            "I am in {level} level and I have not been assigned a project supervisor although other students got theirs {weeks} weeks ago.",
            "My project supervisor has not responded to my chapter submissions for {weeks} weeks. I have gone to the office several times.",
            "I submitted three project topics to the department since the beginning of the session and none has been approved yet.",
        ),
        impacts=("I am falling behind the departmental submission schedule.", ""),
    ),
    Scenario(
        id="acad_siwes_letter",
        category="academic",
        urgency="medium",
        weight=0.5,
        titles=(
            "SIWES placement letter not issued",
            "Delay in SIWES documents",
            "IT logbook and placement letter still not ready",
        ),
        bodies=(
            "Our SIWES placement letters were supposed to be ready {weeks} weeks ago but the department keeps asking us to come back.",
            "The company that accepted me for industrial training needs my SIWES letter from the school but it has not been signed.",
        ),
        impacts=("The company has given me a deadline of {deadline}.", "I may lose the placement."),
        confusable_with=("registry",),
    ),
    # ------------------------------------------------------------------ bursary
    Scenario(
        id="burs_payment_not_reflected",
        category="bursary",
        urgency="high",
        weight=1.6,
        titles=(
            "School fees paid but not reflecting",
            "Remita payment not confirmed",
            "Fees payment shows unpaid",
            "Paid tuition still showing as owing",
        ),
        bodies=(
            "I paid my school fees of N{amount} through Remita with RRR {rrr} on {date} and my bank has confirmed the debit, but my account still shows that I owe.",
            "My tuition was debited from my account since {date} but the bursary has not confirmed it. The RRR number is {rrr}.",
            "I made payment for my {session} school fees and got the Remita receipt but the portal still shows outstanding balance of N{amount}.",
        ),
        impacts=(
            "Because of this I cannot register my courses and registration closes on {deadline}.",
            "I have been told I will not be allowed to write exams if the fees are not confirmed.",
            "I cannot print my exam card.",
        ),
        confusable_with=("ict",),
    ),
    Scenario(
        id="burs_double_debit",
        category="bursary",
        urgency="medium",
        weight=0.7,
        titles=(
            "Charged twice for the same fee",
            "Double debit on acceptance fee",
            "Request for refund of double payment",
        ),
        bodies=(
            "I was debited twice for {fee_type} (N{amount} each) on {date}. I have both bank alerts and the two RRR numbers.",
            "My parents paid {fee_type} and the money was taken twice from the account. I want the extra payment refunded or used for next session.",
        ),
        impacts=("That money was meant for my upkeep this semester.", ""),
    ),
    Scenario(
        id="burs_refund_delay",
        category="bursary",
        urgency="low",
        weight=0.7,
        titles=(
            "Refund still not processed",
            "Delay in refund of excess payment",
            "Caution fee refund pending",
        ),
        bodies=(
            "I applied for a refund of N{amount} excess payment {months} months ago and have not received anything. The bursary keeps saying it is being processed.",
            "My caution fee refund has been pending since I graduated. I have submitted all the documents they asked for.",
        ),
        impacts=("",),
    ),
    Scenario(
        id="burs_scholarship",
        category="bursary",
        urgency="medium",
        weight=0.5,
        titles=(
            "Scholarship not applied to my fees",
            "Fee waiver not reflected",
            "Scholarship payment still pending",
        ),
        bodies=(
            "I am a beneficiary of the {scholarship} scholarship but my fees account still shows the full amount of N{amount}.",
            "The approved fee waiver for my session has not been applied. I was asked to pay the full fees before I can register.",
        ),
        impacts=("I cannot afford to pay the full amount.", ""),
    ),
    Scenario(
        id="burs_wrong_fee",
        category="bursary",
        urgency="low",
        weight=0.6,
        titles=(
            "Wrong fee amount on my invoice",
            "Charged new-student fees as a returning student",
            "Incorrect departmental dues",
        ),
        bodies=(
            "My fee invoice for this session is N{amount} which is the amount for new students. I am a {level} level returning student.",
            "The invoice generated for me includes charges that do not apply to my programme. I need the correct invoice before I pay.",
        ),
        impacts=("",),
        confusable_with=("ict",),
    ),
    # ------------------------------------------------------------------ registry
    Scenario(
        id="reg_transcript",
        category="registry",
        urgency="medium",
        weight=1.0,
        titles=(
            "Transcript request pending for months",
            "Transcript not yet sent",
            "Delay in processing my transcript",
        ),
        bodies=(
            "I applied and paid for my transcript {months} months ago and it has not been sent to the receiving institution.",
            "My transcript request made on {date} is still showing 'processing'. I need it for my postgraduate admission.",
        ),
        impacts=(
            "The university abroad has given me a deadline.",
            "I may lose my admission offer.",
            "",
        ),
    ),
    Scenario(
        id="reg_name_error",
        category="registry",
        urgency="low",
        weight=0.8,
        titles=(
            "Wrong spelling of my name in records",
            "Date of birth wrong in my record",
            "Correction of personal data",
        ),
        bodies=(
            "My surname is spelt wrongly on my student record and on my ID card. I submitted my birth certificate for correction {months} months ago.",
            "My date of birth on the school record is different from my JAMB and birth certificate. I need it corrected before graduation.",
        ),
        impacts=("It will appear wrongly on my certificate if not corrected.", ""),
        confusable_with=("ict",),
    ),
    Scenario(
        id="reg_clearance",
        category="registry",
        urgency="medium",
        weight=0.9,
        titles=(
            "Final clearance not completed",
            "NYSC mobilisation list omitted my name",
            "Clearance for graduation delayed",
        ),
        bodies=(
            "My name was not included in the NYSC mobilisation list even though I have completed all my clearance.",
            "I have completed departmental clearance but the registry has not signed my final clearance form for {weeks} weeks.",
        ),
        impacts=(
            "The mobilisation deadline is {deadline}.",
            "My classmates have already been mobilised.",
        ),
        confusable_with=("academic",),
    ),
    Scenario(
        id="reg_admission_letter",
        category="registry",
        urgency="medium",
        weight=0.6,
        titles=(
            "Admission letter not issued",
            "Unable to get my admission letter",
            "Admission status not updated",
        ),
        bodies=(
            "I accepted my admission and paid the acceptance fee but I have not been able to print my admission letter.",
            "My admission status on the JAMB CAPS shows admitted but the school record has not been updated.",
        ),
        impacts=("Without it I cannot complete registration.", ""),
        confusable_with=("ict", "bursary"),
    ),
    Scenario(
        id="reg_certificate",
        category="registry",
        urgency="low",
        weight=0.4,
        titles=("Certificate collection delay", "Statement of result not ready"),
        bodies=(
            "I graduated {months} months ago and I have not been able to collect my statement of result.",
            "The registry told us that certificates would be ready but every time I come there is a new excuse.",
        ),
        impacts=("I need it for a job application.",),
    ),
    # ------------------------------------------------------------------ ict
    Scenario(
        id="ict_portal_login",
        category="ict",
        urgency="medium",
        weight=1.3,
        titles=(
            "Cannot log in to the student portal",
            "Portal password reset not working",
            "Portal login error",
        ),
        bodies=(
            "I have not been able to log in to the student portal since {date}. It keeps saying invalid credentials even after resetting my password.",
            "The password reset link from the portal never arrives in my email. I have tried {n_times} times.",
            "When I try to log in the portal just loads and returns an error page.",
        ),
        impacts=(
            "I cannot check my result or register my courses.",
            "I need to print my exam card.",
            "",
        ),
    ),
    Scenario(
        id="ict_course_reg",
        category="ict",
        urgency="high",
        weight=1.1,
        titles=(
            "Course registration page not loading",
            "Unable to add courses on the portal",
            "Course registration form keeps failing",
        ),
        bodies=(
            "The course registration page does not load for me. After selecting my courses and submitting, it shows a server error.",
            "I cannot add {course} to my course form. The portal says the course is not available for my level.",
            "The portal saved only part of my course registration and now it will not let me edit it.",
        ),
        impacts=(
            "Registration closes on {deadline}.",
            "If I don't register I will not be allowed to write the exam.",
        ),
        confusable_with=("academic",),
    ),
    Scenario(
        id="ict_wifi",
        category="ict",
        urgency="low",
        weight=0.9,
        titles=(
            "No internet access in {location}",
            "Campus Wi-Fi not working",
            "Internet connection very slow",
        ),
        bodies=(
            "The campus Wi-Fi in {location} has not been working for {weeks} weeks.",
            "The internet in the e-library is so slow that it is not possible to download course materials.",
        ),
        impacts=("We need the internet for assignments and research.", ""),
    ),
    Scenario(
        id="ict_email",
        category="ict",
        urgency="low",
        weight=0.5,
        titles=("School email account not created", "Cannot access student email"),
        bodies=(
            "I was told every student would get a school email account but mine has not been created.",
            "My student email stopped working and I am missing messages from lecturers.",
        ),
        impacts=("",),
    ),
    Scenario(
        id="ict_elearning",
        category="ict",
        urgency="medium",
        weight=0.6,
        titles=("Cannot access e-learning platform", "Online test did not submit"),
        bodies=(
            "The e-learning platform logged me out in the middle of the {course} online test and my answers were not submitted.",
            "I cannot access the course materials for {course} on the e-learning platform.",
        ),
        impacts=("The test counts towards my continuous assessment.", ""),
        confusable_with=("academic",),
    ),
    # ------------------------------------------------------------------ hostel
    Scenario(
        id="hostel_water",
        category="hostel",
        urgency="medium",
        weight=1.2,
        titles=(
            "No water supply in {hostel}",
            "Water shortage in the hostel",
            "Borehole not working in {hostel}",
        ),
        bodies=(
            "There has been no running water in {hostel} for {days} days. Students are buying sachet water to bathe.",
            "The borehole pump in {hostel} has broken down and the taps have been dry since {date}.",
            "We fetch water from outside the hostel every morning because there is no water in {hostel}.",
        ),
        impacts=(
            "The toilets are now in a terrible condition.",
            "This is becoming a health hazard.",
            "",
        ),
        confusable_with=("welfare",),
    ),
    Scenario(
        id="hostel_power",
        category="hostel",
        urgency="low",
        weight=1.0,
        titles=(
            "No electricity in {hostel}",
            "Power outage in the hostel",
            "Faulty wiring in my room",
        ),
        bodies=(
            "{hostel} has not had electricity for {days} days. The generator is not switched on at night.",
            "The sockets in room {room} of {hostel} spark whenever we plug anything in.",
        ),
        impacts=("We cannot read at night.", "It could cause a fire.", ""),
    ),
    Scenario(
        id="hostel_allocation",
        category="hostel",
        urgency="medium",
        weight=1.0,
        titles=(
            "Bedspace allocated to another student",
            "Hostel allocation problem",
            "Paid for hostel but no bedspace",
        ),
        bodies=(
            "I paid N{amount} for hostel accommodation but when I arrived I found another student in the bedspace allocated to me in {hostel}.",
            "I paid for accommodation since {date} but I have not been allocated a room.",
        ),
        impacts=(
            "I am currently squatting with a friend.",
            "I have nowhere to stay.",
        ),
        confusable_with=("bursary",),
    ),
    Scenario(
        id="hostel_maintenance",
        category="hostel",
        urgency="low",
        weight=0.9,
        titles=(
            "Broken door and window in room {room}",
            "Leaking roof in {hostel}",
            "Toilets blocked in the hostel",
        ),
        bodies=(
            "The door lock of room {room} in {hostel} is broken, so we cannot lock the room when we go for lectures.",
            "The roof above room {room} leaks every time it rains and our mattresses are soaked.",
            "All the toilets on the {floor} floor of {hostel} have been blocked for {days} days.",
        ),
        impacts=("We reported to the porter but nothing has been done.", ""),
        confusable_with=("security",),
    ),
    # ------------------------------------------------------------------ security
    Scenario(
        id="sec_theft",
        category="security",
        urgency="high",
        weight=1.0,
        titles=(
            "Laptop stolen from my room",
            "Phone stolen in the lecture hall",
            "Theft in {hostel}",
        ),
        bodies=(
            "My laptop was stolen from my room in {hostel} on {date}. The door was forced open while we were in class.",
            "My phone was stolen in {location}. There was no security man around.",
            "Several rooms in {hostel} were broken into last night and phones and laptops were taken.",
        ),
        impacts=(
            "All my project work was on the laptop.",
            "We no longer feel safe in the hostel.",
            "",
        ),
        confusable_with=("hostel",),
    ),
    Scenario(
        id="sec_harassment",
        category="security",
        urgency="critical",
        weight=0.6,
        titles=(
            "Harassment near {location}",
            "Students being attacked at night",
            "Report of assault",
        ),
        bodies=(
            "Female students are being harassed by a group of men near {location} at night.",
            "I was attacked and robbed on my way back from {location} around {time}.",
            "A student was assaulted near the back gate and nobody from security responded to our calls.",
        ),
        impacts=(
            "Something must be done before someone is seriously hurt.",
            "We are afraid to walk back from night class.",
        ),
        confusable_with=("welfare",),
    ),
    Scenario(
        id="sec_lighting",
        category="security",
        urgency="medium",
        weight=0.6,
        titles=(
            "No street lights on the road to {hostel}",
            "Dark footpath is unsafe",
        ),
        bodies=(
            "The road from {location} to {hostel} has no working street lights and it is very dark at night.",
            "The footpath behind the faculty is completely dark and bushy, and students have been robbed there.",
        ),
        impacts=("It is not safe for students coming back from night class.", ""),
        confusable_with=("hostel",),
    ),
    Scenario(
        id="sec_gate",
        category="security",
        urgency="low",
        weight=0.5,
        titles=(
            "Rude treatment at the main gate",
            "Denied entry despite valid ID card",
        ),
        bodies=(
            "The security officers at the main gate refused me entry although I showed my valid student ID card.",
            "Security men at the gate are extorting money from students who come in after {time}.",
        ),
        impacts=("",),
    ),
    # ------------------------------------------------------------------ welfare
    Scenario(
        id="wel_clinic",
        category="welfare",
        urgency="high",
        weight=0.9,
        titles=(
            "Poor treatment at the health centre",
            "No doctor on duty at the clinic",
            "Clinic refused to attend to me",
        ),
        bodies=(
            "I went to the school clinic with high fever and waited for {hours} hours before a nurse saw me.",
            "There was no doctor on duty at the health centre on {date} when my roommate collapsed.",
            "The clinic said my medical registration is not valid although I paid the health fee.",
        ),
        impacts=(
            "Students' lives are at risk.",
            "I had to go to a private hospital outside campus.",
            "",
        ),
        confusable_with=("bursary",),
    ),
    Scenario(
        id="wel_counselling",
        category="welfare",
        urgency="medium",
        weight=0.6,
        titles=(
            "Need counselling support",
            "Counselling appointment keeps being postponed",
        ),
        bodies=(
            "I have been going through a very difficult time emotionally and I booked a counselling appointment but it has been postponed {n_times} times.",
            "I need someone to talk to about stress and anxiety but the counselling unit is always closed.",
        ),
        impacts=("It is affecting my studies.", ""),
    ),
    Scenario(
        id="wel_disability",
        category="welfare",
        urgency="medium",
        weight=0.4,
        titles=(
            "No ramp access for wheelchair users",
            "Special exam arrangement not provided",
        ),
        bodies=(
            "I use a wheelchair and the lecture theatre for {course} has no ramp, so I cannot attend lectures.",
            "I am visually impaired and I requested large-print exam papers but it was not provided.",
        ),
        impacts=("",),
        confusable_with=("academic",),
    ),
    Scenario(
        id="wel_cafeteria",
        category="welfare",
        urgency="low",
        weight=0.6,
        titles=(
            "Poor food hygiene at the cafeteria",
            "Food poisoning after eating at the cafeteria",
        ),
        bodies=(
            "The cafeteria near {location} serves food in dirty plates and there are flies everywhere.",
            "Several students got stomach upset after eating at the cafeteria on {date}.",
        ),
        impacts=("",),
        confusable_with=("hostel",),
    ),
)

# Planted emerging issues. Each event injects extra grievances for a short
# window so that the topic model has a real signal to discover.
@dataclass(frozen=True)
class PlantedEvent:
    tag: str
    category: str
    urgency: str
    start_offset_days: int  # days after the dataset start date
    duration_days: int
    count: int
    titles: tuple[str, ...]
    bodies: tuple[str, ...]


PLANTED_EVENTS: tuple[PlantedEvent, ...] = (
    PlantedEvent(
        tag="portal_outage_registration",
        category="ict",
        urgency="high",
        start_offset_days=190,
        duration_days=10,
        count=120,
        titles=(
            "Portal down during course registration",
            "Student portal not opening",
            "Portal crashed while registering courses",
        ),
        bodies=(
            "The student portal has been down since yesterday and course registration is ending soon. The site shows 503 service unavailable.",
            "The portal crashes every time I try to submit my course registration. Many students in my department have the same problem.",
            "Since the portal upgrade, nobody can log in to register courses. The page keeps timing out.",
        ),
    ),
    PlantedEvent(
        tag="hostel_water_crisis",
        category="hostel",
        urgency="high",
        start_offset_days=370,
        duration_days=21,
        count=110,
        titles=(
            "Water crisis in Moremi Hall",
            "No water in Moremi Hall for days",
            "Moremi Hall borehole failure",
        ),
        bodies=(
            "Moremi Hall has had no water for over a week since the borehole pump broke down. Students are bathing with sachet water and the toilets are overflowing.",
            "The water situation in Moremi Hall is now critical. The tanker that was promised has not come and students are falling sick.",
            "There is no water in any block of Moremi Hall. We have to trek to the stream behind the hostel to fetch water.",
        ),
    ),
    PlantedEvent(
        tag="backgate_robbery_spike",
        category="security",
        urgency="critical",
        start_offset_days=250,
        duration_days=14,
        count=80,
        titles=(
            "Robbery at the back gate",
            "Students robbed on the back gate route",
            "Armed robbery along back gate road",
        ),
        bodies=(
            "Students returning to off-campus hostels through the back gate are being robbed at gunpoint at night. Three of my friends lost their phones this week.",
            "Another robbery happened on the back gate road last night. There are no security patrols and no street lights.",
            "A gang is attacking students at the back gate after 8pm. Please increase security patrols urgently.",
        ),
    ),
    PlantedEvent(
        tag="remita_double_debit",
        category="bursary",
        urgency="high",
        start_offset_days=520,
        duration_days=12,
        count=90,
        titles=(
            "Remita debited twice for school fees",
            "Double deduction on Remita payment",
            "Duplicate Remita charge for fees",
        ),
        bodies=(
            "Remita deducted my school fees twice today and the portal still shows unpaid. Many students have the same double debit problem.",
            "After the new Remita integration, my fees were charged twice and I received two RRR numbers. I need a refund of the second payment.",
            "The bursary should look into the Remita double debit issue. My account was debited twice and I have not been able to register.",
        ),
    ),
)


# Vague complaints: a generic frame plus a weak category cue. Real grievance
# text is often short and under-specified; these keep the task realistic.
VAGUE_FRAMES: tuple[str, ...] = (
    "I have been going up and down for {weeks} weeks about {cue} and nobody is attending to me.",
    "The office keeps sending me back and forth over {cue}.",
    "Nobody has responded to my complaint about {cue} since {date}.",
    "I am tired of this school. The problem with {cue} has not been solved.",
    "Please who do I see about {cue}? I have been to three offices already.",
    "Still waiting for a response on {cue}. This is very frustrating.",
    "They told me to come back next week about {cue}, this is the {n_times} time.",
)

VAGUE_CUES: dict[str, tuple[str, ...]] = {
    "academic": ("my result", "my score", "my course", "my project", "the lecturer", "my CA"),
    "bursary": ("my payment", "my fees", "my receipt", "my refund", "the money I paid"),
    "registry": ("my documents", "my transcript", "my record", "my clearance", "my letter"),
    "ict": ("my portal account", "the portal", "my password", "the website", "my registration online"),
    "hostel": ("my room", "the hostel", "my bedspace", "the porter", "the toilets"),
    "security": ("my stolen phone", "the security men", "the incident", "what happened to me at night"),
    "welfare": ("my health", "the clinic", "my medical", "counselling", "my wellbeing"),
}
