"""Tests for the cache module."""

import time
from unittest.mock import MagicMock, patch

import pytest
from osmosmjerka.cache import (
    AsyncLRUCache,
    RateLimiter,
    _get_client_ip,
    cache_response,
    rate_limit,
)


class TestAsyncLRUCache:
    """Test cases for AsyncLRUCache class."""

    def test_get_returns_none_for_missing_key(self):
        """Get returns None when key doesn't exist."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        assert cache.get("nonexistent") is None

    def test_set_and_get_basic(self):
        """Basic set and get operation works."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_ttl_expiration(self):
        """Cache entries expire after TTL."""
        cache = AsyncLRUCache(maxsize=10, ttl=1)  # 1 second TTL
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

        # Wait for TTL to expire
        time.sleep(1.1)
        assert cache.get("key1") is None

    def test_maxsize_eviction(self):
        """Oldest entry is evicted when cache is full."""
        cache = AsyncLRUCache(maxsize=3, ttl=300)
        cache.set("key1", "value1")
        time.sleep(0.01)  # Ensure different timestamps
        cache.set("key2", "value2")
        time.sleep(0.01)
        cache.set("key3", "value3")

        # Cache is now full, adding a new entry should evict key1 (oldest)
        cache.set("key4", "value4")

        assert cache.get("key1") is None  # Evicted
        assert cache.get("key2") == "value2"
        assert cache.get("key3") == "value3"
        assert cache.get("key4") == "value4"

    def test_invalidate_all(self):
        """Invalidating without pattern clears all entries."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        cache.invalidate()

        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_invalidate_with_pattern(self):
        """Invalidating with pattern only removes matching keys."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        cache.set("user_1_data", "data1")
        cache.set("user_2_data", "data2")
        cache.set("category_1", "cat1")

        cache.invalidate("user_")

        assert cache.get("user_1_data") is None
        assert cache.get("user_2_data") is None
        assert cache.get("category_1") == "cat1"

    def test_set_overwrites_existing(self):
        """Setting a key that exists overwrites the value."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        cache.set("key1", "old_value")
        cache.set("key1", "new_value")

        assert cache.get("key1") == "new_value"


class TestRateLimiter:
    """Test cases for RateLimiter class."""

    def test_allows_within_limit(self):
        """Requests within limit are allowed."""
        limiter = RateLimiter()
        assert limiter.is_allowed("user1", max_requests=3, window_seconds=60) is True
        assert limiter.is_allowed("user1", max_requests=3, window_seconds=60) is True
        assert limiter.is_allowed("user1", max_requests=3, window_seconds=60) is True

    def test_blocks_over_limit(self):
        """Requests over limit are blocked."""
        limiter = RateLimiter()
        for _ in range(3):
            limiter.is_allowed("user1", max_requests=3, window_seconds=60)

        # Fourth request should be blocked
        assert limiter.is_allowed("user1", max_requests=3, window_seconds=60) is False

    def test_separate_identifiers(self):
        """Different identifiers have separate limits."""
        limiter = RateLimiter()

        # Fill up user1's limit
        for _ in range(3):
            limiter.is_allowed("user1", max_requests=3, window_seconds=60)

        # user2 should still be allowed
        assert limiter.is_allowed("user2", max_requests=3, window_seconds=60) is True

    def test_window_reset(self):
        """Requests are allowed again after window expires."""
        limiter = RateLimiter()

        # Fill up the limit
        for _ in range(3):
            limiter.is_allowed("user1", max_requests=3, window_seconds=1)

        assert limiter.is_allowed("user1", max_requests=3, window_seconds=1) is False

        # Wait for window to expire
        time.sleep(1.1)
        assert limiter.is_allowed("user1", max_requests=3, window_seconds=1) is True


class TestGetClientIp:
    """Test cases for _get_client_ip helper function."""

    def test_x_forwarded_for_single_ip(self):
        """Extracts IP from X-Forwarded-For header."""
        request = MagicMock()
        request.headers = {"X-Forwarded-For": "192.168.1.1"}
        assert _get_client_ip(request) == "192.168.1.1"

    def test_x_forwarded_for_multiple_ips(self):
        """Takes first IP from X-Forwarded-For header."""
        request = MagicMock()
        request.headers = {"X-Forwarded-For": "192.168.1.1, 10.0.0.1, 172.16.0.1"}
        assert _get_client_ip(request) == "192.168.1.1"

    def test_x_real_ip(self):
        """Falls back to X-Real-IP header."""
        request = MagicMock()
        request.headers = {"X-Real-IP": "10.0.0.5"}
        assert _get_client_ip(request) == "10.0.0.5"

    def test_x_forwarded_for_takes_priority(self):
        """X-Forwarded-For takes priority over X-Real-IP."""
        request = MagicMock()
        request.headers = {"X-Forwarded-For": "192.168.1.1", "X-Real-IP": "10.0.0.5"}
        assert _get_client_ip(request) == "192.168.1.1"

    def test_falls_back_to_client_host(self):
        """Falls back to request.client.host when no headers."""
        request = MagicMock()
        request.headers = {}
        request.client.host = "127.0.0.1"
        assert _get_client_ip(request) == "127.0.0.1"

    def test_returns_unknown_when_no_client(self):
        """Returns 'unknown' when no client info available."""
        request = MagicMock()
        request.headers = {}
        request.client = None
        assert _get_client_ip(request) == "unknown"


class TestRateLimitDecorator:
    """Test cases for rate_limit decorator."""

    @pytest.mark.asyncio
    async def test_skips_rate_limiting_in_test_env(self):
        """Rate limiting is skipped when TESTING=true."""

        @rate_limit(max_requests=1, window_seconds=60)
        async def test_endpoint():
            return "success"

        with patch.dict("os.environ", {"TESTING": "true"}):
            # Should work even though we call it multiple times
            assert await test_endpoint() == "success"
            assert await test_endpoint() == "success"

    @pytest.mark.asyncio
    async def test_skips_for_root_admin(self):
        """Rate limiting is skipped for root admin users."""

        @rate_limit(max_requests=1, window_seconds=60)
        async def test_endpoint(user=None):
            return "success"

        with patch.dict("os.environ", {"TESTING": "false"}):
            user = {"role": "root_admin", "id": 0}
            # Should work even though limit is 1
            assert await test_endpoint(user=user) == "success"
            assert await test_endpoint(user=user) == "success"


class TestCacheResponseDecorator:
    """Test cases for cache_response decorator."""

    @pytest.mark.asyncio
    async def test_caches_response(self):
        """Response is cached on subsequent calls."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        call_count = 0

        @cache_response(cache, key_prefix="test")
        async def expensive_operation(param1: str):
            nonlocal call_count
            call_count += 1
            return f"result_{param1}"

        result1 = await expensive_operation("foo")
        result2 = await expensive_operation("foo")

        assert result1 == "result_foo"
        assert result2 == "result_foo"
        assert call_count == 1  # Function only called once

    @pytest.mark.asyncio
    async def test_refresh_bypasses_cache(self):
        """Setting refresh=True bypasses cache."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        call_count = 0

        @cache_response(cache, key_prefix="test")
        async def expensive_operation(refresh: bool = False):
            nonlocal call_count
            call_count += 1
            return f"result_{call_count}"

        await expensive_operation()
        await expensive_operation(refresh=True)

        # Function should be called twice (second time bypasses cache)
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_different_params_different_cache(self):
        """Different parameters produce different cache keys."""
        cache = AsyncLRUCache(maxsize=10, ttl=300)
        call_count = 0

        @cache_response(cache, key_prefix="test")
        async def get_data(category: str):
            nonlocal call_count
            call_count += 1
            return f"data_{category}"

        result1 = await get_data(category="sports")
        result2 = await get_data(category="news")
        result3 = await get_data(category="sports")

        assert result1 == "data_sports"
        assert result2 == "data_news"
        assert result3 == "data_sports"
        assert call_count == 2  # "sports" was cached after first call
