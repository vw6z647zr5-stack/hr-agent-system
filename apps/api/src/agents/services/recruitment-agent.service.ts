import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity, JobPostingEntity, ResumeEntity } from '../../recruitment/recruitment.entities';
import { GenerateInterviewEmailDto, MatchScoreAgentDto, ParseResumeAgentDto } from '../agent.dto';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { createRecruitmentParseTool, createCandidateMatchTool, createInterviewEmailTool } from '../tools/recruitment.tools';

@Injectable()
export class RecruitmentAgentService {
  constructor(
    @InjectRepository(ResumeEntity)
    private readonly resumesRepository: Repository<ResumeEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidatesRepository: Repository<CandidateEntity>,
    @InjectRepository(JobPostingEntity)
    private readonly jobPostingsRepository: Repository<JobPostingEntity>,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  async parseResume(payload: ParseResumeAgentDto) {
    const parsed = await this.parseResumeInternal(payload);
    const summary = await this.orchestrator.runAgentOrFallback({
      systemPrompt: '你是招聘助手，请用简洁专业的中文总结简历解析结果，突出亮点与潜在风险，供人力资源初筛使用。',
      input: `简历解析结果：${JSON.stringify(parsed)}`,
      tools: [createRecruitmentParseTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.parseResumeInternal.bind(this))],
      fallback: async () =>
        `候选人 ${parsed.name || '未识别姓名'} 已解析，识别到 ${Array.isArray(parsed.skills) ? parsed.skills.length : 0} 项关键技能。`,
    });
    return { parsedProfile: parsed, summary };
  }

  async matchScore(payload: MatchScoreAgentDto) {
    const score = await this.matchScoreInternal(payload);
    const summary = await this.orchestrator.runAgentOrFallback({
      systemPrompt:
        `你是招聘助手，请用简洁专业的中文解释候选人与岗位的匹配情况。重要：匹配评分已由系统精确计算为 ${score.score} 分，你必须直接引用此分数，不得自行估算或修改。请说明主要依据（技能重合、经验匹配等）与建议动作。`,
      input: `候选人与岗位匹配评分详情：${JSON.stringify(score)}。请在你的回复中明确引用匹配分=${score.score}。`,
      tools: [createCandidateMatchTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, this.matchScoreInternal.bind(this))],
      fallback: async () =>
        `匹配度 ${score.score} 分。技能重合 ${score.matchedSkills.join('、') || '较少'}（命中 ${score.matchedSkills.length} 项，缺失 ${score.missingSkills.length} 项），建议 ${score.score >= 75 ? '进入下一轮面试' : '继续人工复核'}。`,
    });

    if (payload.candidateId) {
      await this.candidatesRepository.update(payload.candidateId, { aiMatchScore: score.score });
    }

