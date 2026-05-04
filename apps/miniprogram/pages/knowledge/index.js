const { ensureLogin, showError } = require('../../utils/api');
const { chatWithEmployeeService } = require('../../utils/services');

Page({
  data: {
    message: '',
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: '你好，我可以帮你查询人事制度、工资单、合同、请假和办公福利。',
        references: [],
      },
    ],
    lastMessageId: 'welcome',
    sending: false,
  },

  onShow() {
    ensureLogin();
  },

  onMessageInput(event) {
    this.setData({ message: event.detail.value });
  },

  useQuestion(event) {
    this.setData({ message: event.currentTarget.dataset.question });
  },

  async sendMessage() {
    const content = this.data.message.trim();
    if (!content || this.data.sending) {
      return;
    }

    const userMessage = {
      id: `message-${Date.now()}-user`,
      role: 'user',
      content,
      references: [],
    };
    this.setData({
      messages: [...this.data.messages, userMessage],
      message: '',
      sending: true,
      lastMessageId: userMessage.id,
    });

    try {
      const reply = await chatWithEmployeeService(content);
      const assistantMessage = {
        id: `message-${Date.now()}-assistant`,
        role: 'assistant',
        content: reply.reply || '暂未找到明确答案。',
        references: reply.references || [],
      };
      this.setData({
        messages: [...this.data.messages, assistantMessage],
        lastMessageId: assistantMessage.id,
      });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ sending: false });
    }
  },
});
