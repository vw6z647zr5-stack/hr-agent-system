import {
  BellOutlined,
  BookOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RadarChartOutlined,
  RobotOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Badge, Button, Divider, Drawer, Dropdown, Empty, Input, Layout, List, Menu, Modal, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logoutSession } from '../api/auth';
import {
  completeWorkflowTask,
  getUnreadNotificationCount,
  listNotifications,
  listWorkflowTasks,
  markAllNotificationsRead,
  markNotificationRead,
  type WorkflowNotification,
  type WorkflowTask,
} from '../api/workflow';
import { BrandMark } from '../components/BrandMark';
import { UserPhotoUpload } from '../components/UserPhotoUpload';
import { resourceGroups } from '../config/resources';
import { useIsMobile } from '../hooks';
import { authStore } from '../state/auth.store';
import { getRoleLabel } from '../utils/display';

const { Header, Content, Sider } = Layout;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, logout } = authStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<WorkflowNotification[]>([]);
  const [workflowTasks, setWorkflowTasks] = useState<WorkflowTask[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    void logoutSession().catch(() => undefined);
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const refreshWorkflow = async () => {
    if (!user) {
      return;
    }

    try {
      setWorkflowLoading(true);
      const [countPayload, notificationPayload, taskPayload] = await Promise.all([
        getUnreadNotificationCount(),
        listNotifications(20),
        listWorkflowTasks('pending', 20),
      ]);
      setNotificationCount(countPayload.count);
      setNotifications(notificationPayload);
      setWorkflowTasks(taskPayload);
    } catch {
      setNotificationCount(0);
    } finally {
      setWorkflowLoading(false);
    }
  };

  useEffect(() => {
    void refreshWorkflow();
  }, [user?.userId]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void getUnreadNotificationCount()
        .then((payload) => setNotificationCount(payload.count))
        .catch(() => undefined);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [user?.userId]);

  const menuItems = useMemo(() => {
    const features = user?.features ?? {};
    const featureGate = (feature: string) => features[feature] !== false;

    const managementItems = resourceGroups
      .map((group) => {
        // payroll module is feature-gated
        if (group.key === 'payroll' && !featureGate('payroll')) {
          return { key: `group-${group.key}`, label: group.label, icon: <TeamOutlined />, children: [] };
        }
        return {
          key: `group-${group.key}`,
          label: group.label,
          icon: <TeamOutlined />,
          children: group.items
            .filter((item) => (user ? item.roles.includes(user.role) : false))
            .map((item) => ({ key: item.path, label: item.label })),
        };
      })
      .filter((group) => group.children.length > 0);

    const items: any[] = [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '总览看板' },
    ];

    if (user && ['admin', 'hr', 'manager'].includes(user.role) && featureGate('aiAgent')) {
      items.push({ key: '/knowledge-center', icon: <BookOutlined />, label: '知识中心' });
    }

    if (user && ['admin', 'hr', 'manager'].includes(user.role) && featureGate('recruitment')) {
      items.push({ key: '/recruitment-workbench', icon: <RadarChartOutlined />, label: '招聘工作台' });
    }

    if (user && ['admin', 'hr'].includes(user.role)) {
      items.push({ key: '/profile-change-reviews', icon: <FileSearchOutlined />, label: '资料变更审批' });
    }

    if (user?.employeeId) {
      items.push({ key: '/self-service', icon: <RobotOutlined />, label: '员工自助' });
    }

    items.push(...managementItems);

    return items;
  }, [user]);

  const currentPageTitle = useMemo(() => {
    for (const item of menuItems) {
      if (item.key === location.pathname) return item.label;
      if (item.children) {
        const child = item.children.find((c: any) => c.key === location.pathname);
        if (child) return child.label;
      }
    }
    return '工作台';
  }, [location.pathname, menuItems]);

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/8 px-5 py-5">
        <BrandMark inverse />
      </div>
      <div className="sidebar-menu-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={menuItems.filter((i: any) => i.children).map((i: any) => i.key)}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            setMobileMenuOpen(false);
          }}
          className="!border-none !bg-transparent [&_.ant-menu-item-selected]:!bg-brand/20 [&_.ant-menu-item]:!rounded-lg [&_.ant-menu-item]:!mx-1 [&_.ant-menu-item]:!my-0.5 [&_.ant-menu-sub]:!bg-white/4"
          style={{ '--ant-menu-dark-item-selected-bg': 'rgba(15,118,110,0.28)' } as React.CSSProperties}
        />
      </div>
      <div className="shrink-0 border-t border-white/8 px-3 py-3">
        <Dropdown
          menu={{
            items: [
              {
                key: 'profile',
                icon: <UserOutlined />,
                label: `${user?.displayName ?? '-'} · ${getRoleLabel(user?.role)}`,
                disabled: true,
              },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                danger: true,
                onClick: handleLogout,
              },
            ],
          }}
          placement="topRight"
          trigger={['click']}
        >
          <div className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5">
            <UserPhotoUpload user={user} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{user?.displayName ?? '-'}</div>
              <div className="text-xs text-slate-400">{getRoleLabel(user?.role)}</div>
            </div>
          </div>
        </Dropdown>
      </div>
    </div>
  );

  return (
    <Layout className="h-screen overflow-hidden bg-mist">
      {isMobile ? (
        <Drawer
          placement="left"
          width={260}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          className="!bg-[#101827]"
          bodyStyle={{ padding: 0 }}
          closable={false}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          width={240}
          trigger={null}
          collapsible
          collapsed={collapsed}
          className="!bg-[#101827]"
        >
          {sidebarContent}
        </Sider>
      )}

      <Layout className="h-full overflow-hidden">
        <Header className="shrink-0 z-10 flex h-auto items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined className="text-lg" />}
                onClick={() => setMobileMenuOpen(true)}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined className="text-lg" /> : <MenuFoldOutlined className="text-lg" />}
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
            <div className="min-w-0">
              <Typography.Title level={5} className="!mb-0 truncate !text-base sm:!text-lg">
                {currentPageTitle}
              </Typography.Title>
              <Typography.Text type="secondary" className="hidden text-xs sm:inline">
                企业人力资源智能平台
              </Typography.Text>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 cursor-pointer hover:border-brand/30 hover:bg-white transition-colors sm:inline-flex w-44 lg:w-56"
              onClick={() => setSearchOpen(true)}
            >
              <SearchOutlined className="text-slate-400" />
              <span className="text-xs">搜索页面或功能...</span>
              <span className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0 text-[10px] text-slate-400">Ctrl+K</span>
            </div>

            <Badge count={notificationCount} size="small" className="notification-badge">
              <Button
                type="text"
                icon={<BellOutlined className="text-lg text-slate-500" />}
                className="!rounded-lg hover:!bg-amber-50 hover:!text-amber-500"
                aria-label="通知"
                onClick={() => {
                  setWorkflowOpen(true);
                  void refreshWorkflow();
                }}
              />
            </Badge>

            {!isMobile && (
              <Button
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                className="hidden border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-500 sm:inline-flex"
              >
                退出
              </Button>
            )}
          </div>
        </Header>

        <Content className="flex-1 overflow-hidden bg-[#f6f8fb]">
          <div ref={contentRef} className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </Content>

        <footer className="shrink-0 border-t border-slate-100 bg-white/50 px-6 py-4 text-center text-xs text-slate-400">
          明智人力 · 企业人力资源智能平台 &copy; {new Date().getFullYear()}
        </footer>
      </Layout>

      <Modal
        title="全局搜索"
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        width={520}
        className="[&_.ant-modal-content]:!rounded-2xl"
      >
        <Input.Search
          placeholder="搜索页面、功能或文档..."
          enterButton
          size="large"
          className="!rounded-xl"
          onSearch={(value) => {
            const q = value.trim().toLowerCase();
            if (!q) return;

            for (const group of resourceGroups) {
              for (const item of group.items) {
                if (item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)) {
                  navigate(item.path);
                  setSearchOpen(false);
                  return;
                }
              }
            }

            if (q.includes('看板') || q.includes('dashboard')) { navigate('/dashboard'); setSearchOpen(false); }
            else if (q.includes('知识') || q.includes('文档')) { navigate('/knowledge-center'); setSearchOpen(false); }
            else if (q.includes('招聘') || q.includes('简历')) { navigate('/recruitment-workbench'); setSearchOpen(false); }
            else if (q.includes('自助') || q.includes('员工')) { navigate('/self-service'); setSearchOpen(false); }
            else {
              Modal.info({
                title: '未找到匹配入口',
                content: '请换一个关键词，或从下方常用入口进入对应模块。',
                okText: '知道了',
              });
            }
          }}
        />
        <Divider className="!my-4" />
        <div className="text-xs text-slate-500">常用入口</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { label: '总览看板', path: '/dashboard' },
            { label: '招聘工作台', path: '/recruitment-workbench' },
            { label: '员工自助', path: '/self-service' },
            { label: '知识中心', path: '/knowledge-center' },
            { label: '员工档案', path: '/resources/employees' },
            { label: '职位发布', path: '/resources/job-postings' },
          ].map((item) => (
            <Button
              key={item.path}
              size="small"
              className="rounded-lg"
              onClick={() => {
                navigate(item.path);
                setSearchOpen(false);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Modal>

      <Drawer
        title="通知与流程待办"
        open={workflowOpen}
        width={520}
        onClose={() => setWorkflowOpen(false)}
        extra={
          <Space>
            <Button size="small" onClick={() => void refreshWorkflow()} loading={workflowLoading}>
              刷新
            </Button>
            <Button
              size="small"
              onClick={() => {
                void markAllNotificationsRead().then(() => refreshWorkflow());
              }}
            >
              全部已读
            </Button>
          </Space>
        }
      >
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <Typography.Title level={5} className="!mb-0">
                待处理任务
              </Typography.Title>
              <Tag color="processing">{workflowTasks.length}</Tag>
            </div>
            <List
              loading={workflowLoading}
              dataSource={workflowTasks}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待办任务" /> }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="open"
                      size="small"
                      type="link"
                      onClick={() => {
                        if (item.linkPath) {
                          navigate(item.linkPath);
                          setWorkflowOpen(false);
                        }
                      }}
                    >
                      查看
                    </Button>,
                    <Button
                      key="complete"
                      size="small"
                      onClick={() => void completeWorkflowTask(item.id).then(() => refreshWorkflow())}
                    >
                      完成
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div className="flex items-center gap-2">
                        <span>{item.title}</span>
                        <Tag color={getPriorityColor(item.priority)}>{getPriorityLabel(item.priority)}</Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div>{item.description || '无补充说明'}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.dueAt ? `截止：${formatWorkflowTime(item.dueAt)}` : `创建：${formatWorkflowTime(item.createdAt)}`}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </section>

          <Divider className="!my-3" />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <Typography.Title level={5} className="!mb-0">
                最近通知
              </Typography.Title>
              <Tag color="gold">{notificationCount} 条未读</Tag>
            </div>
            <List
              loading={workflowLoading}
              dataSource={notifications}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" /> }}
              renderItem={(item) => (
                <List.Item
                  className={item.isRead ? 'opacity-75' : ''}
                  actions={[
                    <Button
                      key="open"
                      size="small"
                      type="link"
                      onClick={() => {
                        void markNotificationRead(item.id).then(() => refreshWorkflow());
                        if (item.linkPath) {
                          navigate(item.linkPath);
                          setWorkflowOpen(false);
                        }
                      }}
                    >
                      查看
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div className="flex items-center gap-2">
                        <span>{item.title}</span>
                        {!item.isRead ? <Tag color="red">未读</Tag> : null}
                      </div>
                    }
                    description={
                      <div>
                        <div>{item.message}</div>
                        <div className="mt-1 text-xs text-slate-400">{formatWorkflowTime(item.createdAt)}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </section>
        </div>
      </Drawer>
    </Layout>
  );
}

function getPriorityColor(priority: string) {
  if (priority === 'high') return 'red';
  if (priority === 'medium') return 'orange';
  return 'blue';
}

function getPriorityLabel(priority: string) {
  if (priority === 'high') return '高';
  if (priority === 'medium') return '中';
  return '低';
}

function formatWorkflowTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
