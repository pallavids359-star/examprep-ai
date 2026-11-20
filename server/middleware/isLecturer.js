// Runs AFTER "protect". Lecturers and admins (head lecturers) get through.
const isLecturer = (req, res, next) => {
    if (req.user && (req.user.role === "lecturer" || req.user.role === "admin")) return next();
    return res.status(403).json({ message: "Lecturers only" });
};

module.exports = isLecturer;
