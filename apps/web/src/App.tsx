import { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SkeletonPage } from './components/shared';
import { authStore } from './state/auth.store';

const AppLayout = lazy(async () => ({
  default: (await import('./layouts/AppLayout')).AppLayout,
}));
const DashboardPage = lazy(async () => ({
  default: (await import('./pages/DashboardPage')).DashboardPage,
}));
const LoginPage = lazy(async () => ({
  default: (await import('./pages/LoginPage')).LoginPage,
}));
const ResourceRoutePage = lazy(async () => ({
  default: (await import('./pages/ResourceRoutePage')).ResourceRoutePage,
}));
const ProfileChangeReviewPage = lazy(async () => ({
  default: (await import('./pages/ProfileChangeReviewPage')).ProfileChangeReviewPage,
}));
const RecruitmentWorkbenchPage = lazy(async () => ({
  default: (await import('./pages/RecruitmentWorkbenchPage')).RecruitmentWorkbenchPage,
}));
const SelfServicePage = lazy(async () => ({
  default: (await import('./pages/SelfServicePage')).SelfServicePage,
}));
const CompanyRegisterPage = lazy(async () => ({
  default: (await import('./pages/CompanyRegisterPage')).CompanyRegisterPage,
}));
const CandidateRegisterPage = lazy(async () => ({
  default: (await import('./pages/CandidateRegisterPage')).CandidateRegisterPage,
}));
const CareerPage = lazy(async () => ({
  default: (await import('./pages/CareerPage')).CareerPage,
}));
const CandidatePortalPage = lazy(async () => ({
  default: (await import('./pages/CandidatePortalPage')).CandidatePortalPage,
}));
const KnowledgeCenterPage = lazy(async () => ({
  default: (await import('./pages/KnowledgeCenterPage')).KnowledgeCenterPage,
}));

export default function App() {
  const restore = authStore((state) => state.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-mist p-8">
              <SkeletonPage />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<CompanyRegisterPage />} />
            <Route path="/career" element={<CareerPage />} />
            <Route path="/career/register" element={<CandidateRegisterPage />} />

            <Route element={<ProtectedRoute roles={['candidate']} />}>
              <Route path="/career/me" element={<CandidatePortalPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['admin', 'hr', 'manager', 'employee']} />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profile-change-reviews" element={<ProfileChangeReviewPage />} />
                <Route path="/recruitment-workbench" element={<RecruitmentWorkbenchPage />} />
                <Route path="/self-service" element={<SelfServicePage />} />
                <Route path="/resources/:resourceKey" element={<ResourceRoutePage />} />
                <Route element={<ProtectedRoute roles={['admin', 'hr', 'manager']} />}>
                  <Route path="/knowledge-center" element={<KnowledgeCenterPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('应用渲染失败', error, errorInfo);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-mist px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-panel">
            <Alert
              type="error"
              showIcon
              message="页面加载失败"
              description={this.state.error.message || '前端运行时发生异常，请刷新页面后重试。'}
            />
            <Button className="mt-5" type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
