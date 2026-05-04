import { Alert } from 'antd';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ResourcePage } from '../components/ResourcePage';
import { resourceMap } from '../config/resources';
import { authStore } from '../state/auth.store';

export function ResourceRoutePage() {
  const { resourceKey } = useParams();
  const user = authStore((state) => state.user);

  const resource = useMemo(() => (resourceKey ? resourceMap[resourceKey] : undefined), [resourceKey]);

  if (!resource) {
    return <Alert type="error" message="未找到资源配置。" />;
  }

  if (!user || !resource.roles.includes(user.role)) {
    return <Alert type="warning" message="当前角色无权访问该资源。" />;
  }

  return <ResourcePage config={resource} />;
}