    return { ...score, summary };
  }

  async generateInterviewEmail(payload: GenerateInterviewEmailDto) {
    const email = await this.generateInterviewEmailInternal(payload);
    const summary = await this.orchestrator.runAgentOrFallback({
      systemPrompt: '你是招聘助手，请用中文润色面试邀约邮件，保持专业、礼貌且简洁。',
      input: `面试邀约邮件草稿：${JSON.stringify(email)}`,
      tools: [createInterviewEmailTool(this.orchestrator.createTool.bind(this.orchestrator), this.orchestrator.zod, async (input) => this.generateInterviewEmailInternal(input as unknown as GenerateInterviewEmailDto))],
      fallback: async () => '面试邀约邮件草稿已生成，可直接交给人力资源审核后发送。',
    });
    return { ...email, summary };
  }

  async recalculateAndPersistScore(candidateId: string): Promise<number> {
    const result = await this.matchScoreInternal({ candidateId });
    await this.candidatesRepository.update(candidateId, { aiMatchScore: result.score });
    return result.score;
  }

  async recalculateAllScores(): Promise<{ candidateId: string; name: string; score: number }[]> {
    const candidates = await this.candidatesRepository.find({ relations: { appliedJobPosting: true } });
    const results: { candidateId: string; name: string; score: number }[] = [];
    for (const c of candidates) {
      try {
        const result = await this.matchScoreInternal({ candidateId: c.id });
        await this.candidatesRepository.update(c.id, { aiMatchScore: result.score });
        results.push({ candidateId: c.id, name: c.fullName, score: result.score });
      } catch {
        results.push({ candidateId: c.id, name: c.fullName, score: -1 });
      }
    }
    return results;
  }

  // --- 私有内部方法 ---

  private async parseResumeInternal(payload: ParseResumeAgentDto) {
    if (!payload.resumeId && !payload.resumeText) {
      throw new NotFoundException('必须提供简历编号或简历文本。');
    }
    const resumeText = payload.resumeId
      ? (await this.resumesRepository.findOne({ where: { id: payload.resumeId } }))?.parsedText ?? ''
      : payload.resumeText ?? '';
    if (!resumeText) throw new NotFoundException('未找到简历文本。');

    const email = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
    const phone = resumeText.match(/(?:\+?\d{1,3}[- ]?)?(?:\d[- ]?){7,14}\d/)?.[0] ?? '';
    const skills = ['Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'React', 'TypeScript', 'LangChain', 'OpenAI']
      .filter((skill) => resumeText.toLowerCase().includes(skill.toLowerCase()));

    return {
      name: resumeText.split(/\r?\n/).find(Boolean)?.trim() ?? '',
      email, phone, skills,
      summary: resumeText.slice(0, 300),
    };
  }

  private async matchScoreInternal(payload: MatchScoreAgentDto) {
    const candidate = payload.candidateId
      ? await this.candidatesRepository.findOne({ where: { id: payload.candidateId }, relations: { appliedJobPosting: true } })
      : null;
    const jobPosting = payload.jobPostingId
      ? await this.jobPostingsRepository.findOne({
          where: { id: payload.jobPostingId },
          relations: { department: true, position: true },
        })
      : null;

    const latestResume = candidate
      ? await this.resumesRepository.findOne({
          where: { candidateId: candidate.id },
          order: { uploadedAt: 'DESC', createdAt: 'DESC' },
        })
      : null;
    const resumeText = `${latestResume?.parsedText ?? ''} ${JSON.stringify(latestResume?.parsedProfile ?? {})}`;
    const candidateText = [candidate?.fullName, candidate?.currentCompany, candidate?.notes, candidate?.skills?.join(' '), resumeText].filter(Boolean).join(' ');
    const jobText = [jobPosting?.title, payload.jobRequirements, jobPosting?.description, jobPosting?.requirements, jobPosting?.department?.name, jobPosting?.position?.name, jobPosting?.position?.level].filter(Boolean).join(' ');

    const candidateTokens = this.orchestrator.extractMatchTokens(candidateText);
    const jobTokens = this.orchestrator.extractMatchTokens(jobText);

    const exactMatched = jobTokens.filter((token) => candidateTokens.includes(token));
    const exactMissing = jobTokens.filter((token) => !candidateTokens.includes(token));

    const partialMatched: string[] = [];
    for (const jt of exactMissing) {
      for (const ct of candidateTokens) {
        if (jt.includes(ct) || ct.includes(jt)) { partialMatched.push(jt); break; }
      }
    }

    const score = this.orchestrator.computeMatchScore({
      candidateTokens, jobTokens,
      yearsOfExperience: Number(candidate?.yearsOfExperience ?? 0),
      hasResume: !!latestResume,
      stage: candidate?.stage ?? 'new',
      parsedProfile: latestResume?.parsedProfile ?? null,
    });

    return {
      score,
      matchedSkills: [...new Set([...exactMatched, ...partialMatched])].slice(0, 12),
      missingSkills: exactMissing.filter((t) => !partialMatched.includes(t)).slice(0, 8),
      candidate: candidate?.fullName ?? '未知候选人',
      jobTitle: jobPosting?.title ?? '自定义岗位',
    };
  }

  private async generateInterviewEmailInternal(payload: GenerateInterviewEmailDto) {
    const candidate = payload.candidateId
      ? await this.candidatesRepository.findOne({ where: { id: payload.candidateId } })
      : null;
    const jobPosting = payload.jobPostingId
      ? await this.jobPostingsRepository.findOne({ where: { id: payload.jobPostingId } })
      : null;

    const candidateName = candidate?.fullName ?? '候选人';
    const jobTitle = jobPosting?.title ?? '当前招聘岗位';
    const interviewTime = new Date(payload.interviewTime).toLocaleString('zh-CN', { hour12: false });

    return {
      subject: `面试邀约｜${jobTitle}`,
      body: `${candidateName}，您好：\n\n感谢您关注 ${jobTitle} 岗位。现邀请您于 ${interviewTime} 参加面试，面试官为 ${payload.interviewerName}。\n\n如时间安排无误，请回复确认；如需调整，也请及时告知。\n\n此致\n敬礼\n人力资源团队`,
    };
  }
}
