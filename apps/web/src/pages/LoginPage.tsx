import {
  ArrowRightOutlined,
  BankOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/http';
import { BrandMark } from '../components/BrandMark';
import { authStore } from '../state/auth.store';
import type { AuthUser } from '../types';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const capabilityItems = [
  { icon: <TeamOutlined />, label: '组织人员', value: '统一档案', helper: '部门、岗位、合同与员工生命周期集中管理' },
  { icon: <SafetyCertificateOutlined />, label: '招聘协同', value: '智能筛选', helper: '职位健康度、候选人优先级和面试安排联动' },
  { icon: <UserOutlined />, label: '员工服务', value: '自助闭环', helper: '假期、薪酬、资料变更和知识库一站式处理' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = authStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { username: string; password: string; remember?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: values.username, password: values.password }),
      });
      setSession(response.accessToken, response.user, Boolean(values.remember));
      navigate(response.user.role === 'candidate' ? '/career/me' : '/dashboard');
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel lg:grid-cols-[1.08fr_0.92fr]">
          {/* Left: Brand panel */}
          <section className="flex min-h-[600px] flex-col justify-between bg-[#101827] p-8 text-white sm:p-10 lg:p-12">
            <div>
              <BrandMark inverse />
              <div className="mt-14 max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />
                  明智人力资源管理系统
                </div>
                <Typography.Title className="!mb-5 !mt-5 !text-4xl !leading-tight !text-white sm:!text-5xl">
                  用一个中文工作台管理
                  <br />
                  <span className="text-teal-100">
                    组织、招聘、绩效和员工服务
                  </span>
                </Typography.Title>
                <Typography.Paragraph className="!mb-0 !max-w-xl !text-base !leading-7 !text-teal-100/80">
                  面向人力资源团队、业务经理、员工和候选人的统一门户，把数据看板、审批待办、风险提醒和智能问答整合到日常操作中。
                </Typography.Paragraph>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {capabilityItems.map((item) => (
                <div
                  key={item.label}
                  className="group rounded-lg border border-white/12 bg-white/6 p-5 transition-all duration-300 hover:bg-white/10 hover:border-white/20"
                >
                  <div className="mb-3 text-teal-300/80 text-lg">{item.icon}</div>
                  <div className="text-xs font-medium text-teal-300">{item.label}</div>
                  <div className="mt-3 text-2xl font-bold">{item.value}</div>
                  <div className="mt-2 text-sm leading-6 text-teal-100/70">{item.helper}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Right: Login form */}
          <section className="flex items-center justify-center p-8 sm:p-12">
            <div className="w-full max-w-sm">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <Typography.Title level={2} className="!mb-1 !text-2xl">
                    登录系统
                  </Typography.Title>
                  <Typography.Text type="secondary">请输入账号信息进入工作台。</Typography.Text>
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-teal-50 text-brand">
                  <SafetyCertificateOutlined className="text-xl" />
                </div>
              </div>

              <Card className="border-slate-200 shadow-card">
                {error ? <Alert className="mb-5" type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}

                <Form layout="vertical" onFinish={onFinish} initialValues={{ remember: false }} size="large">
                  <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名。' }]}>
                    <Input
                      prefix={<UserOutlined className="!text-slate-400" />}
                      placeholder="请输入用户名"
                      autoComplete="username"
                      className="!rounded-xl"
                    />
                  </Form.Item>

                  <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码。' }]}>
                    <Input.Password
                      prefix={<LockOutlined className="!text-slate-400" />}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      className="!rounded-xl"
                      iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    />
                  </Form.Item>

                  <div className="-mt-2 mb-4 flex items-center justify-between">
                    <Form.Item name="remember" valuePropName="checked" noStyle>
                      <Checkbox className="text-sm text-slate-500">记住账号</Checkbox>
                    </Form.Item>
                    <Button type="link" className="!text-xs !text-slate-400" disabled>
                      忘记密码？
                    </Button>
                  </div>

                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={loading}
                    icon={<ArrowRightOutlined />}
                    className="!h-12 !rounded-xl !text-base !font-semibold"
                  >
                    进入工作台
                  </Button>
                </Form>

                <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <TeamOutlined className="text-brand" />
                    候选人入口
                  </div>
                  <div>候选人可浏览开放职位、注册账号、上传简历并查看投递进度。</div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/career" className="font-medium text-brand hover:text-brand/80 transition-colors">
                      浏览招聘职位
                    </Link>
                    <span className="text-slate-300">|</span>
                    <Link to="/career/register" className="font-medium text-brand hover:text-brand/80 transition-colors">
                      注册候选人账号
                    </Link>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-5 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <BankOutlined className="text-brand" />
                    企业试用
                  </div>
                  <div className="mt-2">中小型企业可注册 30 天免费试用，体验智能人事管理全流程。</div>
                  <div className="mt-3">
                    <Link to="/register" className="font-medium text-brand hover:text-brand/80 transition-colors">
                      注册企业试用账号
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
