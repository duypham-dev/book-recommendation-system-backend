import { activateAccount } from "#services/activateAccountService.js";
import { ApiResponse, logger } from "#utils/index.js";

export const activateAccountHandler = async (req, res) => {
    const { token } = req.body;
    try{
        await activateAccount(token);
        logger.info('Account activated successfully via token');
        return ApiResponse.success(res, null, 'Tài khoản đã được kích hoạt thành công');
    }
    catch (error) {
        logger.error('Account activation error', { error: error.message });
        return ApiResponse.error(res, 'Liên kết kích hoạt không hợp lệ hoặc đã hết hạn', 400);
    }
};