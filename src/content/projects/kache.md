---
title: Kache
track: 4
side: B
# DRAFT: Holden to edit
tagline: 'A Redis-like cache on raw TCP sockets and the standard library, built to survive crashes and network partitions.'
date: '2026'
stack:
  - Python (standard library only)
  - Raw TCP sockets
  - Docker Compose
  - AWS EC2
headlineStats:
  - value: '17,000+'
    context: 'ops/sec at sub-2ms p50 latency with 20 concurrent clients'
  - value: '0'
    context: 'writes lost across 50 buffered commands after a simulated partition'
proof:
  - kind: github
    label: GitHub
    url: https://github.com/HWalker13/kache
---

## The problem

<!-- DRAFT: Holden to edit -->
A cache is easy to build when nothing goes wrong. I wanted to learn what a cache like Redis has to get right when things fail: a process crash, or a network link that drops between a primary and its replica. So I built one from raw TCP sockets, with no dependencies, and then broke it on purpose.

## What I built

<figure class="diagram">
<svg role="img" aria-labelledby="d-kache-title" viewBox="0 0 340 312" xmlns="http://www.w3.org/2000/svg">
<title id="d-kache-title">Clients send commands to the primary, which logs to an append-only file with absolute-time TTLs. Writes for the replica go into an in-memory queue, which buffers during a network partition and replays in order to the replica on reconnect.</title>
<defs><marker id="d-kache-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="d-arrow" d="M0 0 L10 5 L0 10 z"/></marker></defs>
<rect class="d-box" x="6" y="6" width="200" height="40" rx="10"/>
<text class="d-t" x="106" y="31" text-anchor="middle">Clients (raw TCP)</text>
<path class="d-line" d="M106 46 L106 66" marker-end="url(#d-kache-arrow)"/>
<rect class="d-hi" x="6" y="68" width="200" height="60" rx="10"/>
<text class="d-t" x="106" y="92" text-anchor="middle">Primary</text>
<text class="d-s" x="106" y="112" text-anchor="middle">TTL: lazy on read + sweep</text>
<path class="d-line" d="M206 98 L226 98" marker-end="url(#d-kache-arrow)"/>
<rect class="d-box" x="228" y="68" width="106" height="60" rx="10"/>
<text class="d-t" x="281" y="92" text-anchor="middle">AOF</text>
<text class="d-s" x="281" y="112" text-anchor="middle">absolute TTLs</text>
<path class="d-line" d="M106 128 L106 148" marker-end="url(#d-kache-arrow)"/>
<rect class="d-box" x="6" y="150" width="200" height="60" rx="10"/>
<text class="d-t" x="106" y="174" text-anchor="middle">Write queue</text>
<text class="d-s" x="106" y="194" text-anchor="middle">buffers while replica is away</text>
<path class="d-break" d="M6 236 L334 236"/>
<text class="d-bad" x="334" y="228" text-anchor="end">network partition</text>
<path class="d-line" d="M106 210 L106 256" marker-end="url(#d-kache-arrow)"/>
<rect class="d-box" x="6" y="258" width="200" height="48" rx="10"/>
<text class="d-t" x="106" y="279" text-anchor="middle">Replica</text>
<text class="d-s" x="106" y="297" text-anchor="middle">replayed in order on reconnect</text>
</svg>
<figcaption>Writes survive a crash through the AOF and a partition through the queue.</figcaption>
</figure>

<!-- DRAFT: Holden to edit -->
- **A multi-threaded TCP server** with 6 protocol commands, written with only Python's standard library.
- **Dual-path TTL eviction**: keys expire lazily when read, and a background thread sweeps the rest.
- **AOF persistence with absolute-timestamp TTLs**, so data comes back correctly after a crash.
- **Primary/replica replication** with an in-memory write queue. It buffers commands during a disconnect and replays them in order on reconnect, for at-least-once delivery.

## The hard part

<div class="hard-part">

<!-- DRAFT: Holden to edit -->
**Making a crash restore the right state, not just some state.** If the log says "expire in 60 seconds" and the server restarts ten minutes later, replaying that line brings the key back to life for another minute. Logging the absolute expiry time instead means a replayed key expires when it was always supposed to.

<!-- DRAFT: Holden to edit -->
**Expiring keys with two paths, because one isn't enough.** Lazy expiration alone leaves keys nobody reads sitting in memory forever. A sweep alone lets a read see an expired key between sweeps. Doing both closes each gap.

<!-- DRAFT: Holden to edit -->
**Choosing at-least-once over losing writes.** When the replica drops off, the primary keeps accepting writes and queues them. On reconnect it replays the queue in order. The trade-off is that a command can arrive twice, but nothing is silently lost.
<!-- TODO(Holden): say how duplicate replays are handled, e.g. whether the commands are idempotent. -->

</div>

## Results

<!-- DRAFT: Holden to edit -->
- **17,000+ ops/sec** at **sub-2ms p50 latency**, with 20 concurrent clients.
- After a simulated network partition, the replica **fully re-synced in under 2 seconds**.
- **Zero writes lost** across 50 commands buffered during the partition.

<!--
TODO(Holden): HIDDEN until you write your own lessons. This whole section is one HTML comment, and
comments are stripped from the build, so none of it ships. To publish: delete this comment's first
four lines and its closing line, then replace the placeholder below with your own words.

## What I'd do differently

DRAFT: Holden to edit
I'd report tail latency (p99), not only p50. A cache's worst moments are the ones people remember, and the median hides them.
-->
