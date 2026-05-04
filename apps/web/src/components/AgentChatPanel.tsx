import {
  CloseCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  QuestionCircleOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Collapse, Input, List, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { employeeServiceChat } from '../api/agent';
import { SOCKET_BASE_URL } from '../api/http';
import { authStore } from '../state/auth.store';
import { formatDisplayValue } from '../utils/display';

interface ChatReference {
  id: string;
  title: string;
  category: string;
  sourceType: 'knowledge_base' | 'document' | string;
  excerpt?: string;
  sourcePath?: string;
  section?: string;
}

interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
  timestamp: string;
}

const MAX_CHAT_MESSAGE_LENGTH = 1000;
const QUICK_SUGGESTIONS = [
  { text: '我今年还剩多少年假？', icon: <CalendarOutlined /> },
  { text: '加班流程怎么走？', icon: <ClockCircleOutlined /> },
  { text: '公司的办公时间和地点？', icon: <EnvironmentOutlined /> },
  { text: '试用期转正条件是什么？', icon: <IdcardOutlined /> },
  { text: '如何查看我的工资单？', icon: <DollarOutlined /> },
];

function formatTimestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function AgentChatPanel() {
  const token = authStore((state) => state.token);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      role: 'assistant',
      content: '你好，我是员工服务智能助手。你可以咨询假期余额、公司政策、福利和审批流程问题。',
      timestamp: formatTimestamp(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState(false);
  const pendingSocketFallbackRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const clearPendingSocketFallback = () => {
    if (pendingSocketFallbackRef.current !== null) {
      window.clearTimeout(pendingSocketFallbackRef.current);
      pendingSocketFallbackRef.current = null;
    }
  };

  useEffect(() => {
    if (!token) return;

    const socketEndpoint = SOCKET_BASE_URL ? `${SOCKET_BASE_URL}/agents` : '/agents';
    const instance = io(socketEndpoint, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    instance.on('employee-service:reply', (payload: { reply: string; references?: ChatReference[] }) => {
      clearPendingSocketFallback();
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: payload.reply, references: payload.references ?? [], timestamp: formatTimestamp() },
      ]);
      setLoading(false);
    });

    instance.on('connect', () => {
      setConnectError(false);
      setError(null);
    });

    instance.on('connect_error', () => {
      setConnectError(true);
    });

    setSocket(instance);

    return () => {
      clearPendingSocketFallback();
      instance.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
      setError(`单次咨询内容不能超过 ${MAX_CHAT_MESSAGE_LENGTH} 个字符。`);
      return;
    }

    setError(null);
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: message, timestamp: formatTimestamp() }]);
    setLoading(true);

    try {
      if (socket?.connected) {
        socket.emit('employee-service:message', { message });
        pendingSocketFallbackRef.current = window.setTimeout(() => {
          void (async () => {
            try {
              const response = await employeeServiceChat(message);
              setMessages((current) => [
                ...current,
                { role: 'assistant', content: response.reply, references: response.references ?? [], timestamp: formatTimestamp() },
              ]);
              if (!connectError) setError('实时通道响应超时，已通过接口返回。');
            } catch (sendError) {
              setError((sendError as Error).message);
            } finally {
              pendingSocketFallbackRef.current = null;
              setLoading(false);
            }
          })();
        }, 15_000);
        return;
      }

      const response = await employeeServiceChat(message);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.reply, references: response.references ?? [], timestamp: formatTimestamp() },
      ]);
    } catch (sendError) {
      setError((sendError as Error).message);
    } finally {
      if (!socket?.connected) setLoading(false);
    }
  };

  const copyMessage = (content: string) => {
    void navigator.clipboard.writeText(content);
    messageApi.success('已复制到剪贴板');
  };

  return (
    <Card className="rounded-3xl border-slate-100 shadow-panel overflow-hidden !p-0">
      {contextHolder}

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 via-white to-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-teal-500 shadow-[0_4px_12px_rgba(15,118,110,0.25)]">
              <RobotOutlined className="text-lg text-white" />
            </div>
            <div>
              <Typography.Title level={5} className="!mb-0">
                员工服务智能助手
              </Typography.Title>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${connectError ? 'bg-amber-400' : 'bg-emerald-400'} ${connectError ? '' : 'animate-pulse'}`} />
                <Typography.Text type="secondary" className="!text-[11px]">
                  {connectError ? '离线模式 · 接口调用' : '在线 · AI 实时应答'}
                </Typography.Text>
              </div>
            </div>
          </div>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => {
              setMessages([{
                role: 'assistant',
                content: '你好，我是员工服务智能助手。有什么可以帮你的？',
                timestamp: formatTimestamp(),
              }]);
              setError(null);
            }}
          >
            重置
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-5 pt-4">
          <Alert
            type="warning"
            message={error}
            closable
            onClose={() => setError(null)}
            closeIcon={<CloseCircleOutlined />}
          />
        </div>
      ) : null}

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-5 pt-4">
          <Typography.Text type="secondary" className="!text-xs">常见问题，快速提问</Typography.Text>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion.text}
                size="small"
                icon={suggestion.icon}
                className="rounded-xl border-slate-200 text-xs text-slate-600 hover:border-brand hover:text-brand"
                onClick={() => send(suggestion.text)}
                disabled={loading}
              >
                {suggestion.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={chatListRef}
        className="h-[340px] overflow-y-auto px-5 py-4"
        style={{ background: 'linear-gradient(180deg, #fafcfd 0%, #f8fafb 40%, #ffffff 100%)' }}
      >
        <List
          dataSource={messages}
          split={false}
          renderItem={(msg) => (
            <List.Item className="!mb-3 !px-0">
              <div className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                    msg.role === 'assistant'
                      ? 'bg-gradient-to-br from-brand to-teal-500 shadow-[0_2px_8px_rgba(15,118,110,0.2)]'
                      : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-[0_2px_8px_rgba(100,116,139,0.2)]'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <RobotOutlined className="text-xs text-white" />
                  ) : (
                    <span className="text-xs text-white font-bold">我</span>
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'assistant'
                        ? 'rounded-tl-md border border-slate-200/80 bg-white text-ink shadow-sm'
                        : 'rounded-tr-md bg-gradient-to-br from-brand to-teal-600 text-white shadow-[0_4px_12px_rgba(15,118,110,0.25)]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {msg.role === 'assistant' && msg.references?.length ? (
                      <div className="mt-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-3 text-sm text-slate-600">
                        <Collapse
                          ghost
                          expandIconPosition="end"
                          items={[{
                            key: 'refs',
                            label: <span className="text-xs font-medium text-slate-500">参考来源 ({msg.references.length})</span>,
                            children: (
                              <div className="space-y-2.5">
                                {msg.references.map((ref) => (
                                  <div key={ref.id} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Tag color={ref.sourceType === 'document' ? 'blue' : 'cyan'} className="!m-0">
                                        {ref.sourceType === 'document' ? '制度文档' : '知识库'}
                                      </Tag>
                                      <Tag className="!m-0">{formatDisplayValue(ref.category)}</Tag>
                                      {ref.section ? <Tag className="!m-0 !text-xs">{ref.section}</Tag> : null}
                                    </div>
                                    <div className="mt-2 text-sm font-medium text-ink">{ref.title}</div>
                                    {ref.excerpt ? (
                                      <Typography.Paragraph className="!mb-0 !mt-1.5 !text-xs text-slate-500">
                                        {ref.excerpt}
                                      </Typography.Paragraph>
                                    ) : null}
                                    {ref.sourcePath ? (
                                      <div className="mt-1.5 text-xs text-slate-400">{ref.sourcePath}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ),
                          }]}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className={`mt-1.5 flex items-center gap-2 text-[10px] ${msg.role === 'assistant' ? 'text-slate-400' : 'justify-end text-white/50'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <Tooltip title="复制">
                        <Button
                          type="text"
                          size="small"
                          className="!h-5 !w-5 !min-w-0 !p-0 !text-[10px] !text-slate-400 hover:!text-brand"
                          icon={<CopyOutlined />}
                          onClick={() => copyMessage(msg.content)}
                        />
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
        {loading ? (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-teal-500">
              <RobotOutlined className="text-xs text-white" />
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-teal-200/60 bg-teal-50/60 px-4 py-2.5 text-sm text-brand">
              <Spin size="small" />
              正在生成回复...
            </div>
          </div>
        ) : null}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-3 px-5 py-4 border-t border-slate-100 bg-white">
        <Input.TextArea
          value={input}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          showCount
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入问题，例如：我今年还剩多少年假？"
          autoSize={{ minRows: 2, maxRows: 4 }}
          className="!rounded-xl"
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => void send()}
          disabled={!input.trim() || loading}
          className="!h-auto !rounded-xl !px-5"
          loading={loading}
        >
          发送
        </Button>
      </div>
    </Card>
  );
}
