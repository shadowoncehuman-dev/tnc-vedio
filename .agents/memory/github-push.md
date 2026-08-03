---
name: GitHub push pattern
description: How to push to GitHub when gitPush() callback fails with NO_CREDENTIALS
---

The `gitPush()` CodeExecution callback fails with NO_CREDENTIALS even when `github_token` secret is set.

**Working pattern:**
```bash
git remote set-url origin "https://x-access-token:${github_token}@github.com/<owner>/<repo>"
git push origin main
```

**Why:** The platform's gitPush() callback looks for a Replit-connected GitHub account, not the `github_token` secret. Direct git with the token in the URL works reliably.

**How to apply:** Any time the user asks to push to GitHub and gitPush() returns NO_CREDENTIALS.
