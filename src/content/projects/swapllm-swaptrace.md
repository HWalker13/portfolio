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

## The problem

<!-- DRAFT: Holden to edit -->
Every LLM provider fails sometimes: rate limits, timeouts, server errors. I wanted one call that falls back across providers, so the calling code doesn't care which one answered. Then I found a gap in my own tool, and fixing it became the second package.

## What I built

<figure class="diagram">
<svg role="img" aria-labelledby="d-swap-title" viewBox="0 0 340 330" xmlns="http://www.w3.org/2000/svg">
<title id="d-swap-title">Example run: Router.complete() tries Groq, which is rate limited, then OpenAI, which times out, then Anthropic, which succeeds. swapLLM returns only the final response. swaptrace also keeps a record of all three attempts.</title>
<defs><marker id="d-swap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="d-arrow" d="M0 0 L10 5 L0 10 z"/></marker></defs>
<rect class="d-box" x="50" y="6" width="240" height="40" rx="10"/>
<text class="d-m" x="170" y="31" text-anchor="middle">Router.complete(...)</text>
<path class="d-line" d="M170 46 L170 62" marker-end="url(#d-swap-arrow)"/>
<rect class="d-box" x="6" y="64" width="160" height="40" rx="10"/>
<text class="d-t" x="86" y="89" text-anchor="middle">1 · Groq</text>
<text class="d-bad" x="180" y="89">rate limited, fall back</text>
<path class="d-line" d="M86 104 L86 120" marker-end="url(#d-swap-arrow)"/>
<rect class="d-box" x="6" y="122" width="160" height="40" rx="10"/>
<text class="d-t" x="86" y="147" text-anchor="middle">2 · OpenAI</text>
<text class="d-bad" x="180" y="147">timed out, fall back</text>
<path class="d-line" d="M86 162 L86 178" marker-end="url(#d-swap-arrow)"/>
<rect class="d-box" x="6" y="180" width="160" height="40" rx="10"/>
<text class="d-t" x="86" y="205" text-anchor="middle">3 · Anthropic</text>
<text class="d-t" x="180" y="205">success</text>
<path class="d-line" d="M86 220 L86 244" marker-end="url(#d-swap-arrow)"/>
<path class="d-line" d="M86 232 L254 232 L254 244" marker-end="url(#d-swap-arrow)"/>
<rect class="d-box" x="6" y="246" width="160" height="76" rx="10"/>
<text class="d-t" x="86" y="270" text-anchor="middle">swapLLM</text>
<text class="d-s" x="86" y="290" text-anchor="middle">returns the response;</text>
<text class="d-s" x="86" y="307" text-anchor="middle">attempts 1–2 are gone</text>
<rect class="d-hi" x="174" y="246" width="160" height="76" rx="10"/>
<text class="d-t" x="254" y="270" text-anchor="middle">swaptrace</text>
<text class="d-s" x="254" y="290" text-anchor="middle">same response, plus a</text>
<text class="d-s" x="254" y="307" text-anchor="middle">record of all 3 attempts</text>
</svg>
<figcaption>An example run. The provider order is illustrative.</figcaption>
</figure>

<!-- DRAFT: Holden to edit -->
**swapLLM** puts Groq, OpenAI and Anthropic behind one `Router.complete()` call and falls back automatically on rate limits, timeouts and server errors. A typed exception hierarchy separates retryable failures from fatal ones, and responses can optionally be validated with Pydantic. It has an 89-test pytest suite that is fully mocked, so it makes zero live API calls, and I did a TestPyPI dry run before the real release.

<!-- DRAFT: Holden to edit -->
**swaptrace** reimplements swapLLM's retry loop with verified behavioral parity and adds attempt-level tracing. It has 73 tests, zero runtime dependencies, and a CLI for comparing traces across providers.

## The hard part

<div class="hard-part">

<!-- DRAFT: Holden to edit -->
**Finding the gap in my own tool.** When a call succeeded after a fallback, swapLLM threw away everything about the attempts that failed. From the outside, a call that hit Groq's rate limit twice looked the same as one that went straight through. You can't judge a provider's reliability from data you've discarded.

<!-- DRAFT: Holden to edit -->
**Changing the loop without changing the behavior.** Tracing meant reimplementing the retry loop, and a fallback loop is easy to get subtly wrong: retrying an error that should be fatal, or giving up on one that should be retried. So I verified that swaptrace behaves the same as swapLLM before trusting its traces.

<!-- DRAFT: Holden to edit -->
**Proving the tracing is cheap.** Overhead numbers this small are easy to fake by accident. Garbage-collection pauses land at random and swamp the measurement. I disabled the GC during timing and ran 5 trials of 1,000 iterations each.

</div>

## Results

<!-- DRAFT: Holden to edit -->
- **2 packages on PyPI**: swapllm and swaptrace.
- **7.75µs of overhead per call** for tracing, under 0.01% of real LLM latency.
- **89 tests** for swapLLM, fully mocked, with zero live API calls.
- **73 tests** for swaptrace, with zero runtime dependencies.

## What I'd do differently

<!-- TODO(Holden): these are placeholders. Replace them with your own lessons. -->
<!-- DRAFT: Holden to edit -->
I'd build tracing into swapLLM from the start. The attempt data already existed inside the loop. It just wasn't kept, and that cost me a second package to get it back.
