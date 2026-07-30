"""Simple in-memory caching and rate limiting utilities for osmosmjerka backend."""

import os
import time
from collections import defaultdict
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from fastapi import HTTPException, Request
from osmosmjerka.logging_config import get_logger

F = TypeVar("F", bound=Callable[..., Any])

logger = get_logger(__name__)


class AsyncLRUCache:
    """Simple async-compatible LRU cache with TTL support."""

    def __init__(self, maxsize: int = 128, ttl: int = 300) -> None:
        self.cache: dict[str, tuple[Any, float]] = {}
        self.maxsize = maxsize
        self.ttl = ttl

    def get(self, key: str) -> Any | None:
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

    def __init__(self) -> None:
        self.requests: dict[str, list[float]] = defaultdict(list)

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


def _trusted_proxy_hops() -> int:
    """How many reverse proxies sit in front of the app (1 = the k8s ingress)."""
    try:
        return max(int(os.getenv("TRUSTED_PROXY_HOPS", "1")), 0)
    except ValueError:
        return 1


def _get_client_ip(request: Request) -> str:
    """Extract the client IP, reading X-Forwarded-For from the right-hand side.

    X-Forwarded-For is a client-supplied header that each proxy *appends* to, so the
    leftmost entry is whatever the client claimed and can be forged freely - reading it
    lets anyone defeat every per-IP rate limit by rotating the header, which is exactly
    what a brute-force script would do. Only the entries our own proxies added are
    trustworthy, so we count TRUSTED_PROXY_HOPS in from the end.

    With the default of one hop and a chain of "1.2.3.4, 203.0.113.7" this returns
    203.0.113.7 - the address the ingress observed. Set TRUSTED_PROXY_HOPS to match the
    actual number of proxies; 0 ignores the header entirely and uses the socket peer.
    """
    hops = _trusted_proxy_hops()
    if hops:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            chain = [part.strip() for part in forwarded_for.split(",") if part.strip()]
            if chain:
                # Clamp: a chain shorter than the configured hop count means the request
                # didn't come through the full proxy path, so take the oldest entry we have.
                return chain[-min(hops, len(chain))]

        # X-Real-IP is set by the proxy itself and holds a single address, so there is no
        # chain to pick from.
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

    # Fall back to direct client IP
    if request.client:
        return request.client.host

    return "unknown"


def rate_limit(max_requests: int, window_seconds: int) -> Callable[[F], F]:
    """Decorator to add rate limiting to FastAPI endpoints.

    Rate limiting is skipped for:
    - Test environment (TESTING=true)
    - Root admin users (role="root_admin")

    Uses IP-based rate limiting for anonymous users to prevent single IP from
    exhausting the shared anonymous rate limit bucket.

    Args:
        max_requests: Maximum number of requests allowed
        window_seconds: Time window in seconds for rate limiting

    Returns:
        Decorator function that wraps the endpoint with rate limiting
    """

    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Skip rate limiting in test environment
            if os.getenv("TESTING") == "true":
                return await func(*args, **kwargs)

            # Extract user and request from kwargs
            user = kwargs.get("user")
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                # Try to find request in kwargs
                request = kwargs.get("request")

            # Skip rate limiting for root admin users
            if user and isinstance(user, dict):
                user_role = user.get("role")
                if user_role == "root_admin":
                    return await func(*args, **kwargs)

            # Create identifier - use user ID if authenticated, otherwise use IP
            if user and isinstance(user, dict) and "id" in user:
                identifier = f"user_{user['id']}"
            else:
                # For anonymous users, use IP address to prevent single IP from exhausting shared bucket
                if request:
                    client_ip = _get_client_ip(request)
                    identifier = f"ip_{client_ip}"
                else:
                    identifier = "anonymous"

            # Scope the bucket to this endpoint. Without it every decorated endpoint shares
            # one list of timestamps per caller, so whichever limit is tightest applies to
            # all of them at once and ordinary browsing can lock a user out of, say, login.
            identifier = f"{func.__name__}:{identifier}"

            if not rate_limiter.is_allowed(identifier, max_requests, window_seconds):
                logger.warning(
                    "Rate limit exceeded",
                    extra={
                        "identifier": identifier,
                        "max_requests": max_requests,
                        "window_seconds": window_seconds,
                        "endpoint": func.__name__,
                    },
                )
                raise HTTPException(status_code=429, detail="Too many requests. Please wait before trying again.")

            return await func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator


def cache_response(cache_instance: AsyncLRUCache, key_prefix: str = "", vary_on_user: bool = False) -> Callable[[F], F]:
    """Decorator to cache FastAPI endpoint responses.

    Args:
        cache_instance: The cache instance to use for storing responses
        key_prefix: Optional prefix for cache keys
        vary_on_user: Set this on any endpoint whose response depends on who is asking.
            The cache key is built only from scalar arguments, so the ``Request`` object
            never contributes to it - without this flag two callers hitting the same URL
            share one entry, and the first authenticated response would be served to
            everyone else, including anonymous visitors.

    Returns:
        Decorator function that wraps the endpoint with caching
    """

    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
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

            if vary_on_user:
                # Imported lazily: auth imports the database layer, which imports this
                # module, so a module-level import would be circular.
                from osmosmjerka.auth import optional_user_from_request

                user = optional_user_from_request(kwargs.get("request"))
                cache_key_parts.append(f"user_{user['id']}" if user else "anon")

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

        return wrapper  # type: ignore[return-value]

    return decorator
