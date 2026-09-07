---
name: SPA page containment
description: A layout constraint for pages switched by the app's show/hide router.
---

Independently navigated pages must be siblings of the main Home container, not descendants of it. The router hides Home during navigation, so any page nested inside Home becomes invisible even if it receives an active class.

**Why:** A collection route rendered as blank because its section was correctly activated but remained inside the hidden Home element.

**How to apply:** When adding a new routeable page, place its root section outside the container that the router hides, then verify both direct navigation and back navigation.