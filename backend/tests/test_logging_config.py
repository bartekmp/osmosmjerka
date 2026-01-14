"""Tests for the logging_config module."""

import json
import logging
from unittest.mock import patch

from osmosmjerka.logging_config import (
    JSONFormatter,
    LevelBasedStreamHandler,
    PlainTextFormatter,
    configure_logging,
    get_logger,
)


class TestPlainTextFormatter:
    """Test cases for PlainTextFormatter class."""

    def test_formats_basic_message(self):
        """Formats a basic log message correctly."""
        formatter = PlainTextFormatter(use_colors=False)
        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        result = formatter.format(record)

        assert "[INFO]" in result
        assert "[test.module]" in result
        assert "Test message" in result
        # Should have ISO8601 timestamp
        assert "T" in result and "Z" in result

    def test_formats_extra_fields(self):
        """Extra fields are appended as key=value pairs."""
        formatter = PlainTextFormatter(use_colors=False)
        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="User login",
            args=(),
            exc_info=None,
        )
        record.user_id = 42
        record.username = "john_doe"

        result = formatter.format(record)

        assert "| " in result
        assert "user_id=42" in result
        assert "username=john_doe" in result

    def test_formats_exception_info(self):
        """Exception info is appended to the log."""
        formatter = PlainTextFormatter(use_colors=False)

        try:
            raise ValueError("Test error")
        except ValueError:
            import sys

            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test.module",
            level=logging.ERROR,
            pathname="test.py",
            lineno=10,
            msg="An error occurred",
            args=(),
            exc_info=exc_info,
        )

        result = formatter.format(record)

        assert "ValueError" in result
        assert "Test error" in result

    @patch("sys.stderr")
    def test_colors_disabled_for_non_tty(self, mock_stderr):
        """Colors are disabled when stderr is not a TTY."""
        mock_stderr.isatty.return_value = False
        formatter = PlainTextFormatter(use_colors=True)

        # Colors should be disabled
        assert formatter.use_colors is False


class TestJSONFormatter:
    """Test cases for JSONFormatter class."""

    def test_formats_valid_json(self):
        """Output is valid JSON."""
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        result = formatter.format(record)
        parsed = json.loads(result)

        assert parsed is not None
        assert isinstance(parsed, dict)

    def test_contains_required_fields(self):
        """JSON output contains all required fields."""
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test.module",
            level=logging.WARNING,
            pathname="test.py",
            lineno=42,
            msg="Warning message",
            args=(),
            exc_info=None,
        )

        result = formatter.format(record)
        parsed = json.loads(result)

        assert "timestamp" in parsed
        assert parsed["level"] == "WARNING"
        assert parsed["component"] == "test.module"
        assert parsed["message"] == "Warning message"
        assert parsed["line"] == 42

    def test_includes_extra_fields(self):
        """Extra fields are included in JSON output."""
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.user_id = 123
        record.action = "login"

        result = formatter.format(record)
        parsed = json.loads(result)

        assert parsed["user_id"] == 123
        assert parsed["action"] == "login"

    def test_includes_exception_info(self):
        """Exception info is included in JSON output."""
        formatter = JSONFormatter()

        try:
            raise RuntimeError("Something went wrong")
        except RuntimeError:
            import sys

            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test.module",
            level=logging.ERROR,
            pathname="test.py",
            lineno=10,
            msg="Error",
            args=(),
            exc_info=exc_info,
        )

        result = formatter.format(record)
        parsed = json.loads(result)

        assert "exception" in parsed
        assert parsed["exception"]["type"] == "RuntimeError"
        assert "Something went wrong" in parsed["exception"]["message"]
        assert isinstance(parsed["exception"]["traceback"], list)


class TestLevelBasedStreamHandler:
    """Test cases for LevelBasedStreamHandler class."""

    def test_info_goes_to_stdout(self):
        """INFO level logs go to stdout."""
        formatter = PlainTextFormatter(use_colors=False)
        handler = LevelBasedStreamHandler(formatter)

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Info message",
            args=(),
            exc_info=None,
        )

        # Check the filter logic
        assert handler.stdout_handler.filters[0](record) is True
        assert handler.stderr_handler.filters[0](record) is False

    def test_error_goes_to_stderr(self):
        """ERROR level logs go to stderr."""
        formatter = PlainTextFormatter(use_colors=False)
        handler = LevelBasedStreamHandler(formatter)

        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=10,
            msg="Error message",
            args=(),
            exc_info=None,
        )

        # Check the filter logic
        assert handler.stdout_handler.filters[0](record) is False
        assert handler.stderr_handler.filters[0](record) is True

    def test_warning_goes_to_stderr(self):
        """WARNING level logs go to stderr."""
        formatter = PlainTextFormatter(use_colors=False)
        handler = LevelBasedStreamHandler(formatter)

        record = logging.LogRecord(
            name="test",
            level=logging.WARNING,
            pathname="test.py",
            lineno=10,
            msg="Warning message",
            args=(),
            exc_info=None,
        )

        # WARNING goes to stderr
        assert handler.stdout_handler.filters[0](record) is False
        assert handler.stderr_handler.filters[0](record) is True


class TestConfigureLogging:
    """Test cases for configure_logging function."""

    def test_configure_development_mode(self):
        """Development mode uses PlainTextFormatter."""
        # Clear existing handlers
        root_logger = logging.getLogger()
        root_logger.handlers.clear()

        configure_logging(level="DEBUG", development_mode=True)

        assert len(root_logger.handlers) == 1
        handler = root_logger.handlers[0]
        assert isinstance(handler, LevelBasedStreamHandler)

    def test_configure_production_mode(self):
        """Production mode uses JSONFormatter."""
        # Clear existing handlers
        root_logger = logging.getLogger()
        root_logger.handlers.clear()

        configure_logging(level="INFO", development_mode=False)

        assert len(root_logger.handlers) == 1

    def test_sets_log_level(self):
        """Log level is set correctly."""
        root_logger = logging.getLogger()
        root_logger.handlers.clear()

        configure_logging(level="WARNING", development_mode=True)

        assert root_logger.level == logging.WARNING


class TestGetLogger:
    """Test cases for get_logger function."""

    def test_returns_logger_instance(self):
        """get_logger returns a Logger instance."""
        logger = get_logger("test.module")

        assert isinstance(logger, logging.Logger)
        assert logger.name == "test.module"

    def test_same_name_returns_same_logger(self):
        """Calling with same name returns the same logger instance."""
        logger1 = get_logger("test.same")
        logger2 = get_logger("test.same")

        assert logger1 is logger2
