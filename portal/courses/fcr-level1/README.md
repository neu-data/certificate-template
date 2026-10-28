# Certificate portal: Foundations of Clinical Research — Level 1

The same portal as *Clinical Data Analysis in R — Phase I* (see [`../../README.md`](../../README.md)), with this course's details. It runs as its **own** Apps Script project, so the two courses keep separate eligible lists, registers and certificate IDs.

![Certificate preview](preview.png)

| | |
|---|---|
| Course | Foundations of Clinical Research — Level 1 |
| Printed details | 8 online sessions · 24 contact hours · 1 November – 19 December 2026 · Online |
| Issue date | 11-01-2027 (certificates go out after the revision deadline, 9 January 2027) |
| Certificate IDs | `NDC-FCR-2026-1-10XX-NNN` |
| Trainers | Vương Mỹ Lượng (Lead Trainer), Bernard Isekah Osang'ir (Trainer) |
| Survey code | `NDC-FCR-SURVEY-2026` (shown when the course evaluation form is submitted) |

## Who gets a certificate

The portal checks four things, in this order:

1. **Course feedback first.** The participant completes the course evaluation form; its confirmation page shows the survey code `NDC-FCR-SURVEY-2026`, which the certificate page asks for.
2. **Not before 11 January 2027.** Certificates are issued only after the final feedback (the revision deadline is 9 January 2027). Before that date the page says when to come back. Change the date in `REG.opensOn` in [`Registration.gs`](Registration.gs).
3. **Registered.** The email must be on the course registration list, the Excel list of people who registered.
4. **Followed the course.** On the same list: 6 or more sessions attended, and the proposal, Results draft, review and revision all submitted.

The participant then proves the email is theirs with a 6-digit code, and enters their official name.

### The registration list

Columns in the first row (any order; other columns are ignored):

| Email | Full name | Sessions attended | Proposal | Results draft | Review | Revision |
|---|---|---|---|---|---|---|
| nguyen.an@gmail.com | Nguyễn An | 7 | yes | yes | yes | yes |

A submission counts when its cell says yes, có, x, ✓ or 1. To update it, either edit the Google Sheet *FCR Level 1 · Registration list* directly, or upload the Excel file into *Neudata Certificates* with a name starting `FCR Level 1 · Registration list` (for example `FCR Level 1 · Registration list.xlsx`) and run **`importRegistrationList`**. The log says how many are registered and how many qualify.

## Drive

It uses the same **Neudata Certificates** folder as the other course, so the trainers' signature files (`signature-my-luong.png`, `signature-bernard.png`) are shared. Everything else has its own name:

```
Neudata Certificates/
├── FCR Level 1 · Registration list          ← Google Sheet: who registered and what they completed
├── FCR Level 1 · Issued certificates/
├── FCR Level 1 · Certificate register
├── FCR Level 1 · Certificate template (do not delete)
└── FCR Level 1 · Course evaluation          ← Google Form made by setupSurvey()
```

## One-time setup (about 10 minutes)

Signed in as **b.osangir@gmail.com**:

1. <https://script.google.com> → **New project**, named *Neudata certificate portal · FCR Level 1*.
2. **Project Settings** → tick **Show "appsscript.json" manifest file in editor**.
3. Paste the files from [`apps-script/`](apps-script/): `appsscript.json`, `Code.gs`, new script files `Survey.gs` and `Registration.gs`, and HTML files `Portal`, `Verify` and `Submit`.
4. Run **`setup`**, approve the permissions. It creates the folders, the empty registration list and the certificate template from [`certificate-template.pptx`](certificate-template.pptx).
5. Run **`setupSurvey`**, approve the Forms permission. The log shows the evaluation form link: use it for the course evaluation in Session 8 too.
6. **Deploy → New deployment → Web app**, *Execute as:* Me, *Who has access:* Anyone. Copy the Web app URL: this is the certificate link for participants.
7. Test: run `addMeToEligibleList` (adds you to the registration list as a completed participant; as the owner you can test before 11 January), open the URL, submit the survey, generate your certificate, then run `voidMyCertificate` and delete your row from the list.
8. After the course: fill in or import the registration list (see above).

The Web app URL goes on the course website's Certificate page.

## Changing it

| What | Where |
|---|---|
| Printed course text, dates, issue date | `background` in [`course.json`](course.json), then `python portal/make_background.py courses/fcr-level1`, push, and run `setup` again |
| Emails, portal pages, folder names, ID prefix | `portal` in [`course.json`](course.json), then `python portal/make_course.py courses/fcr-level1` and paste the changed files into the project |
| Survey questions | [`Survey.gs`](Survey.gs) (before running `setupSurvey`) |
| Opening date, minimum sessions, required columns | `REG` in [`Registration.gs`](Registration.gs) |
| Preview | `python portal/preview.py "Participant Name" courses/fcr-level1 NDC-FCR-2026-1-1047-001` |

The preview uses a local font without Vietnamese accents; the real certificate sets the name in Google Slides, which shows them.

When the shared portal files change, run `make_course.py` again: it stops if one of this course's replacements no longer matches.
