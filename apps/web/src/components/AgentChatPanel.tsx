import {
  CloseCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  DollarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Collapse, Input, List, Tag, Tooltip, Typography, message } from 'antd';
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
  { text: '我今年还剩多少年假？', icon: <CalendarOutlined />, color: 'from-amber-400 to-orange-500', bg: 'bg-amber-50', textColor: 'text-amber-700' },
  { text: '加班流程怎么走？', icon: <ClockCircleOutlined />, color: 'from-violet-400 to-purple-500', bg: 'bg-violet-50', textColor: 'text-violet-700' },
  { text: '公司的办公时间和地点？', icon: <EnvironmentOutlined />, color: 'from-sky-400 to-blue-500', bg: 'bg-sky-50', textColor: 'text-sky-700' },
  { text: '试用期转正条件是什么？', icon: <IdcardOutlined />, color: 'from-emerald-400 to-green-500', bg: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { text: '如何查看我的工资单？', icon: <DollarOutlined />, color: 'from-rose-400 to-pink-500', bg: 'bg-rose-50', textColor: 'text-rose-700' },
];

function formatTimestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 animate-fade-up">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-teal-500 shadow-[0_2px_8px_rgba(15,118,110,0.25)]">
        <RobotOutlined className="text-sm text-white" />
      </div>
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-teal-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-sm text-teal-600 font-medium">AI 正在思考</span>
      </div>
    </div>
  );
}

