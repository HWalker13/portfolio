# swapLLM + swaptrace demo: one call through a three-provider fallback cascade, traced.
# swapllm 0.1.1 and swaptrace are installed from PyPI into a fresh virtualenv (hidden setup), so
# this records the released packages. The providers are real swapLLM adapters with mocked HTTP
# (httpx.MockTransport, as swapLLM's own tests do): no API keys, no network. See fallback_demo.py.
# Rendered by scripts/make-demos.mjs (run from the portfolio root).

Output scripts/demos/out/swaptrace-raw.mp4
Require python3

Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 19
Set LineHeight 1.08
Set Width 1280
Set Height 720
Set Padding 18
Set Framerate 30
Set TypingSpeed 14ms
Set CursorBlink false
Set Theme { "name": "Holden", "background": "#1E140D", "foreground": "#F3E6CC", "cursor": "#E0A526", "selection": "#6E4527", "black": "#3B2314", "red": "#E57A43", "green": "#B5C99A", "yellow": "#E0A526", "blue": "#A9C4CC", "magenta": "#E8508A", "cyan": "#A9C4CC", "white": "#F3E6CC", "brightBlack": "#8A6A4E", "brightRed": "#F29A5E", "brightGreen": "#C9D9AE", "brightYellow": "#F2C230", "brightBlue": "#C4D8DE", "brightMagenta": "#F07AA6", "brightCyan": "#C4D8DE", "brightWhite": "#FBF4E4" }

Hide
Type `D="$PWD/scripts/demos/swaptrace"; cd "$(mktemp -d)" && python3 -m venv .venv && .venv/bin/pip install -q --no-cache-dir "swapllm==0.1.1" "swaptrace[swapllm]" && cp "$D/fallback_demo.py" . && source .venv/bin/activate` Enter
Wait+Line@120s />\s*$/
Type `export PS1='\[\e[33m\]demo \$\[\e[0m\] '; clear` Enter
Sleep 800ms
Show

Type "pip show swapllm | grep Version"
Enter
Wait+Line /^demo \$\s*$/
Sleep 700ms
Type "python fallback_demo.py      # groq 429, openai 503, anthropic 200"
Enter
Wait+Line /^demo \$\s*$/
Sleep 1.8s
Type "swaptrace query"
Enter
Wait+Line /^demo \$\s*$/
Sleep 1.2s
