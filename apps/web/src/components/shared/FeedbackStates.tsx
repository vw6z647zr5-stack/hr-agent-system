import { Button, Result } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title = '暂无数据', description = '当前区域没有可展示的内容。', action }: EmptyStateProps) {
  return (
    <Result
      status="info"
      title={title}
      subTitle={description}
      extra={
        action ? (
          <Button type="primary" icon={<ReloadOutlined />} onClick={action.onClick}>
            {action.label}
          </Button>
        ) : undefined
      }
    />
  );
}

export function ErrorState({
  message = '数据加载失败',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Result
      status="error"
      title="加载失败"
      subTitle={message}
      extra={
        onRetry ? (
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
            重新加载
          </Button>
        ) : undefined
      }
    />
  );
}
