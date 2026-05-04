import { CameraOutlined } from '@ant-design/icons';
import { Avatar, Button, Space, Tooltip, Upload, message } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { useState } from 'react';
import { uploadMyPhoto } from '../api/auth';
import { resolveAssetUrl } from '../api/http';
import { authStore } from '../state/auth.store';
import type { AuthUser } from '../types';

interface UserPhotoUploadProps {
  user: AuthUser | null;
  size?: number;
  showText?: boolean;
  onUploaded?: () => void | Promise<void>;
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxSizeBytes = 5 * 1024 * 1024;

export function UserPhotoUpload({ user, size = 40, showText = false, onUploaded }: UserPhotoUploadProps) {
  const updateUser = authStore((state) => state.updateUser);
  const [uploading, setUploading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const beforeUpload = async (file: RcFile) => {
    if (!allowedTypes.has(file.type)) {
      messageApi.error('仅支持 JPG、PNG 或 WebP 照片。');
      return Upload.LIST_IGNORE;
    }

    if (file.size > maxSizeBytes) {
      messageApi.error('照片大小不能超过 5MB。');
      return Upload.LIST_IGNORE;
    }

    try {
      setUploading(true);
      const response = await uploadMyPhoto(file);
      updateUser(response.user);
      messageApi.success('照片已更新。');
      await onUploaded?.();
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setUploading(false);
    }

    return Upload.LIST_IGNORE;
  };

  const avatar = (
    <Avatar src={resolveAssetUrl(user?.photoUrl)} size={size} className="bg-brand align-middle">
      {user?.displayName?.slice(0, 1) ?? '?'}
    </Avatar>
  );

  return (
    <>
      {contextHolder}
      <Upload accept="image/jpeg,image/png,image/webp" beforeUpload={beforeUpload} showUploadList={false} disabled={uploading}>
        {showText ? (
          <Space>
            {avatar}
            <Button icon={<CameraOutlined />} loading={uploading}>
              上传照片
            </Button>
          </Space>
        ) : (
          <Tooltip title="上传照片">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center rounded-full border-0 bg-transparent p-0"
              aria-label="上传照片"
            >
              {avatar}
            </button>
          </Tooltip>
        )}
      </Upload>
    </>
  );
}
