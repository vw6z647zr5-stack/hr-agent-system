import type { AgentTool } from '../services/agent-orchestrator.service';

export function createRecruitmentParseTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  parseResumeInternal: (input: Record<string, unknown>) => Promise<Record<string, unknown>>,
): AgentTool {
  return createTool(
    'resume_parse_tool',
    '将简历文本或已存储的简历记录解析为结构化候选人画像。',
    z.object({ resumeId: z.string().nullable(), resumeText: z.string().nullable() }),
    async (input) => parseResumeInternal(input),
  );
}

export function createCandidateMatchTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  matchScoreInternal: (input: Record<string, unknown>) => Promise<Record<string, unknown>>,
): AgentTool {
  return createTool(
    'candidate_match_tool',
    '评估候选人与岗位或岗位要求的匹配程度。',
    z.object({
      candidateId: z.string().nullable(),
      jobPostingId: z.string().nullable(),
      jobRequirements: z.string().nullable(),
    }),
    async (input) => matchScoreInternal(input),
  );
}

export function createInterviewEmailTool(
  createTool: (name: string, desc: string, schema: unknown, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>) => AgentTool,
  z: any,
  generateInterviewEmailInternal: (input: Record<string, unknown>) => Promise<Record<string, unknown>>,
): AgentTool {
  return createTool(
    'interview_email_tool',
    '生成面试邀约邮件草稿。',
    z.object({
      candidateId: z.string().nullable(),
      jobPostingId: z.string().nullable(),
      interviewTime: z.string(),
      interviewerName: z.string(),
    }),
    async (input) => generateInterviewEmailInternal(input),
  );
}
