"""Simple in-memory caching and rate limiting utilities for osmosmjerka backend."""

import os
import time
from collections import defaultdict
from functools import wraps
from typing import Any, Dict, Optional

from fastapi import HTTPException


class AsyncLRUCache:
    """Simple async-compatible LRU cache with TTL support."""

    def __init__(self, maxsize: int = 128, ttl: int = 300):
        self.cache: Dict[str, tuple[Any, float]] = {}
        self.maxsize = maxsize
        self.ttl = ttl

    def get(self, key: str) -> Optional[Any]:
        """Get cached value if it exists and hasn't expired."""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        """Set cached value, removing oldest entry if cache is full."""
        if len(self.cache) >= self.maxsize:
            # Remove oldest entry
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]
        self.cache[key] = (value, time.time())

    def invalidate(self, pattern: str | None = None) -> None:
        """Invalidate cache entries. If pattern provided, remove matching keys."""
        if pattern is None:
            self.cache.clear()
        else:
            keys_to_remove = [key for key in self.cache.keys() if pattern in key]
            for key in keys_to_remove:
                del self.cache[key]


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self):
        self.requests: Dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, identifier: str, max_requests: int, window_seconds: int) -> bool:
        """Check if request is allowed within rate limits."""
        now = time.time()

        # Clean old requests
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier] if now - req_time < window_seconds
        ]

        if len(self.requests[identifier]) >= max_requests:
            return False

        self.requests[identifier].append(now)
        return True


# Global instances
categories_cache = AsyncLRUCache(maxsize=50, ttl=300)  # 5 min TTL
language_sets_cache = AsyncLRUCache(maxsize=10, ttl=600)  # 10 min TTL
phrases_cache = AsyncLRUCache(maxsize=100, ttl=180)  # 3 min TTL
rate_limiter = RateLimiter()


def rate_limit(max_requests: int, window_seconds: int):
    """Decorator to add rate limiting to FastAPI endpoints."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Skip rate limiting in test environment
            if os.getenv("TESTING") == "true":
                return await func(*args, **kwargs)

            # Extract user from request - user is typically passed as dependency
            user = None
            for arg in args:
                if hasattr(arg, "get") and "id" in str(arg):
                    user = arg
                    break

            # Try to get user from kwargs
            if not user:
                user = kwargs.get("user")

            # Create identifier
            if user and isinstance(user, dict) and "id" in user:
                identifier = f"user_{user['id']}"
            else:
                identifier = "anonymous"

            if not rate_limiter.is_allowed(identifier, max_requests, window_seconds):
                raise HTTPException(status_code=429, detail="Too many requests. Please wait before trying again.")

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def cache_response(cache_instance: AsyncLRUCache, key_prefix: str = ""):
    """Decorator to cache FastAPI endpoint responses."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Check if refresh is requested to bypass cache
            refresh_requested = kwargs.get("refresh", False)

            # Generate cache key from function name and relevant parameters
            cache_key_parts = [key_prefix, func.__name__]

            # Add all arguments to cache key for better uniqueness
            for arg in args:
                if isinstance(arg, (str, int, float, bool)):
                    cache_key_parts.append(str(arg))

            # Add relevant parameters to cache key (excluding refresh parameter)
            for key, value in kwargs.items():
                if key != "refresh" and isinstance(value, (str, int, float, bool)):
                    cache_key_parts.append(f"{key}_{value}")

            cache_key = "_".join(filter(None, cache_key_parts))

            # If refresh is not requested, try to get from cache
            if not refresh_requested:
                cached_result = cache_instance.get(cache_key)
                if cached_result is not None:
                    return cached_result

            # Execute function and cache result
            result = await func(*args, **kwargs)

            # Only cache if refresh was not requested (to avoid caching forced refreshes)
            if not refresh_requested:
                cache_instance.set(cache_key, result)

            return result

        return wrapper

    return decorator
