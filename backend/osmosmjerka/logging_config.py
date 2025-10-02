"""
Logging configuration for osmosmjerka backend.

Provides hybrid logging:
- Development mode: Human-readable plain text format to stdout/stderr
- Production mode: Structured JSON format to stdout/stderr (Kubernetes-ready)

No file logging - all logs go to streams for container environments.
"""

import json
import logging
import os
import sys
import traceback
from datetime import datetime, timezone
from typing import Any, Dict


class PlainTextFormatter(logging.Formatter):
    """
    Human-readable plain text formatter for development.

    Format: [timestamp] [LEVEL] [component] message | key=value key=value
    Example: [2025-10-02T14:32:15.234Z] [INFO] [osmosmjerka.auth] User login successful | user=john_doe user_id=42
    """

    # ANSI color codes for different log levels
    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def __init__(self, use_colors: bool = True):
        super().__init__()
        self.use_colors = use_colors and sys.stderr.isatty()

    def format(self, record: logging.LogRecord) -> str:
        # Timestamp in ISO8601 UTC format
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds")
        timestamp = timestamp.replace("+00:00", "Z")

        # Component name (module name)
        component = record.name

        # Log level with optional color
        level = record.levelname
        if self.use_colors:
            color = self.COLORS.get(level, "")
            level = f"{color}{level}{self.RESET}"

        # Base message
        message = record.getMessage()

        # Build the log line
        log_parts = [f"[{timestamp}]", f"[{level}]", f"[{component}]", message]

        # Add extra fields if present
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
                "taskName",
                "exc_info",
                "exc_text",
                "stack_info",
            ]:
                extra_fields[key] = value

        if extra_fields:
            extra_str = " ".join([f"{k}={v}" for k, v in extra_fields.items()])
            log_parts.append(f"| {extra_str}")

        log_line = " ".join(log_parts)

        # Add exception info if present
        if record.exc_info:
            log_line += "\n" + self.formatException(record.exc_info)

        return log_line


class JSONFormatter(logging.Formatter):
    """
    Structured JSON formatter for production/Kubernetes.

    Each log entry is a single-line JSON object with structured fields.
    Example: {"timestamp":"2025-10-02T14:32:15.234Z","level":"INFO","component":"osmosmjerka.auth","message":"User login successful","user":"john_doe","user_id":42}
    """

    def format(self, record: logging.LogRecord) -> str:
        # Timestamp in ISO8601 UTC format
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds")
        timestamp = timestamp.replace("+00:00", "Z")

        # Build the base log entry
        log_entry: Dict[str, Any] = {
            "timestamp": timestamp,
            "level": record.levelname,
            "component": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
                "taskName",
                "exc_info",
                "exc_text",
                "stack_info",
            ]:
                log_entry[key] = value

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_entry, default=str)


class LevelBasedStreamHandler(logging.Handler):
    """
    Handler that sends INFO/DEBUG to stdout and WARNING/ERROR/CRITICAL to stderr.
    This is best practice for containerized applications.
    """

    def __init__(self, formatter: logging.Formatter):
        super().__init__()
        self.setFormatter(formatter)

        # Create separate handlers for stdout and stderr
        self.stdout_handler = logging.StreamHandler(sys.stdout)
        self.stdout_handler.setFormatter(formatter)
        self.stdout_handler.addFilter(lambda record: record.levelno < logging.WARNING)

        self.stderr_handler = logging.StreamHandler(sys.stderr)
        self.stderr_handler.setFormatter(formatter)
        self.stderr_handler.addFilter(lambda record: record.levelno >= logging.WARNING)

    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno < logging.WARNING:
            self.stdout_handler.emit(record)
        else:
            self.stderr_handler.emit(record)


def configure_logging(
    level: str = "INFO",
    development_mode: bool = False,
    use_colors: bool = True,
) -> None:
    """
    Configure logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        development_mode: If True, use plain text format; if False, use JSON format
        use_colors: If True and in development mode, use colored output (only if terminal supports it)
    """
    # Determine log level
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Choose formatter based on mode
    if development_mode:
        formatter = PlainTextFormatter(use_colors=use_colors)
    else:
        formatter = JSONFormatter()

    # Create level-based stream handler
    handler = LevelBasedStreamHandler(formatter)
    handler.setLevel(log_level)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove any existing handlers
    root_logger.handlers.clear()

    # Add our handler
    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("databases").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # Uvicorn access logs can be noisy

    # Log the configuration
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured",
        extra={
            "mode": "development" if development_mode else "production",
            "format": "plain_text" if development_mode else "json",
            "level": level.upper(),
        },
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a module.

    Args:
        name: The name of the logger (typically __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


# Auto-configure on import based on environment variables
def _auto_configure() -> None:
    """Auto-configure logging based on environment variables."""
    # Check if already configured
    if logging.getLogger().handlers:
        return

    # Get configuration from environment
    log_level = os.getenv("LOG_LEVEL", "INFO")
    development_mode = os.getenv("DEVELOPMENT_MODE", "false").lower() == "true"
    use_colors = os.getenv("LOG_COLORS", "true").lower() == "true"

    configure_logging(
        level=log_level,
        development_mode=development_mode,
        use_colors=use_colors,
    )


# Auto-configure on module import
_auto_configure()
