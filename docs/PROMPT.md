PROMPT.md — Technical Architecture & PWA Deployment

Deployment Model: PWA
* The multi-file source (index.html, style.css, script.js) is the primary deployment target and shipped form of the app.
* Include a web app manifest (manifest.json) and service worker (sw.js) that pre-caches all project files for offline play.
* Update the sw.js precache list whenever files are added, renamed, or removed.
* Served over HTTPS with no backend or build step required for deployment.

Optional Single-File Build ("Test Build")
* A single self-contained HTML file (jester-and-moat.html) may be compiled using the build.js script to concatenate index.html, style.css, and script.js only upon explicit request for quick local phone testing on Android over file:// via Acode.
* Keep the single-file build out of the primary PWA deployment path.