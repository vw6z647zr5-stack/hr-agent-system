import { Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerCandidate } from '../api/recruitment';
import { authStore } from '../state/auth.store';

export function CandidateRegisterPage() {
  const navigate = useNavigate();
  const { setSession } = authStore();
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Card className="border-slate-200 shadow-card">
          <Typography.Title level={2}>候选人注册</Typography.Title>
          <Typography.Paragraph type="secondary">
            注册后可查看自己的投递进度，并继续在系统中提交简历。
          </Typography.Paragraph>

          <Form
            layout="vertical"
            onFinish={async (values) => {
              try {
                setLoading(true);
                const response = await registerCandidate(values);
                setSession(response.accessToken, response.user);
                navigate('/career/me');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Item name="fullName" label="姓名" rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="currentCompany" label="当前公司">
              <Input size="large" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
              <Input.Password size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              注册并进入候选人门户
            </Button>
          </Form>

          <Typography.Paragraph className="!mb-0 !mt-4">
            已有账号？<Link to="/login">去登录</Link>
          </Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
