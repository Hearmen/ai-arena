"""WebSocket connection manager for Socket.IO."""


class ConnectionManager:
    """Manages Socket.IO connections."""

    def __init__(self):
        self.active_connections: dict[str, dict] = {}

    def connect(self, sid: str, environ: dict):
        self.active_connections[sid] = {"environ": environ}
        print(f"Client connected: {sid}")

    def disconnect(self, sid: str):
        if sid in self.active_connections:
            del self.active_connections[sid]
        print(f"Client disconnected: {sid}")

    def is_connected(self, sid: str) -> bool:
        return sid in self.active_connections


manager = ConnectionManager()
