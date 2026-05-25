import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { EmployeeServiceChatDto } from './agent.dto';
import { AgentService } from './agent.service';
import { AuthenticatedUser } from '../users/user.entity';
import { getCorsOptions, getJwtSecret } from '../config/security';
import { UsersService } from '../users/users.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { ProactiveAgentService, type ProactiveInsight } from './services/proactive-agent.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  namespace: '/agents',
  cors: getCorsOptions(),
})
export class AgentGateway implements OnGatewayConnection, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentGateway.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly authSessionService: AuthSessionService,
    private readonly proactiveAgent: ProactiveAgentService,
  ) {}

  afterInit(): void {
    this.proactiveAgent.setOnInsightGenerated((insight: ProactiveInsight) => {
      this.broadcastProactiveInsight(insight);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    await this.getUserFromSocket(client);
  }

  /** 通过 WebSocket 流式返回员工服务智能体回复。 */
  @SubscribeMessage('employee-service:message')
  async handleEmployeeServiceMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EmployeeServiceChatDto,
  ) {
    const user = await this.getUserFromSocket(client);
    const response = await this.agentService.employeeServiceChat(user, payload);
    client.emit('employee-service:reply', response);
    return response;
  }

  /** 将主动洞察广播给所有已连接的客户端。 */
  broadcastProactiveInsight(insight: ProactiveInsight): void {
    this.server.emit('proactive:insight', insight);
  }

  private async getUserFromSocket(client: Socket): Promise<AuthenticatedUser> {
    const token = client.handshake.auth.token as string | undefined;

    if (!token || token.length > 4096) {
      throw new WsException('缺少认证令牌。');
    }

    try {
      const payload = this.jwtService.verify<{ sub?: string; userId?: string; jti?: string }>(token, {
        secret: getJwtSecret(),
      });
      const userId = payload.sub ?? payload.userId ?? '';

      await this.authSessionService.assertSession(userId, payload.jti);

      const user = await this.usersService.findById(userId);

      if (!user || !user.isActive) {
        throw new WsException('当前用户未启用。');
      }

      return {
        ...(await this.usersService.buildAuthenticatedUser(user)),
        sessionId: payload.jti,
      };
    } catch {
      throw new WsException('认证令牌无效。');
    }
  }
}
