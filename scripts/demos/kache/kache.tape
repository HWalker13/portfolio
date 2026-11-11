# Kache demo: replication surviving a network partition.
# Real Kache, unmodified, from a fresh clone of the repo; real commands; real output.
# Hidden setup starts a replica (:6380), the link relay (:6390 -> :6380, see relay.py) and a
# primary (:6379) that replicates through the link. `cut_link` stops the relay; `restore_link`
# starts it again. Both Kache servers keep running the whole time.
# Rendered by scripts/make-demos.mjs (run from the portfolio root).

Output scripts/demos/out/kache-raw.mp4
Require git
Require python3

Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 19
Set LineHeight 1.08
Set Width 1280
Set Height 720
Set Padding 30
Set Framerate 30
Set TypingSpeed 16ms
Set CursorBlink false
Set Theme { "name": "Holden", "background": "#1E140D", "foreground": "#F3E6CC", "cursor": "#E0A526", "selection": "#6E4527", "black": "#3B2314", "red": "#E57A43", "green": "#B5C99A", "yellow": "#E0A526", "blue": "#A9C4CC", "magenta": "#E8508A", "cyan": "#A9C4CC", "white": "#F3E6CC", "brightBlack": "#8A6A4E", "brightRed": "#F29A5E", "brightGreen": "#C9D9AE", "brightYellow": "#F2C230", "brightBlue": "#C4D8DE", "brightMagenta": "#F07AA6", "brightCyan": "#C4D8DE", "brightWhite": "#FBF4E4" }

Hide
Type `export H="$PWD/scripts/demos/kache" PATH="$PWD/scripts/demos/kache:$PATH"; cd "$(mktemp -d)" && git clone -q "$HOME/Personal Projects/kache" kache && cd kache && rm -f aof.log` Enter
Type `python3 -u server/server.py --mode replica --port 6380 >/dev/null 2>&1 & (python3 -u "$H/relay.py" 6390 6380 & echo $! > .link); sleep 0.5; python3 -u server/server.py --mode primary --replica-port 6390 >/dev/null 2>&1 & sleep 0.8` Enter
Type `cut_link() { kill "$(cat .link)"; }; restore_link() { (python3 -u "$H/relay.py" 6390 6380 & echo $! > .link); }` Enter
Type `export PS1='\[\e[33m\]kache \$\[\e[0m\] '; set +m; clear` Enter
Sleep 1.2s
Show

Type "kc 6379 SET order:101 paid; kc 6379 SET order:102 paid"
Enter
Sleep 300ms
Type "kc 6380 KEYS          # replica has both"
Enter
Sleep 600ms
Type "cut_link              # partition: servers stay up"
Enter
Sleep 300ms
Type "for o in 103 104 105; do kc 6379 SET order:$o paid; done"
Enter
Sleep 300ms
Type "kc 6380 KEYS          # replica is behind"
Enter
Sleep 700ms
Type "restore_link; sleep 2; kc 6380 KEYS"
Enter
Sleep 2.6s

Hide
Type `kill "$(cat .link)" %1 %2 2>/dev/null` Enter
