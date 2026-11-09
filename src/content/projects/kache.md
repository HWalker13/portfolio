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

<!-- Liner notes are written in M4. -->
