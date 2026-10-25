# Owner to-do

Items only Vasu can settle. Nothing on the site was invented: where the
résumé didn't say something, the site leaves it out.

| # | What's needed | Where it's used | Status |
|---|---|---|---|
| 1 | **Phone number in `resume.pdf`**: the PDF at the repo root is the résumé as supplied, and it includes your phone number. Publishing the site makes it public | Every "Résumé" link | The site pages themselves show no phone number. Before going live, confirm that's fine or supply a PDF without it |
| 2 | **Internship title and dates** at Gheo Organics LLP | Home "Experience" | The résumé gives neither, so the entry shows only the company and what you did |
| 3 | **GitHub profile and project links** (repos or live demos) | Footer, contact, project briefs | No links yet; the briefs have no "source" section |
| 4 | **A result for the genre classifier** (e.g. F1 or accuracy and the dataset size) | Home work row, genre brief | The other two projects show their numbers; this one has none |
| 5 | **Where it will be hosted** (custom domain or `username.github.io/repo`) | canonical, og:url, social image, sitemap | Run `npm run set:url -- https://…/` once known |
| 6 | **What you're looking for** (internships, full-time from 2027, roles) | Hero status line | Left out; the template has room for one line |
| 7 | **Optional photo** | About | About is a single text column without one |
