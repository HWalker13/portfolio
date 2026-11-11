"""
The network link between Kache's primary and its replica, as a plain TCP relay.

  primary --(replication)--> relay :6390 --> replica :6380

Stopping the relay is the "network partition": both Kache servers keep running with their data
in memory, only the link between them is gone. The primary sees the connection drop and keeps
buffering writes; starting the relay again restores the link. This file is demo scaffolding;
Kache itself is run unmodified from a clean clone of the repo.

Usage: python3 relay.py LISTEN_PORT TARGET_PORT
"""
import socket
import sys
import threading

listen_port, target_port = int(sys.argv[1]), int(sys.argv[2])


def pipe(src, dst):
    try:
        while data := src.recv(4096):
            dst.sendall(data)
    except OSError:
        pass
    finally:
        for s in (src, dst):
            try:
                s.close()
            except OSError:
                pass


server = socket.socket()
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("127.0.0.1", listen_port))
server.listen()
while True:
    a, _ = server.accept()
    b = socket.create_connection(("127.0.0.1", target_port))
    threading.Thread(target=pipe, args=(a, b), daemon=True).start()
    threading.Thread(target=pipe, args=(b, a), daemon=True).start()
