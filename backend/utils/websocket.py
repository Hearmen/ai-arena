"""WebSocket connection manager for Socket.IO."""

import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages Socket.IO connections."""

    def __init__(self):
        self.active_connections: dict[str, dict] = {}

    def connect(self, sid: str, environ: dict):
        self.active_connections[sid] = {"environ": environ}
        logger.info("Client connected: %s", sid)

    def disconnect(self, sid: str):
        if sid in self.active_connections:
            del self.active_connections[sid]
        logger.info("Client disconnected: %s", sid)

    def is_connected(self, sid: str) -> bool:
        return sid in self.active_connections


manager = ConnectionManager()
