---
title: swapLLM + swaptrace
subtitle: Two PyPI packages, one story
track: 3
side: B
# DRAFT: Holden to edit
tagline: 'An LLM router that falls back across Groq, OpenAI and Anthropic, then the tracer I built after finding the router threw away its own retry data.'
# TODO(Holden): project dates
stack:
  - Python
  - Pydantic
  - pytest
  - dataclasses
  - JSONL
  - GitHub Actions
headlineStats:
  - value: '7.75µs'
    context: 'tracing overhead per call, under 0.01% of real LLM latency'
  - value: '89 + 73'
    context: 'tests: a fully mocked swapLLM suite, plus swaptrace'
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
