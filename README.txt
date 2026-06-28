FLASHYAF™ WEBSITE — README
============================

WHAT'S IN THIS FOLDER
----------------------
Pages:
  index.html............ Homepage
  the-problem.html ...... The Problem
  solution.html .......... The Solution
  founder.html ........... Meet the Founder
  roadmap.html ........... Community Roadmap
  beta-tester.html ........ Become a Pioneer Beta Member
  pricing.html ............ Pricing (MODE / GROW / FLOW + Pioneer rates)
  waitlist.html ........... Standalone "Join the Waitlist" page
  contact.html ............ Contact info
  faq.html ................ FAQ (partial — more coming)
  privacy-policy.html ..... Privacy Policy
  terms-of-use.html ....... Terms of Use
  404.html ................ "Page not found" error page

Supporting files:
  styles.css .............. All site styling (one shared file, every page links to it)
  script.js ................ Shared JavaScript (waitlist/beta forms, back-to-top button)
  assets/ .................. Images (see below)

assets/ folder:
  hero-photo.png .......... Homepage hero photo (you, fire background)
  founder-photo.png ....... Founder page photo
  solution-chart.png ...... Real app screenshot used on the Solution page and
                             the homepage phone mockup


HOW TO PREVIEW ON YOUR COMPUTER
---------------------------------
1. Unzip this whole folder (don't open files directly from inside the zip —
   extract first, or images/styling won't load).
2. Double-click index.html. It opens in your browser.
3. Click through the nav to check every page.


HOW TO PUT THIS LIVE (flashyafapp.com via Netlify + GitHub)
--------------------------------------------------------------
You're already set up with:
  - GitHub repo: Mia10105/FLASHYAF---App
  - Hosting: Netlify (connected to that repo)
  - Domain: flashyafapp.com

To update the live site:
1. Go to your GitHub repo in a browser.
2. Delete the old files there (or just upload over them — GitHub will ask
   to replace files with the same name).
3. Upload every file from this folder, keeping the same folder structure
   (the assets/ folder needs to stay a folder, not get flattened).
4. Commit the changes.
5. Netlify will auto-redeploy from GitHub within a minute or two. If it
   doesn't, log into Netlify and trigger a manual "Deploy" / "Trigger deploy".


SWAPPING IN NEW PHOTOS LATER
-------------------------------
Just replace the file inside assets/ with the same exact filename
(e.g. drop a new hero-photo.png in to replace the old one) — you don't need
to touch any HTML to make that work, since every page just points to that
filename.


WAITLIST / BETA SIGNUP FORMS — IMPORTANT
-------------------------------------------
Right now, every signup form (waitlist + Pioneer Beta) just shows a
"Thanks!" popup when submitted — it does NOT actually collect emails
anywhere yet. Before launch, these need to be connected to your real
email platform (Brevo, per your notes) so submissions actually go
somewhere. Let Claude know when you're ready to wire that up.


QUESTIONS / NEXT STEPS STILL OPEN
------------------------------------
- Flame+face two-tone logo image (Canva) — not yet added, swap-in pending
- Stage-colored dots on the live app chart — that's an app-build item,
  not a website file
- FAQ page — only has 1 question so far, more to come
- script.js currently only handles forms + back-to-top; no other
  interactivity is wired up yet
