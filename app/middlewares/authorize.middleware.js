import {ApiResponse} from '#utils/index.js';

/**
 * Middleware kiểm tra quyền truy cập dựa trên Role
 * @param {...string} allowedRoles - Danh sách các role được phép truy cập
 */
export const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if(!req.user || !req.user.role) {
            return ApiResponse.error(res, 'Unauthorized: You are not logged in or invalid token', 403);
        }
        const hasPermission = allowedRoles.includes(req.user.role);
        if (!hasPermission){
            return ApiResponse.error(res, 'Forbidden: You do not have permission to access this resource.', 403);
        } 
        next();
    };
};