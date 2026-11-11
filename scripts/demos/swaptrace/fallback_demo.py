"""
One swapLLM call through a three-provider cascade, traced by swaptrace.

The providers are real swapLLM adapters (GroqProvider, OpenAIProvider, AnthropicProvider);
only their HTTP is mocked, with httpx.MockTransport, exactly as swapLLM's own test suite does.
No API keys, no network. Groq answers 429 (rate limited), OpenAI answers 503 (server error),
Anthropic answers. Everything printed below is read back from the real swaptrace Trace.

Each attempt counts the HTTP requests its provider's SDK actually sent, to show what the SDK
does underneath swapLLM.
"""
import collections

import httpx
from swapllm import AnthropicProvider, GroqProvider, OpenAIProvider, Router
from swaptrace import storage
from swaptrace.integrations.swapllm import traced

requests_sent = collections.Counter()


def mock(provider, status, body):
    def handler(request: httpx.Request) -> httpx.Response:
        requests_sent[provider] += 1
        return httpx.Response(status, json=body)

    return httpx.Client(transport=httpx.MockTransport(handler))


error = {"error": {"message": "mocked", "type": "server_error"}}
anthropic_ok = {
    "id": "msg_demo", "type": "message", "role": "assistant", "model": "claude-haiku-4-5",
    "content": [{"type": "text", "text": "(mocked reply from anthropic)"}],
    "stop_reason": "end_turn", "stop_sequence": None, "usage": {"input_tokens": 9, "output_tokens": 6},
}

router = Router(
    providers=[
        GroqProvider(api_key="none", model="llama-3.1-8b-instant", http_client=mock("groq", 429, error)),
        OpenAIProvider(api_key="none", model="gpt-4o-mini", http_client=mock("openai", 503, error)),
        AnthropicProvider(api_key="none", model="claude-haiku-4-5", http_client=mock("anthropic", 200, anthropic_ok)),
    ],
    fallback_order=["groq", "openai", "anthropic"],
)
router = traced(router, on_trace=lambda t: storage.append_trace(t, ".swaptrace/traces.jsonl"))

answer = router.complete(messages=[{"role": "user", "content": "hello"}])
trace = router.last_trace
print(f"answer   {answer!r}")
print(f"winner   {trace.winning_provider} after {trace.retry_count} fallbacks\n")
for a in trace.attempts:
    print(f"  #{a.attempt_index}  {a.provider:<10} {a.outcome:<16} {a.error_type or '':<24} "
          f"{a.latency_ms:7.1f} ms   {requests_sent[a.provider]} HTTP request(s)")