export function AgentChatPanel({ onClose }: { onClose?: () => void }) {
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
  const [newestMsgIdx, setNewestMsgIdx] = useState<number | null>(null);

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
      setMessages((current) => {
        const next = [
          ...current,
          { role: 'assistant' as const, content: payload.reply, references: payload.references ?? [], timestamp: formatTimestamp() },
        ];
        setNewestMsgIdx(next.length - 1);
        return next;
      });
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
      chatListRef.current.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Clear newest message animation marker after animation completes
  useEffect(() => {
    if (newestMsgIdx === null) return;
    const timer = setTimeout(() => setNewestMsgIdx(null), 400);
    return () => clearTimeout(timer);
  }, [newestMsgIdx]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
      setError(`单次咨询内容不能超过 ${MAX_CHAT_MESSAGE_LENGTH} 个字符。`);
      return;
    }

    setError(null);
    setInput('');
    setMessages((current) => {
      const next = [...current, { role: 'user' as const, content: message, timestamp: formatTimestamp() }];
      setNewestMsgIdx(next.length - 1);
      return next;
    });
    setLoading(true);

    try {
      if (socket?.connected) {
        socket.emit('employee-service:message', { message });
        pendingSocketFallbackRef.current = window.setTimeout(() => {
          void (async () => {
            try {
              const response = await employeeServiceChat(message);
              setMessages((current) => {
                const next = [
                  ...current,
                  { role: 'assistant' as const, content: response.reply, references: response.references ?? [], timestamp: formatTimestamp() },
                ];
                setNewestMsgIdx(next.length - 1);
                return next;
              });
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
      setMessages((current) => {
        const next = [
          ...current,
          { role: 'assistant' as const, content: response.reply, references: response.references ?? [], timestamp: formatTimestamp() },
        ];
        setNewestMsgIdx(next.length - 1);
        return next;
      });
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
    <Card
      className="agent-chat-panel relative !rounded-3xl !border-0 !shadow-panel overflow-hidden !p-0 !h-[620px]"
      styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', padding: 0 } }}
    >
      {contextHolder}

      {/* Decorative top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand via-teal-400 to-brand-light opacity-80" />

      {/* Header */}
      <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-teal-100/20 to-transparent rounded-bl-[80px] pointer-events-none" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {/* Robot avatar with pulse ring */}
            <div className="relative">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-teal-500 shadow-[0_4px_16px_rgba(15,118,110,0.35)]">
                <RobotOutlined className="text-lg text-white" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${connectError ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                <span className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white ${connectError ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Typography.Title level={5} className="!mb-0 !text-base">
                  员工服务智能助手
                </Typography.Title>
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-200/60 bg-teal-50/60 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                  <ThunderboltOutlined className="text-[10px]" />
                  AI
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${connectError ? 'bg-amber-400' : 'bg-emerald-400'} ${connectError ? '' : 'animate-pulse'}`} />
                <Typography.Text type="secondary" className="!text-[11px]">
                  {connectError ? '离线模式 · 接口调用' : '在线 · AI 实时应答'}
                </Typography.Text>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip title="重置对话">
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                className="!text-slate-400 hover:!text-brand"
                onClick={() => {
                  setMessages([{
                    role: 'assistant',
                    content: '你好，我是员工服务智能助手。有什么可以帮你的？',
                    timestamp: formatTimestamp(),
                  }]);
                  setError(null);
                }}
              />
            </Tooltip>
            {onClose ? (
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                className="!text-slate-400 hover:!text-red-500"
                onClick={onClose}
              />
            ) : null}
          </div>
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
            className="!rounded-xl"
          />
        </div>
      ) : null}

      {/* Quick suggestions — always visible */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-brand to-teal-500">
            <ThunderboltOutlined className="text-[10px] text-white" />
          </span>
          <Typography.Text type="secondary" className="!text-xs !font-medium">
            快速提问
          </Typography.Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.text}
              type="button"
              className="group flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-left text-[13px] text-slate-600 shadow-sm transition-all duration-200 hover:border-brand/30 hover:text-brand hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => send(suggestion.text)}
              disabled={loading}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br ${suggestion.color} shadow-[0_1px_4px_rgba(0,0,0,0.1)]`}>
                <span className="text-xs text-white">{suggestion.icon}</span>
              </span>
              <span className="font-medium">{suggestion.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatListRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
        style={{ background: 'linear-gradient(180deg, #fafcfd 0%, #f8fafb 50%, #fcfdfe 100%)' }}
      >
        <List
          dataSource={messages}
          split={false}
          renderItem={(msg, idx) => {
            const isNewest = idx === newestMsgIdx;
            const isAssistant = msg.role === 'assistant';
            return (
              <List.Item className={`!mb-3.5 !px-0 ${isNewest ? 'animate-fade-up' : ''}`}>
                <div className={`flex gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
                  {/* Avatar */}
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      isAssistant
                        ? 'bg-gradient-to-br from-brand to-teal-500 shadow-[0_2px_8px_rgba(15,118,110,0.25)]'
                        : 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-[0_2px_8px_rgba(100,116,139,0.25)]'
                    }`}
                  >
                    {isAssistant ? (
                      <RobotOutlined className="text-sm text-white" />
                    ) : (
                      <span className="text-xs text-white font-bold">我</span>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[82%] ${isAssistant ? '' : 'flex flex-col items-end'}`}>
                    <div
                      className={`rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${
                        isAssistant
                          ? 'rounded-tl-md border border-slate-200/80 bg-white text-ink shadow-sm'
                          : 'rounded-tr-md bg-gradient-to-br from-brand to-teal-600 text-white shadow-[0_4px_14px_rgba(15,118,110,0.3)]'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {isAssistant && msg.references?.length ? (
                        <div className="mt-3 rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50 to-white p-0.5">
                          <Collapse
                            ghost
                            expandIconPosition="end"
                            className="!bg-transparent"
                            items={[{
                              key: 'refs',
                              label: (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                  <span className="inline-block h-1 w-1 rounded-full bg-brand" />
                                  参考来源 ({msg.references.length})
                                </span>
                              ),
                              children: (
                                <div className="space-y-2 pt-1">
                                  {msg.references.map((ref) => (
                                    <div key={ref.id} className="rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Tag color={ref.sourceType === 'document' ? 'blue' : 'cyan'} className="!m-0 !text-[10px] !leading-tight">
                                          {ref.sourceType === 'document' ? '制度文档' : '知识库'}
                                        </Tag>
                                        <Tag className="!m-0 !text-[10px] !leading-tight">{formatDisplayValue(ref.category)}</Tag>
                                        {ref.section ? (
                                          <Tag className="!m-0 !text-[10px] !leading-tight">{ref.section}</Tag>
                                        ) : null}
                                      </div>
                                      <div className="mt-1.5 text-sm font-semibold text-ink">{ref.title}</div>
                                      {ref.excerpt ? (
                                        <Typography.Paragraph className="!mb-0 !mt-1 !text-xs text-slate-500 leading-relaxed">
                                          {ref.excerpt}
                                        </Typography.Paragraph>
                                      ) : null}
                                      {ref.sourcePath ? (
                                        <div className="mt-1 text-[10px] text-slate-400 font-mono">{ref.sourcePath}</div>
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

                    {/* Meta row */}
                    <div className={`mt-1.5 flex items-center gap-2 text-[11px] ${isAssistant ? 'text-slate-400' : 'justify-end text-white/50'}`}>
                      <span>{msg.timestamp}</span>
                      {isAssistant && (
                        <Tooltip title="复制">
                          <Button
                            type="text"
                            size="small"
                            className="!h-5 !w-5 !min-w-0 !p-0 !text-[10px] !text-slate-400 hover:!text-brand transition-colors"
                            icon={<CopyOutlined />}
                            onClick={() => copyMessage(msg.content)}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />

        {loading ? <TypingIndicator /> : null}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-3 px-5 py-4 border-t border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="flex-1 relative">
          <Input.TextArea
            value={input}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            showCount
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入问题，例如：我今年还剩多少年假？"
            autoSize={{ minRows: 2, maxRows: 4 }}
            className="!rounded-xl !border-slate-200 hover:!border-brand/40 focus:!border-brand focus:!shadow-[0_0_0_3px_rgba(15,118,110,0.1)] !transition-all"
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </div>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => void send()}
          disabled={!input.trim() || loading}
          className="!h-auto !rounded-xl !px-5 !bg-gradient-to-br !from-brand !to-teal-600 !border-0 !shadow-[0_4px_12px_rgba(15,118,110,0.3)] hover:!shadow-[0_6px_18px_rgba(15,118,110,0.4)] hover:!from-brand hover:!to-teal-600 disabled:!opacity-40 disabled:!shadow-none !transition-all"
          loading={loading}
        >
          发送
        </Button>
      </div>
    </Card>
  );
}
