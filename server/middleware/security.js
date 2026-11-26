// Small production safety helpers (no extra packages needed)

// Safe browser headers on every reply
const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
};

// Limits how many requests one address can make in a time window.
// Stops password guessing and accidental floods. Memory based: fine for one server.
const rateLimit = ({ windowMs, max, message }) => {
    const hits = new Map(); // ip -> { count, resetAt }
    const timer = setInterval(() => {
        const now = Date.now();
        for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
    }, windowMs);
    timer.unref();

    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        let h = hits.get(ip);
        if (!h || h.resetAt <= now) {
            h = { count: 0, resetAt: now + windowMs };
            hits.set(ip, h);
        }
        h.count += 1;
        res.setHeader("RateLimit-Limit", String(max));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, max - h.count)));
        if (h.count > max) {
            res.setHeader("Retry-After", String(Math.ceil((h.resetAt - now) / 1000)));
            return res.status(429).json({ message });
        }
        next();
    };
};

// Unknown API address
const apiNotFound = (req, res) => res.status(404).json({ message: "Not found" });

// Last stop for errors: never show stack traces to users
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ message: "The request could not be read" });
    if (err.type === "entity.too.large") return res.status(413).json({ message: "The upload is too large" });
    console.error("Unhandled error:", err.message, req.method, req.originalUrl);
    res.status(err.status || 500).json({ message: "Something went wrong on the server" });
};

module.exports = { securityHeaders, rateLimit, apiNotFound, errorHandler };
