---
title: Lovely
subtitle: 'Lovely: Relationship Growth (iOS)'
track: 1
side: A
# DRAFT: Holden to edit
tagline: 'A relationship-growth app, live on the App Store. I co-founded it and built the AI gateway, the security layer and subscription billing.'
role: Co-Founder & Engineer, Lovely LLC
date: Nov 2025–present
stack:
  - FastAPI
  - React Native (Expo, New Architecture)
  - Firebase/Firestore
  - RevenueCat
  - EAS Build
headlineStats:
  - value: '40+'
    context: 'beta users on stable builds before the production App Store release'
  - value: 'First paying subscribers'
    context: 'after launch, via RevenueCat subscriptions and free trials'
proof:
  - kind: appstore
    label: App Store
    url: https://apps.apple.com/us/app/lovely-relationship-growth/id6758863491
---

## The problem

<!-- DRAFT: Holden to edit -->
Lovely: Relationship Growth is an iOS app with AI features built on what people write about their relationships. That's about as private as user data gets. Two things had to be true from day one: the app couldn't be locked into one LLM provider, and one user's data could never reach another user.

## What I built

<figure class="diagram">
<svg role="img" aria-labelledby="d-lovely-title" viewBox="0 0 340 300" xmlns="http://www.w3.org/2000/svg">
<title id="d-lovely-title">The iOS app reads its own data from Firestore, guarded by a default-deny ruleset, and sends AI requests to a FastAPI gateway, which routes to GPT-4o-mini or Claude 3 Sonnet.</title>
<defs><marker id="d-lovely-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="d-arrow" d="M0 0 L10 5 L0 10 z"/></marker></defs>
<rect class="d-box" x="95" y="8" width="150" height="50" rx="10"/>
<text class="d-t" x="170" y="29" text-anchor="middle">iOS app</text>
<text class="d-s" x="170" y="47" text-anchor="middle">React Native · Expo</text>
<path class="d-line" d="M140 58 L92 116" marker-end="url(#d-lovely-arrow)"/>
<path class="d-line" d="M200 58 L248 116" marker-end="url(#d-lovely-arrow)"/>
<rect class="d-box" x="6" y="120" width="158" height="74" rx="10"/>
<text class="d-t" x="85" y="143" text-anchor="middle">Firestore</text>
<text class="d-s" x="85" y="162" text-anchor="middle">305-line ruleset</text>
<text class="d-s" x="85" y="180" text-anchor="middle">default-deny, per user</text>
<rect class="d-hi" x="176" y="120" width="158" height="74" rx="10"/>
<text class="d-t" x="255" y="143" text-anchor="middle">FastAPI AI gateway</text>
<text class="d-s" x="255" y="162" text-anchor="middle">prompt orchestration</text>
<text class="d-s" x="255" y="180" text-anchor="middle">cross-session memory</text>
<path class="d-line" d="M228 194 L214 236" marker-end="url(#d-lovely-arrow)"/>
<path class="d-line" d="M282 194 L296 236" marker-end="url(#d-lovely-arrow)"/>
<rect class="d-box" x="172" y="240" width="78" height="52" rx="10"/>
<text class="d-m" x="211" y="262" text-anchor="middle">GPT-4o</text>
<text class="d-m" x="211" y="280" text-anchor="middle">mini</text>
<rect class="d-box" x="256" y="240" width="78" height="52" rx="10"/>
<text class="d-m" x="295" y="262" text-anchor="middle">Claude 3</text>
<text class="d-m" x="295" y="280" text-anchor="middle">Sonnet</text>
</svg>
<figcaption>The app talks to one gateway. The gateway talks to the providers.</figcaption>
</figure>

<!-- DRAFT: Holden to edit -->
- **A provider-agnostic AI gateway** in FastAPI. It routes across GPT-4o-mini and Claude 3 Sonnet, handles prompt orchestration, and injects memory from earlier sessions.
- **Per-user encryption, rate limiting and signed webhook verification** to protect user data: Fernet field-level encryption with per-user key derivation, Firestore-backed sliding-window rate limiting, and HMAC-verified RevenueCat webhooks with replay protection.
- **A 305-line Firestore ruleset**: default-deny, per-user isolation, append-only messages and payload size caps, tested with 30+ pytest files.
- **Subscription billing and free trials** with RevenueCat.
- **A fix for cold-start crashes** under React Native's New Architecture: lazy Firebase initialization and deferred notification handlers.

## The hard part

<div class="hard-part">

<!-- DRAFT: Holden to edit -->
**Not betting the app on one LLM vendor.** Calling one provider's SDK straight from the app would have been faster to build. But prices, rate limits and model quality all change, and every change would mean shipping a new app build. With a gateway in between, the app sends one kind of request, and changing or splitting providers is a server deploy. The cost is one more service to run and one more hop per request. I took that trade.

<!-- DRAFT: Holden to edit -->
**Treating the database rules as the real access control.** App code can have bugs. The rules can't be skipped. So the ruleset starts from deny-everything and opens only what each user needs: their own documents, messages they can append to but never edit, and payloads under a size cap. Sensitive fields are encrypted with a key derived per user, and RevenueCat's billing webhooks have to prove they came from RevenueCat and aren't replays.

</div>

## Results

<!-- DRAFT: Holden to edit -->
- **Live on the App Store** as a production release.
- **40+ beta users** got stable builds once the cold-start fix landed, and that same fix unblocked the production release.
- **First paying subscribers** after launch, through RevenueCat subscriptions and free trials.
- **305 lines** of default-deny rules, covered by **30+ pytest files**.

## What I'd do differently

<!-- TODO(Holden): these are placeholders. Replace them with your own lessons. -->
<!-- DRAFT: Holden to edit -->
I'd test on React Native's New Architecture from the very first build. The cold-start crashes only showed up there, and catching them earlier would have gotten stable builds to beta users sooner.
