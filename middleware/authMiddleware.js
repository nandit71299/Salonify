import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

dotenv.config();

function authMiddleware(req, res, next) {
    // Get token from request headers

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.SecretKey);
        req.user = decoded.user; // Attach decoded user to request object
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

export default authMiddleware;