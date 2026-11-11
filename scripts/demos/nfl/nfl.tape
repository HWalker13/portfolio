# NFL Game Predictor demo: replaying the official 2026 shadow-mode record.
# Runs in a fresh clone of the repo, in scratch mode only: no --live, no data pull, nothing new
# predicted. The hidden setup copies the official graded weeks (data/live/2026/graded) into the
# clone's scratch folder, so the scorecard regenerates from exactly the official files.
# The visible commands are the README's own; tail and grep only pick lines out of the output.
# Rendered by scripts/make-demos.mjs (run from the portfolio root).

Output scripts/demos/out/nfl-raw.mp4
Require git

Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 19
Set LineHeight 1.08
Set Width 1280
Set Height 720
Set Padding 30
Set Framerate 30
Set TypingSpeed 9ms
Set CursorBlink false
Set Theme { "name": "Holden", "background": "#1E140D", "foreground": "#F3E6CC", "cursor": "#E0A526", "selection": "#6E4527", "black": "#3B2314", "red": "#E57A43", "green": "#B5C99A", "yellow": "#E0A526", "blue": "#A9C4CC", "magenta": "#E8508A", "cyan": "#A9C4CC", "white": "#F3E6CC", "brightBlack": "#8A6A4E", "brightRed": "#F29A5E", "brightGreen": "#C9D9AE", "brightYellow": "#F2C230", "brightBlue": "#C4D8DE", "brightMagenta": "#F07AA6", "brightCyan": "#C4D8DE", "brightWhite": "#FBF4E4" }

Hide
Type `cd "$(mktemp -d)" && git clone -q "$HOME/Personal Projects/NFL-GAME-PREDICTOR" nfl && cd nfl && mkdir -p data/live_scratch/2026 && cp -R data/live/2026/graded data/live_scratch/2026/` Enter
Type `python() { "$HOME/Personal Projects/NFL-GAME-PREDICTOR/venv/bin/python" "$@"; }; S=data/live_scratch/2026` Enter
Type `export PS1='\[\e[33m\]nfl \$\[\e[0m\] '; clear` Enter
Sleep 1s
Show

Type "python -m scripts.live.readable_week --season 2026 --week 7 | tail -1"
Enter
Wait+Line /^nfl \$\s*$/
Sleep 250ms
Type `grep -E "^\| (NE|PIT|CIN) @" $S/week_07_picks.md | cut -d"|" -f2,4,5,7,11,12`
Enter
Sleep 900ms
Type "python -m scripts.live.scorecard --season 2026 | tail -1"
Enter
Wait+Line /^nfl \$\s*$/
Sleep 250ms
Type `grep -E "/74 =" $S/SCORECARD_2026.md | grep -vE "Challenger|implied" | cut -d"|" -f2,4`
Enter
Sleep 1s
Type `grep -E "mean CLV|No evidence" $S/SCORECARD_2026.md`
Enter
Sleep 600ms
