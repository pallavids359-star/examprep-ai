const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    try {
        // 1. The token arrives in a header like: "Authorization: Bearer eyJhbGci..."
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Please log in first" });
        }

        const token = header.split(" ")[1];

        // 2. Check the token was made by us and hasn't expired
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Find the user the token belongs to
        const user = await User.findById(decoded.id);

        if (!user || user.status !== "active") {
            return res.status(401).json({ message: "Account not found or inactive" });
        }

        // Password changed after this login was made: log in again
        if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
            return res.status(401).json({ message: "Your password was changed. Please log in again." });
        }

        // 4. Attach the user to the request so controllers can use it
        req.user = user;
        next(); // let the request continue
    } catch (error) {
        return res
            .status(401)
            .json({ message: "Invalid or expired token. Please log in again." });
    }
};

module.exports = protect;