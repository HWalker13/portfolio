---
title: swapLLM + swaptrace
subtitle: Two PyPI packages, one story
track: 3
side: B
# DRAFT: Holden to edit
tagline: 'An LLM router that falls back across Groq, OpenAI and Anthropic, then the tracer I built after finding the router threw away its own retry data.'
date: '2026'
stack:
  - Python
  - Pydantic
  - pytest
  - dataclasses
  - JSONL
  - GitHub Actions
headlineStats:
  - value: '2'
    context: 'packages published to PyPI'
  - value: '7.75µs'
    context: 'tracing overhead (<0.01% of LLM latency)'
proof:
  - kind: pypi
    label: PyPI swapllm
    url: https://pypi.org/project/swapllm
  - kind: github
    label: GitHub swapllm
    url: https://github.com/HWalker13/swapllm
  - kind: pypi
    label: PyPI swaptrace
    url: https://pypi.org/project/swaptrace
  - kind: github
    label: GitHub swaptrace
    url: https://github.com/HWalker13/swaptrace
---

<!-- Liner notes are written in M4. -->
