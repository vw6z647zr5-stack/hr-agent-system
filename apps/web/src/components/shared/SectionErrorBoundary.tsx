import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  retryKey: number;
}

export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.name ?? '页面区域'}] 渲染错误`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
  };

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
          <Alert
            type="error"
            showIcon
            message={this.props.name ? `${this.props.name} 加载失败` : '加载失败'}
            description={this.state.error.message || '渲染发生异常'}
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={this.handleRetry}>
                重试
              </Button>
            }
          />
        </div>
      );
    }

    return <ErrorReset key={this.state.retryKey}>{this.props.children}</ErrorReset>;
  }
}

function ErrorReset({ children, key }: { children: ReactNode; key: number }) {
  return <>{children}</>;
}
