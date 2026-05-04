import { Alert } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { authStore } from '../state/auth.store';

export function TrialBanner() {
  const user = authStore((state) => state.user);

  if (!user?.trialEndsAt || user.companyStatus !== 'trial') {
    return null;
  }

  const now = Date.now();
  const trialEnd = new Date(user.trialEndsAt).getTime();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
  const isExpired = trialEnd <= now;

  if (isExpired) {
    return (
      <Alert
        type="error"
        showIcon
        icon={<ClockCircleOutlined />}
        className="mb-4 rounded-xl"
        message="试用已到期"
        description="您的企业试用期已结束。系统将以只读模式运行，请联系我们升级为正式版本以恢复全部功能。"
      />
    );
  }

  if (daysRemaining <= 7) {
    return (
      <Alert
        type="warning"
        showIcon
        icon={<ClockCircleOutlined />}
        className="mb-4 rounded-xl"
        message={`试用期剩余 ${daysRemaining} 天`}
        description={`您的免费试用将在 ${daysRemaining} 天后到期，到期后系统将进入只读模式。请及时联系我们完成正式版本升级，数据将无缝保留。`}
      />
    );
  }

  return (
    <Alert
      type="info"
      showIcon
      icon={<ClockCircleOutlined />}
      className="mb-4 rounded-xl"
      message={`试用期剩余 ${daysRemaining} 天`}
      description={`欢迎使用企业人力资源智能平台！当前处于 ${daysRemaining} 天免费试用期，最多支持 20 个用户。`}
      closable
    />
  );
}
