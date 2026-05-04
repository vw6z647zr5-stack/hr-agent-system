import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { Brackets, Repository } from 'typeorm';
import { KnowledgeBaseArticleEntity } from '../agents/agent-support.entities';
import { AgentService } from '../agents/agent.service';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { paginateQuery } from '../common/utils/pagination';
import { normalizeExtractedText, repairTextEncoding } from '../common/utils/text-encoding';
import { StorageService } from '../storage/storage.service';
import {
  CandidatePortalApplicationDto,
  CreateCandidateDto,
  CreateInterviewDto,
  CreateJobPostingDto,
  CreateOfferDto,
  CreateResumeDto,
  UpdateCandidateDto,
  UpdateInterviewDto,
  UpdateJobPostingDto,
  UpdateOfferDto,
  UpdateResumeDto,
} from './recruitment.dto';
import {
  CandidateEntity,
  InterviewEntity,
  JobPostingEntity,
  OfferEntity,
  ResumeEntity,
} from './recruitment.entities';
import { AuthenticatedUser, Role } from '../users/user.entity';

type HiringAlertLevel = 'high' | 'medium' | 'low';

@Injectable()
export class RecruitmentService {
  constructor(
    @InjectRepository(JobPostingEntity)
    private readonly jobPostingsRepository: Repository<JobPostingEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidatesRepository: Repository<CandidateEntity>,
    @InjectRepository(ResumeEntity)
    private readonly resumesRepository: Repository<ResumeEntity>,
    @InjectRepository(InterviewEntity)
    private readonly interviewsRepository: Repository<InterviewEntity>,
    @InjectRepository(OfferEntity)
    private readonly offersRepository: Repository<OfferEntity>,
    @InjectRepository(KnowledgeBaseArticleEntity)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBaseArticleEntity>,
    private readonly storageService: StorageService,
    private readonly agentService: AgentService,
  ) {}

  async getRecruitmentDashboard() {
    const [jobPostings, candidates, resumes, interviews, offers] = await Promise.all([
      this.jobPostingsRepository.find({
        relations: { department: true, position: true },
        order: { createdAt: 'DESC' },
      }),
      this.candidatesRepository.find({
        relations: { appliedJobPosting: true },
        order: { createdAt: 'DESC' },
      }),
      this.resumesRepository.find({
        relations: { candidate: true },
        order: { uploadedAt: 'DESC', createdAt: 'DESC' },
      }),
      this.interviewsRepository.find({
        relations: { candidate: true, jobPosting: true, interviewer: true },
        order: { scheduledAt: 'ASC' },
      }),
      this.offersRepository.find({
        relations: { candidate: true, jobPosting: true, approver: true },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const now = new Date();
    const stageOrder = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];
    const resumeMap = this.groupByLatest(resumes, (resume) => resume.candidateId, (resume) =>
      new Date(resume.uploadedAt).getTime(),
    );
    const interviewsByCandidate = this.groupByArray(interviews, (interview) => interview.candidateId);
    const offersByCandidate = this.groupByArray(offers, (offer) => offer.candidateId);
    const activeCandidates = candidates.filter((candidate) => candidate.status === 'active');
    const openJobPostings = jobPostings.filter((jobPosting) => jobPosting.status === 'open');
    const upcomingInterviews = interviews
      .filter((interview) => interview.status === 'scheduled' && new Date(interview.scheduledAt) >= now)
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());
    const pendingOffers = offers.filter((offer) => ['draft', 'sent'].includes(offer.status));
    const resumeCoverage = activeCandidates.length
      ? (activeCandidates.filter((candidate) => resumeMap.has(candidate.id)).length / activeCandidates.length) * 100
      : 0;
    const averageAiMatchScore = this.average(
      activeCandidates.map((candidate) => this.toNumber(candidate.aiMatchScore)).filter((score) => score > 0),
    );

    const stageCountsMap = this.countBy(candidates, (candidate) => candidate.stage || 'unknown');
    const sourceCountsMap = this.countBy(activeCandidates, (candidate) => candidate.source || 'unknown');

    const openJobHealth = openJobPostings
      .map((jobPosting) => {
        const jobCandidates = candidates.filter((candidate) => candidate.appliedJobPostingId === jobPosting.id);
        const activeJobCandidates = jobCandidates.filter((candidate) => candidate.status === 'active');
        const jobInterviews = interviews.filter((interview) => interview.jobPostingId === jobPosting.id);
        const jobOffers = offers.filter((offer) => offer.jobPostingId === jobPosting.id);
        const acceptedOffers = jobOffers.filter((offer) => offer.status === 'accepted').length;
        const progressPercent = jobPosting.targetCount
          ? Math.min(Math.round((acceptedOffers / jobPosting.targetCount) * 100), 100)
          : 0;
        const averageMatch = this.average(
          activeJobCandidates.map((candidate) => this.toNumber(candidate.aiMatchScore)).filter((score) => score > 0),
        );
        const daysOpen = jobPosting.publishedAt ? this.daysFrom(jobPosting.publishedAt, now) : null;

        return {
          id: jobPosting.id,
          title: jobPosting.title,
          departmentName: jobPosting.department?.name ?? null,
          positionName: jobPosting.position?.name ?? null,
          location: jobPosting.location,
          employmentType: jobPosting.employmentType,
          status: jobPosting.status,
          targetCount: jobPosting.targetCount,
          candidateCount: activeJobCandidates.length,
          interviewCount: jobInterviews.length,
          offerCount: jobOffers.length,
          acceptedOffers,
          progressPercent,
          averageMatchScore: Number(averageMatch.toFixed(2)),
          daysOpen,
          latestInterviewAt: jobInterviews
            .slice()
            .sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime())[0]
            ?.scheduledAt ?? null,
          urgencyLevel: this.getJobUrgencyLevel({
            targetCount: jobPosting.targetCount,
            candidateCount: activeJobCandidates.length,
            acceptedOffers,
            daysOpen,
            interviewCount: jobInterviews.length,
          }),
        };
      })
      .sort((left, right) => {
        const urgencyWeight = { high: 3, medium: 2, low: 1 };
        const byUrgency = urgencyWeight[right.urgencyLevel] - urgencyWeight[left.urgencyLevel];
        return byUrgency || (right.daysOpen ?? 0) - (left.daysOpen ?? 0);
      });

    const priorityCandidates = activeCandidates
      .map((candidate) => {
        const latestResume = resumeMap.get(candidate.id) ?? null;
        const candidateInterviews = (interviewsByCandidate.get(candidate.id) ?? [])
          .slice()
          .sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime());
        const futureInterview = candidateInterviews
          .filter((interview) => interview.status === 'scheduled' && new Date(interview.scheduledAt) >= now)
          .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())[0] ?? null;
        const latestInterview = candidateInterviews[0] ?? null;
        const latestOffer = (offersByCandidate.get(candidate.id) ?? [])
          .slice()
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;

        return {
          id: candidate.id,
          fullName: candidate.fullName,
          jobTitle: candidate.appliedJobPosting?.title ?? null,
          stage: candidate.stage,
          source: candidate.source,
          status: candidate.status,
          currentCompany: candidate.currentCompany,
          yearsOfExperience: this.toNumber(candidate.yearsOfExperience),
          aiMatchScore: this.toNumber(candidate.aiMatchScore),
          hasResume: Boolean(latestResume),
          resumeUpdatedAt: latestResume?.uploadedAt ?? null,
          skills: candidate.skills.slice(0, 6),
          latestInterviewStatus: latestInterview?.status ?? null,
          upcomingInterviewAt: futureInterview?.scheduledAt ?? null,
          latestOfferStatus: latestOffer?.status ?? null,
          nextAction: this.getCandidateNextAction(candidate, {
            latestResume,
            futureInterview,
            latestInterview,
            latestOffer,
          }),
        };
      })
      .sort((left, right) => {
        const byScore = right.aiMatchScore - left.aiMatchScore;
        if (byScore !== 0) {
          return byScore;
        }

        if (left.upcomingInterviewAt && right.upcomingInterviewAt) {
          return new Date(left.upcomingInterviewAt).getTime() - new Date(right.upcomingInterviewAt).getTime();
        }

        return Number(right.hasResume) - Number(left.hasResume);
      })
      .slice(0, 10);

    const latestResumeActivity = resumes.slice(0, 8).map((resume) => ({
      id: resume.id,
      candidateId: resume.candidateId,
      candidateName: resume.candidate?.fullName ?? null,
      jobTitle: candidates.find((candidate) => candidate.id === resume.candidateId)?.appliedJobPosting?.title ?? null,
      fileName: resume.fileName,
      uploadedAt: resume.uploadedAt,
      parsedSkills: Array.isArray(resume.parsedProfile.skills) ? (resume.parsedProfile.skills as string[]) : [],
      summary:
        typeof resume.parsedProfile.summary === 'string' && resume.parsedProfile.summary.trim()
          ? resume.parsedProfile.summary
          : resume.parsedText.slice(0, 120),
    }));

    const hiringAlerts = this.buildHiringAlerts({
      now,
      openJobHealth,
      interviews,
      offers,
      activeCandidates,
    });

    return {
      stats: {
        openJobPostings: openJobPostings.length,
        activeCandidates: activeCandidates.length,
        interviewsThisWeek: upcomingInterviews.filter((interview) => this.daysBetween(now, interview.scheduledAt) <= 7).length,
        pendingOffers: pendingOffers.length,
        acceptedOffers: offers.filter((offer) => offer.status === 'accepted').length,
        resumeCoverage: Number(resumeCoverage.toFixed(1)),
        averageAiMatchScore: Number(averageAiMatchScore.toFixed(2)),
      },
      funnel: stageOrder
        .map((stage) => ({
          stage,
          label: this.getStageLabel(stage),
          count: stageCountsMap.get(stage) ?? 0,
        }))
        .filter((item) => item.count > 0),
      sourceBreakdown: Array.from(sourceCountsMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((left, right) => right.count - left.count),
      openJobHealth,
      priorityCandidates,
      upcomingInterviews: upcomingInterviews.slice(0, 8).map((interview) => ({
        id: interview.id,
        candidateName: interview.candidate?.fullName ?? null,
        jobTitle: interview.jobPosting?.title ?? null,
        interviewerName: interview.interviewer?.fullName ?? null,
        scheduledAt: interview.scheduledAt,
        interviewType: interview.interviewType,
        status: interview.status,
      })),
      offerTracker: offers.slice(0, 8).map((offer) => ({
        id: offer.id,
        candidateName: offer.candidate?.fullName ?? null,
        jobTitle: offer.jobPosting?.title ?? null,
        salaryOffered: this.toNumber(offer.salaryOffered),
        status: offer.status,
        offeredAt: offer.offeredAt,
        acceptedAt: offer.acceptedAt,
        approverName: offer.approver?.fullName ?? null,
        ageDays: this.daysFrom(offer.createdAt, now),
      })),
      latestResumeActivity,
      hiringAlerts,
    };
  }

  async listJobPostings(query: ListQueryDto) {
    const builder = this.jobPostingsRepository
      .createQueryBuilder('jobPosting')
      .leftJoinAndSelect('jobPosting.department', 'department')
      .leftJoinAndSelect('jobPosting.position', 'position')
      .orderBy('jobPosting.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('jobPosting.title ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'jobPosting.location ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.status) {
      builder.andWhere('jobPosting.status = :status', { status: query.status });
    }

    if (query.departmentId) {
      builder.andWhere('jobPosting.departmentId = :departmentId', { departmentId: query.departmentId });
    }

    return paginateQuery(builder, query);
  }

  async listPublicJobPostings(query: ListQueryDto) {
    const result = await this.listJobPostings({
      ...query,
      status: 'open',
    });

    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        employmentType: item.employmentType,
        location: item.location,
        description: item.description,
        requirements: item.requirements,
        targetCount: item.targetCount,
        publishedAt: item.publishedAt,
        department: item.department
          ? {
              name: item.department.name,
              code: item.department.code,
            }
          : null,
        position: item.position
          ? {
              name: item.position.name,
              code: item.position.code,
              level: item.position.level,
            }
          : null,
      })),
    };
  }

  async getJobPosting(id: string) {
    const entity = await this.jobPostingsRepository.findOne({
      where: { id },
      relations: { department: true, position: true },
    });

    if (!entity) {
      throw new NotFoundException('未找到职位发布记录。');
    }

    return entity;
  }

  async getCandidatePortalProfile(user: AuthenticatedUser) {
    if (user.role !== Role.CANDIDATE) {
      throw new BadRequestException('当前账号不是候选人账号。');
    }

    const candidate = await this.candidatesRepository.findOne({
      where: { email: user.email },
      relations: { appliedJobPosting: true },
    });

    if (!candidate) {
      throw new NotFoundException('未找到候选人档案。');
    }

    const resumes = await this.resumesRepository.find({
      where: { candidateId: candidate.id },
      order: { uploadedAt: 'DESC', createdAt: 'DESC' },
    });

    await Promise.all(
      resumes
        .map((item) => item.filePath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.ensureResumeFile(item)),
    );

    const interviews = await this.interviewsRepository.find({
      where: { candidateId: candidate.id },
      relations: { interviewer: true, jobPosting: true },
      order: { scheduledAt: 'DESC' },
    });

    const offers = await this.offersRepository.find({
      where: { candidateId: candidate.id },
      relations: { jobPosting: true, approver: true },
      order: { createdAt: 'DESC' },
    });

    return {
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        stage: candidate.stage,
        status: candidate.status,
        source: candidate.source,
        currentCompany: candidate.currentCompany,
        yearsOfExperience: this.toNumber(candidate.yearsOfExperience),
        skills: candidate.skills,
        aiMatchScore: this.toNumber(candidate.aiMatchScore),
        appliedJobPosting: candidate.appliedJobPosting
          ? {
              id: candidate.appliedJobPosting.id,
              title: candidate.appliedJobPosting.title,
              location: candidate.appliedJobPosting.location,
              employmentType: candidate.appliedJobPosting.employmentType,
              status: candidate.appliedJobPosting.status,
            }
          : null,
      },
      resumes: resumes.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        filePath: item.filePath,
        uploadedAt: item.uploadedAt,
        parsedProfile: item.parsedProfile,
      })),
      interviews: interviews.map((item) => ({
        id: item.id,
        scheduledAt: item.scheduledAt,
        interviewType: item.interviewType,
        status: item.status,
        score: this.toNumber(item.score),
        feedback: item.feedback,
        interviewerName: item.interviewer?.fullName ?? null,
        jobTitle: item.jobPosting?.title ?? null,
      })),
      offers: offers.map((item) => ({
        id: item.id,
        status: item.status,
        salaryOffered: this.toNumber(item.salaryOffered),
        offeredAt: item.offeredAt,
        acceptedAt: item.acceptedAt,
        notes: item.notes,
        jobTitle: item.jobPosting?.title ?? null,
        approverName: item.approver?.fullName ?? null,
      })),
      jobMatches: await this.buildCandidateJobMatches(candidate.id),
    };
  }

  async uploadCandidatePortalResume(user: AuthenticatedUser, file: Express.Multer.File) {
    const candidate = await this.getCandidateForPortal(user);
    const resume = await this.uploadResume(candidate.id, file);
    const analysis = await this.analyzeResume(resume.id);
    const analyzedResume = this.resumesRepository.create({
      ...resume,
      parsedProfile: (analysis.parsedProfile as Record<string, unknown>) ?? resume.parsedProfile,
    });
    const jobMatches = await this.buildCandidateJobMatches(candidate.id, analyzedResume);

    const topMatch = jobMatches[0];
    if (topMatch) {
      await this.candidatesRepository.update(candidate.id, {
        appliedJobPostingId: topMatch.id,
        aiMatchScore: topMatch.matchScore,
      });
    }

    return {
      resume: {
        id: resume.id,
        fileName: resume.fileName,
        filePath: resume.filePath,
        uploadedAt: resume.uploadedAt,
        parsedText: resume.parsedText,
        parsedProfile: analyzedResume.parsedProfile,
      },
      analysis,
      jobMatches,
    };
  }

  async getCandidatePortalJobMatches(user: AuthenticatedUser) {
    const candidate = await this.getCandidateForPortal(user);
    return this.buildCandidateJobMatches(candidate.id);
  }

  async applyCandidatePortalJob(user: AuthenticatedUser, jobPostingId: string) {
    const [candidate, jobPosting] = await Promise.all([
      this.getCandidateForPortal(user),
      this.jobPostingsRepository.findOne({ where: { id: jobPostingId } }),
    ]);

    if (!jobPosting || jobPosting.status !== 'open') {
      throw new NotFoundException('未找到开放中的职位。');
    }

    await this.candidatesRepository.update(candidate.id, {
      appliedJobPostingId: jobPosting.id,
      stage: candidate.stage || 'new',
      status: 'active',
    });

    return {
      success: true,
      jobPosting: {
        id: jobPosting.id,
        title: jobPosting.title,
        location: jobPosting.location,
        employmentType: jobPosting.employmentType,
      },
    };
  }

  async candidatePortalChat(user: AuthenticatedUser, message: string) {
    const candidate = await this.getCandidateForPortal(user);
    const question = message.trim();

    if (!question) {
      throw new BadRequestException('请输入要咨询的问题。');
    }

    const [resumes, jobMatches, articles] = await Promise.all([
      this.getCandidateResumes(candidate.id),
      this.buildCandidateJobMatches(candidate.id),
      this.searchCandidateKnowledge(question),
    ]);
    const latestResume = resumes[0] ?? null;
    const relevantJobs = jobMatches.slice(0, 4);
    let reply = '';

    if (/(匹配|适合|推荐|岗位|职位|投递|申请|match|job)/i.test(question)) {
      const top = relevantJobs[0];
      reply = top
        ? `按你当前简历来看，优先推荐「${top.title}」，适配度 ${top.matchScore} 分。主要匹配点包括 ${top.matchedKeywords.slice(0, 5).join('、') || '岗位经历和通用能力'}。${top.analysis}`
        : '目前没有开放职位可供匹配。你可以先上传或更新简历，我会再按岗位要求重新排序。';
    } else if (/(简历|resume|cv|技能|经历)/i.test(question)) {
      const skills = this.extractResumeSkills(latestResume).slice(0, 8);
      reply = latestResume
        ? `我已读取你最近上传的「${latestResume.fileName}」。当前识别到的技能包括 ${skills.join('、') || '暂未识别到明确技能'}。建议围绕目标岗位要求补充项目成果、量化指标和使用过的工具栈。`
        : '你还没有上传简历。请先上传 PDF 或 DOCX 简历，我会解析内容并给出职位排序和优化建议。';
    } else if (articles.length > 0) {
      const first = articles[0]!;
      reply = `根据人力资源知识库「${first.title}」：${first.answer.slice(0, 220)}${first.answer.length > 220 ? '...' : ''}`;
    } else {
      const top = relevantJobs[0];
      reply = top
        ? `我可以基于你的简历和当前开放职位回答。当前最相关职位是「${top.title}」，适配度 ${top.matchScore} 分。你也可以继续问我该岗位职责、要求、简历优化或投递建议。`
        : '我可以回答人力资源政策、招聘流程、岗位要求和简历优化相关问题。当前没有可匹配的开放职位，请稍后再查看职位列表。';
    }

    return {
      reply,
      references: [
        ...relevantJobs.map((job) => ({
          id: job.id,
          title: job.title,
          category: 'job_posting',
          sourceType: 'job_posting',
          excerpt: job.requirements.slice(0, 180),
        })),
        ...articles.map((article) => ({
          id: article.id,
          title: article.title,
          category: article.category,
          sourceType: 'knowledge_base',
          excerpt: article.answer.slice(0, 180),
        })),
      ],
    };
  }

  async applyForJob(payload: CandidatePortalApplicationDto, file?: Express.Multer.File) {
    const jobPosting = await this.jobPostingsRepository.findOne({
      where: { id: payload.jobPostingId },
      relations: { department: true, position: true },
    });

    if (!jobPosting || jobPosting.status !== 'open') {
      throw new NotFoundException('未找到开放中的岗位。');
    }

    if (!file) {
      throw new BadRequestException('请先上传简历文件。');
    }

    const existingCandidate = await this.candidatesRepository.findOne({
      where: { email: payload.email },
    });

    const candidate = existingCandidate
      ? await this.candidatesRepository.save(
          this.candidatesRepository.create({
            ...existingCandidate,
            appliedJobPostingId: payload.jobPostingId,
            fullName: payload.fullName,
            phone: payload.phone,
            source: existingCandidate.source || 'career_portal',
            stage: existingCandidate.stage || 'new',
            status: 'active',
            currentCompany: payload.currentCompany ?? existingCandidate.currentCompany,
            yearsOfExperience: payload.yearsOfExperience ?? this.toNumber(existingCandidate.yearsOfExperience),
            skills: payload.skills ?? existingCandidate.skills,
            notes: payload.notes || existingCandidate.notes,
          }),
        )
      : await this.candidatesRepository.save(
          this.candidatesRepository.create({
            appliedJobPostingId: payload.jobPostingId,
            fullName: payload.fullName,
            email: payload.email,
            phone: payload.phone,
            source: 'career_portal',
            stage: 'new',
            status: 'active',
            currentCompany: payload.currentCompany ?? '',
            yearsOfExperience: payload.yearsOfExperience ?? 0,
            skills: payload.skills ?? [],
            aiMatchScore: 0,
            notes: payload.notes ?? '',
          }),
        );

    const resume = await this.uploadResume(candidate.id, file);

    return {
      candidate,
      resume,
      jobPosting: {
        id: jobPosting.id,
        title: jobPosting.title,
        location: jobPosting.location,
        employmentType: jobPosting.employmentType,
      },
    };
  }

  createJobPosting(dto: CreateJobPostingDto) {
    return this.jobPostingsRepository.save(this.jobPostingsRepository.create(dto));
  }

  async updateJobPosting(id: string, dto: UpdateJobPostingDto) {
    const entity = await this.jobPostingsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到职位发布记录。');
    }

    return this.jobPostingsRepository.save(entity);
  }

  async removeJobPosting(id: string) {
    await this.getJobPosting(id);
    await this.jobPostingsRepository.delete(id);
    return { success: true };
  }

  async listCandidates(query: ListQueryDto) {
    const builder = this.candidatesRepository
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.appliedJobPosting', 'jobPosting')
      .orderBy('candidate.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('candidate.fullName ILIKE :search', { search: `%${query.search}%` })
            .orWhere('candidate.email ILIKE :search', { search: `%${query.search}%` })
            .orWhere('candidate.phone ILIKE :search', { search: `%${query.search}%` });
        }),
      );
    }

    if (query.status) {
      builder.andWhere('candidate.status = :status', { status: query.status });
    }

    if (query.stage) {
      builder.andWhere('candidate.stage = :stage', { stage: query.stage });
    }

    return paginateQuery(builder, query);
  }

  async getCandidate(id: string) {
    const entity = await this.candidatesRepository.findOne({
      where: { id },
      relations: { appliedJobPosting: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到候选人。');
    }

    return entity;
  }

  async createCandidate(dto: CreateCandidateDto) {
    const saved = await this.candidatesRepository.save(this.candidatesRepository.create(dto));
    if (saved.appliedJobPostingId) {
      await this.agentService.recalculateAndPersistScore(saved.id).catch(() => {});
    }
    return saved;
  }

  async updateCandidate(id: string, dto: UpdateCandidateDto) {
    const entity = await this.candidatesRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到候选人。');
    }

    const saved = await this.candidatesRepository.save(entity);
    // 关键字段变化后重新计算匹配分。
    const needsRecalc = dto.stage !== undefined
      || dto.skills !== undefined
      || dto.yearsOfExperience !== undefined
      || dto.appliedJobPostingId !== undefined;
    if (needsRecalc && saved.appliedJobPostingId) {
      await this.agentService.recalculateAndPersistScore(saved.id).catch(() => {});
    }
    return saved;
  }

  async removeCandidate(id: string) {
    await this.getCandidate(id);
    await this.candidatesRepository.delete(id);
    return { success: true };
  }

  async listResumes(query: ListQueryDto) {
    const builder = this.resumesRepository
      .createQueryBuilder('resume')
      .leftJoinAndSelect('resume.candidate', 'candidate')
      .orderBy('resume.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('resume.fileName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'candidate.fullName ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.candidateId) {
      builder.andWhere('resume.candidateId = :candidateId', { candidateId: query.candidateId });
    }

    const result = await paginateQuery(builder, query);
    await Promise.all(
      result.items
        .map((item) => item.filePath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.ensureResumeFile(item)),
    );
    return result;
  }

  async getResume(id: string) {
    const entity = await this.resumesRepository.findOne({ where: { id }, relations: { candidate: true } });
    if (!entity) {
      throw new NotFoundException('未找到简历。');
    }

    if (entity.filePath) {
      await this.ensureResumeFile(entity.filePath);
    }

    return entity;
  }

  async getResumeDownload(id: string, user?: AuthenticatedUser) {
    const resume = await this.resumesRepository.findOne({
      where: { id },
      relations: { candidate: true },
    });

    if (!resume) {
      throw new NotFoundException('未找到简历。');
    }

    if (user?.role === Role.CANDIDATE && resume.candidate?.email !== user.email) {
      throw new BadRequestException('该简历不属于当前候选人。');
    }

    await this.ensureResumeFile(resume.filePath);
    const { buffer } = await this.storageService.readStoredFile(resume.filePath);
    const lowerName = resume.fileName.toLowerCase();
    const contentType = lowerName.endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return {
      fileName: resume.fileName,
      contentType,
      buffer,
    };
  }

  async analyzeResume(id: string) {
    const resume = await this.resumesRepository.findOne({
      where: { id },
      relations: { candidate: true },
    });

    if (!resume) {
      throw new NotFoundException('未找到简历。');
    }

    const analysis = await this.agentService.parseResume({
      resumeId: resume.id,
      resumeText: resume.parsedText?.trim() ? resume.parsedText : `文件名：${resume.fileName}`,
    });

    await this.resumesRepository.update(id, {
      parsedProfile: analysis.parsedProfile,
    });

    if (resume.candidateId) {
      const parsedProfile = analysis.parsedProfile as Record<string, unknown>;
      const parsedSkills = Array.isArray(parsedProfile.skills)
        ? (parsedProfile.skills as string[])
        : resume.candidate?.skills ?? [];

      await this.candidatesRepository.update(resume.candidateId, {
        skills: parsedSkills,
      });
    }

    return {
      resumeId: resume.id,
      candidateId: resume.candidateId,
      candidateName: resume.candidate?.fullName ?? null,
      fileName: resume.fileName,
      ...analysis,
    };
  }

  async createResume(dto: CreateResumeDto) {
    const saved = await this.resumesRepository.save(this.resumesRepository.create(dto));
    if (saved.filePath) {
      await this.ensureResumeFile(saved.filePath);
    }
    // 为关联候选人重新计算匹配分。
    if (saved.candidateId) {
      const candidate = await this.candidatesRepository.findOne({ where: { id: saved.candidateId }, select: ['id', 'appliedJobPostingId'] });
      if (candidate?.appliedJobPostingId) {
        await this.agentService.recalculateAndPersistScore(saved.candidateId).catch(() => {});
      }
    }
    return saved;
  }

  async updateResume(id: string, dto: UpdateResumeDto) {
    const entity = await this.resumesRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到简历。');
    }

    const saved = await this.resumesRepository.save(entity);
    if (saved.filePath) {
      await this.ensureResumeFile(saved.filePath);
    }
    // 简历数据变化后重新计算匹配分。
    if (saved.candidateId) {
      const candidate = await this.candidatesRepository.findOne({ where: { id: saved.candidateId }, select: ['id', 'appliedJobPostingId'] });
      if (candidate?.appliedJobPostingId) {
        await this.agentService.recalculateAndPersistScore(saved.candidateId).catch(() => {});
      }
    }
    return saved;
  }

  async removeResume(id: string) {
    await this.getResume(id);
    await this.resumesRepository.delete(id);
    return { success: true };
  }

  async uploadResume(candidateId: string, file: Express.Multer.File) {
    const candidate = await this.candidatesRepository.findOne({ where: { id: candidateId } });

    if (!candidate) {
      throw new NotFoundException('未找到候选人。');
    }

    if (!file) {
      throw new BadRequestException('请先上传简历文件。');
    }

    const originalFileName = repairTextEncoding(file.originalname);
    const { absolutePath, relativePath } = await this.storageService.saveUploadedFile(file, 'resumes');
    let parsedText = '';
    let parsedProfile: Record<string, unknown> = {};

    try {
      parsedText = await this.parseDocumentText(file, absolutePath);
      parsedProfile = this.extractStructuredProfile(parsedText);
    } catch {
      parsedProfile = {
        summary: '简历已上传，但自动解析失败。人力资源仍可下载并查看原始文件。',
        skills: [],
      };
    }

    const resume = await this.resumesRepository.save(
      this.resumesRepository.create({
        candidateId,
        fileName: originalFileName,
        filePath: relativePath,
        parsedText,
        parsedProfile,
        uploadedAt: new Date(),
      }),
    );

    await this.candidatesRepository.update(candidateId, {
      skills: Array.isArray(parsedProfile.skills) ? (parsedProfile.skills as string[]) : candidate.skills,
    });

    // 简历上传后重新计算匹配分。
    if (candidate.appliedJobPostingId) {
      await this.agentService.recalculateAndPersistScore(candidateId).catch(() => {});
    }

    return resume;
  }

  async listInterviews(query: ListQueryDto) {
    const builder = this.interviewsRepository
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.candidate', 'candidate')
      .leftJoinAndSelect('interview.jobPosting', 'jobPosting')
      .leftJoinAndSelect('interview.interviewer', 'interviewer')
      .orderBy('interview.scheduledAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('candidate.fullName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'jobPosting.title ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.status) {
      builder.andWhere('interview.status = :status', { status: query.status });
    }

    if (query.candidateId) {
      builder.andWhere('interview.candidateId = :candidateId', { candidateId: query.candidateId });
    }

    return paginateQuery(builder, query);
  }

  async getInterview(id: string) {
    const entity = await this.interviewsRepository.findOne({
      where: { id },
      relations: { candidate: true, jobPosting: true, interviewer: true },
    });

    if (!entity) {
      throw new NotFoundException('未找到面试记录。');
    }

    return entity;
  }

  createInterview(dto: CreateInterviewDto) {
    return this.interviewsRepository.save(this.interviewsRepository.create(dto));
  }

  async updateInterview(id: string, dto: UpdateInterviewDto) {
    const entity = await this.interviewsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到面试记录。');
    }

    return this.interviewsRepository.save(entity);
  }

  async removeInterview(id: string) {
    await this.getInterview(id);
    await this.interviewsRepository.delete(id);
    return { success: true };
  }

  async listOffers(query: ListQueryDto) {
    const builder = this.offersRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.candidate', 'candidate')
      .leftJoinAndSelect('offer.jobPosting', 'jobPosting')
      .leftJoinAndSelect('offer.approver', 'approver')
      .orderBy('offer.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('candidate.fullName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'jobPosting.title ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.status) {
      builder.andWhere('offer.status = :status', { status: query.status });
    }

    if (query.candidateId) {
      builder.andWhere('offer.candidateId = :candidateId', { candidateId: query.candidateId });
    }

    return paginateQuery(builder, query);
  }

  async getOffer(id: string) {
    const entity = await this.offersRepository.findOne({
      where: { id },
      relations: { candidate: true, jobPosting: true, approver: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到录用记录。');
    }

    return entity;
  }

  createOffer(dto: CreateOfferDto) {
    return this.offersRepository.save(this.offersRepository.create(dto));
  }

  async updateOffer(id: string, dto: UpdateOfferDto) {
    const entity = await this.offersRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到录用记录。');
    }

    return this.offersRepository.save(entity);
  }

  async removeOffer(id: string) {
    await this.getOffer(id);
    await this.offersRepository.delete(id);
    return { success: true };
  }

  private async parseDocumentText(file: Express.Multer.File, absolutePath: string): Promise<string> {
    try {
      if (file.mimetype.includes('pdf')) {
        const result = await pdfParse(file.buffer);
        return normalizeExtractedText(result.text);
      }

      if (file.mimetype.includes('word') || absolutePath.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return normalizeExtractedText(result.value);
      }

      throw new BadRequestException('简历文件类型不受支持。');
    } catch (error) {
      throw new BadRequestException('简历解析失败，请确认文件内容可读取。');
    }
  }

  private extractStructuredProfile(text: string): Record<string, unknown> {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
    const phone = text.match(/(?:\+?\d{1,3}[- ]?)?(?:\d[- ]?){7,14}\d/)?.[0] ?? '';
    const skills = ['Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'React', 'TypeScript', 'LangChain', 'OpenAI'].filter(
      (skill) => text.toLowerCase().includes(skill.toLowerCase()),
    );

    return {
      name: lines[0] ?? '',
      email,
      phone,
      skills,
      summary: lines.slice(0, 5).join(' '),
    };
  }

  private async getCandidateForPortal(user: AuthenticatedUser) {
    if (user.role !== Role.CANDIDATE) {
      throw new BadRequestException('当前账号不是候选人账号。');
    }

    const candidate = await this.candidatesRepository.findOne({
      where: { email: user.email },
      relations: { appliedJobPosting: true },
    });

    if (!candidate) {
      throw new NotFoundException('未找到候选人档案。');
    }

    return candidate;
  }

  private async getCandidateResumes(candidateId: string) {
    const resumes = await this.resumesRepository.find({
      where: { candidateId },
      order: { uploadedAt: 'DESC', createdAt: 'DESC' },
    });

    await Promise.all(
      resumes
        .map((item) => item.filePath)
        .filter((item): item is string => Boolean(item))
        .map((item) => this.ensureResumeFile(item)),
    );

    return resumes;
  }

  private async buildCandidateJobMatches(candidateId: string, preferredResume?: ResumeEntity) {
    const [candidate, resumes, jobs] = await Promise.all([
      this.candidatesRepository.findOne({ where: { id: candidateId }, relations: { appliedJobPosting: true } }),
      preferredResume ? Promise.resolve([preferredResume]) : this.getCandidateResumes(candidateId),
      this.jobPostingsRepository.find({
        where: { status: 'open' },
        relations: { department: true, position: true },
        order: { publishedAt: 'DESC', createdAt: 'DESC' },
      }),
    ]);

    if (!candidate) {
      throw new NotFoundException('未找到候选人档案。');
    }

    const latestResume = preferredResume ?? resumes[0] ?? null;
    const resumeText = `${latestResume?.parsedText ?? ''} ${JSON.stringify(latestResume?.parsedProfile ?? {})}`;
    const candidateText = [candidate.fullName, candidate.currentCompany, candidate.notes, candidate.skills.join(' '), resumeText].join(' ');
    const candidateTokens = this.extractMatchTokens(candidateText);
    const candidateSkills = this.extractResumeSkills(latestResume, candidate.skills);

    return jobs
      .map((job) => {
        const jobText = [job.title, job.description, job.requirements, job.department?.name, job.position?.name, job.position?.level]
          .filter(Boolean)
          .join(' ');
        const jobTokens = this.extractMatchTokens(jobText);

        const exactMatched = jobTokens.filter((token) => candidateTokens.includes(token));
        const exactMissing = jobTokens.filter((token) => !candidateTokens.includes(token));

        const partialMatched: string[] = [];
        for (const jt of exactMissing) {
          for (const ct of candidateTokens) {
            if (jt.includes(ct) || ct.includes(jt)) {
              partialMatched.push(jt);
              break;
            }
          }
        }

        const matchedKeywords = [...new Set([...exactMatched, ...partialMatched])];
        const missingKeywords = exactMissing.filter((t) => !partialMatched.includes(t));
        const requirementItems = this.extractRequirementItems(job);
        const matchedRequirements = this.matchRequirementItems(requirementItems, candidateTokens, true);
        const missingRequirements = this.matchRequirementItems(requirementItems, candidateTokens, false);

        const matchScore = this.computeMatchScore({
          candidateTokens,
          jobTokens,
          yearsOfExperience: this.toNumber(candidate.yearsOfExperience),
          hasResume: !!latestResume,
          stage: candidate.stage ?? 'new',
          parsedProfile: latestResume?.parsedProfile ?? null,
        });

        const resumeHighlights = this.buildResumeHighlights({
          candidate,
          latestResume,
          matchedKeywords,
          candidateSkills,
        });
        const suggestions = this.buildJobMatchSuggestions(matchScore, missingRequirements, missingKeywords, job.title);
        const analysis = this.buildJobMatchAnalysis(
          matchScore,
          matchedKeywords,
          missingKeywords,
          candidateSkills,
          matchedRequirements,
          missingRequirements,
          suggestions,
        );

        return {
          id: job.id,
          title: job.title,
          employmentType: job.employmentType,
          location: job.location,
          description: job.description,
          requirements: job.requirements,
          targetCount: job.targetCount,
          publishedAt: job.publishedAt,
          department: job.department ? { name: job.department.name, code: job.department.code } : null,
          position: job.position ? { name: job.position.name, code: job.position.code, level: job.position.level } : null,
          matchScore,
          matchedKeywords: matchedKeywords.slice(0, 12),
          missingKeywords: missingKeywords.slice(0, 8),
          matchedRequirements,
          missingRequirements,
          resumeHighlights,
          suggestions,
          analysis,
          isApplied: candidate.appliedJobPostingId === job.id,
        };
      })
      .sort((left, right) => right.matchScore - left.matchScore || Number(right.isApplied) - Number(left.isApplied));
  }

  private buildJobMatchAnalysis(
    score: number,
    matchedKeywords: string[],
    missingKeywords: string[],
    candidateSkills: string[],
    matchedRequirements: string[],
    missingRequirements: string[],
    suggestions: string[],
  ) {
    const matched = matchedRequirements.slice(0, 2).join('；') || matchedKeywords.slice(0, 4).join('、') || candidateSkills.slice(0, 4).join('、') || '核心经历';
    const missing = missingRequirements.slice(0, 2).join('；') || missingKeywords.slice(0, 3).join('、') || '岗位关键要求';
    const nextStep = suggestions[0] ?? '建议补充与岗位 JD 更直接对应的项目成果和量化指标。';

    if (score >= 80) {
      return `高度匹配。简历与 JD 的主要重合点是：${matched}。可优先投递；${nextStep}`;
    }

    if (score >= 60) {
      return `中度匹配。已覆盖：${matched}。需要补强：${missing}。${nextStep}`;
    }

    return `匹配度偏低。当前简历与 JD 的直接重合有限，主要缺口是：${missing}。${nextStep}`;
  }

  private extractRequirementItems(job: JobPostingEntity) {
    const source = [job.requirements, job.description].filter(Boolean).join('\n');
    return source
      .split(/[\r\n；;。.!！?？]|(?:\d+[.、])|(?:[-*•●▪◦]\s*)/g)
      .map((item) => item.trim().replace(/^岗位要求[:：]?/, '').replace(/^任职要求[:：]?/, '').replace(/^职责[:：]?/, ''))
      .filter((item) => item.length >= 4 && item.length <= 90)
      .slice(0, 10);
  }

  private matchRequirementItems(items: string[], candidateTokens: string[], shouldMatch: boolean) {
    return items
      .map((item) => ({
        item,
        tokens: this.extractMatchTokens(item),
      }))
      .filter(({ tokens }) => tokens.length > 0)
      .filter(({ tokens }) => {
        const hitCount = tokens.filter((token) =>
          candidateTokens.some((candidateToken) => token === candidateToken || token.includes(candidateToken) || candidateToken.includes(token)),
        ).length;
        const matched = hitCount > 0 && hitCount / tokens.length >= 0.25;
        return shouldMatch ? matched : !matched;
      })
      .map(({ item }) => item)
      .slice(0, shouldMatch ? 5 : 4);
  }

  private buildResumeHighlights(input: {
    candidate: CandidateEntity;
    latestResume: ResumeEntity | null;
    matchedKeywords: string[];
    candidateSkills: string[];
  }) {
    const parsedProfile = input.latestResume?.parsedProfile ?? {};
    const highlights = [
      input.matchedKeywords.length ? `JD 关键词命中：${input.matchedKeywords.slice(0, 6).join('、')}` : '',
      input.candidateSkills.length ? `简历技能：${input.candidateSkills.slice(0, 6).join('、')}` : '',
      this.toNumber(input.candidate.yearsOfExperience) > 0 ? `工作年限：${this.toNumber(input.candidate.yearsOfExperience)} 年` : '',
      typeof parsedProfile.summary === 'string' && parsedProfile.summary.trim()
        ? `简历摘要：${parsedProfile.summary.trim().slice(0, 80)}`
        : '',
    ].filter(Boolean);

    return highlights.slice(0, 4);
  }

  private buildJobMatchSuggestions(score: number, missingRequirements: string[], missingKeywords: string[], jobTitle: string) {
    const suggestions: string[] = [];

    if (missingRequirements.length > 0) {
      suggestions.push(`围绕「${missingRequirements[0]}」补充项目背景、个人职责和量化结果。`);
    } else if (missingKeywords.length > 0) {
      suggestions.push(`在简历中补充 ${missingKeywords.slice(0, 3).join('、')} 相关经历，便于和「${jobTitle}」JD 对齐。`);
    } else {
      suggestions.push(`简历与「${jobTitle}」JD 已有较好重合，建议突出最近项目成果和业务影响。`);
    }

    if (score >= 80) {
      suggestions.push('建议优先投递，并在沟通中准备 1-2 个与岗位职责直接相关的案例。');
    } else if (score >= 60) {
      suggestions.push('建议投递前优化简历表述，把匹配经历提前到简历前半部分。');
    } else {
      suggestions.push('建议先补充关键技能或选择更贴近当前经历的岗位。');
    }

    return suggestions;
  }
  private extractResumeSkills(resume: ResumeEntity | null, fallback: string[] = []) {
    const parsedSkills = resume?.parsedProfile && Array.isArray(resume.parsedProfile.skills)
      ? (resume.parsedProfile.skills as string[])
      : [];

    return Array.from(new Set([...parsedSkills, ...fallback].map((item) => String(item).trim()).filter(Boolean)));
  }

  private async searchCandidateKnowledge(query: string) {
    const terms = this.extractMatchTokens(query);
    const articles = await this.knowledgeBaseRepository.find({
      where: { isPublished: true },
      order: { createdAt: 'DESC' },
    });

    return articles
      .map((article) => ({
        article,
        score: this.scoreTokenOverlap(
          this.extractMatchTokens([article.title, article.question, article.answer, ...(article.tags ?? [])].join(' ')),
          terms,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.article)
      .slice(0, 4);
  }

  private extractMatchTokens(text: string) {
    const normalized = text.toLowerCase();
    const latinTokens = normalized.match(/[a-z][a-z0-9+#.-]{1,}/g) ?? [];
    const chineseTokens = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    const stopWords = new Set([
      'the', 'and', 'with', 'for', 'or', 'is', 'are', 'of', 'in', 'to', 'a', 'an',
      '岗位', '负责', '要求', '具备', '熟悉', '经验', '能力', '相关', '工作', '优先',
      '以及', '进行', '支持', '职位', '描述', '职责', '任职', '以上', '以下', '提供',
      '开发', '管理', '包括', '部门', '公司', '具有', '良好', '一定', '以上学历',
    ]);

    return Array.from(new Set([...latinTokens, ...chineseTokens].filter((token) => token.length >= 2 && !stopWords.has(token)))).slice(0, 100);
  }

  private fuzzyTokenMatch(jobTokens: string[], candidateTokens: string[]): { exact: number; partial: number; totalJob: number } {
    let exact = 0;
    let partial = 0;
    for (const jt of jobTokens) {
      let best = 0;
      for (const ct of candidateTokens) {
        if (jt === ct) { best = 2; break; }
        if (best < 1 && (jt.includes(ct) || ct.includes(jt))) best = 1;
      }
      if (best === 2) exact++;
      else if (best === 1) partial++;
    }
    return { exact, partial, totalJob: jobTokens.length };
  }

  private computeMatchScore(params: {
    candidateTokens: string[];
    jobTokens: string[];
    yearsOfExperience: number;
    hasResume: boolean;
    stage: string;
    parsedProfile?: Record<string, unknown> | null;
  }): number {
    const { candidateTokens, jobTokens, yearsOfExperience, hasResume, stage, parsedProfile } = params;

    const jobMatch = this.fuzzyTokenMatch(jobTokens, candidateTokens);
    const candMatch = this.fuzzyTokenMatch(candidateTokens, jobTokens);
    const jobSide = jobMatch.totalJob > 0
      ? (jobMatch.exact * 1.0 + jobMatch.partial * 0.5) / jobMatch.totalJob
      : 0.25;
    const candSide = candMatch.totalJob > 0
      ? (candMatch.exact * 1.0 + candMatch.partial * 0.5) / candMatch.totalJob
      : 0.25;
    const skillScore = Math.round((jobSide * 0.6 + candSide * 0.4) * 62);

    const exp = yearsOfExperience;
    let expScore: number;
    if (exp <= 0)    expScore = 0;
    else if (exp < 1) expScore = 2;
    else if (exp < 2) expScore = 5;
    else if (exp < 3) expScore = 8;
    else if (exp < 5) expScore = 14;
    else if (exp < 8) expScore = 20;
    else if (exp < 12) expScore = 25;
    else              expScore = 28;

    const resumeScore = hasResume ? 6 : 0;

    let eduScore = 0;
    if (parsedProfile) {
      const eduFields = [
        parsedProfile.education, parsedProfile.degree, parsedProfile.school,
        parsedProfile.certifications, parsedProfile.summary,
      ].filter(Boolean).join(' ');
      const eduText = String(eduFields).toLowerCase();
      if (/博士|ph.?d/.test(eduText)) eduScore = 5;
      else if (/硕士|master|mba/.test(eduText)) eduScore = 4;
      else if (/本科|bachelor|学士|bs\b|ba\b/.test(eduText)) eduScore = 3;
      else if (/大专|college|associate/.test(eduText)) eduScore = 1;
    }

    const stageBonusMap: Record<string, number> = {
      'new':             0,
      'screening':       5,
      'phone_screen':    8,
      'interview':      12,
      'technical_test': 12,
      'offer':          18,
      'hired':          20,
      'rejected':      -8,
    };
    const stageBonus = stageBonusMap[stage] ?? 0;

    const rawScore = skillScore + expScore + resumeScore + eduScore + stageBonus;

    let minScore = 18;
    if (stage === 'offer' || stage === 'hired') minScore = 68;
    else if (stage === 'interview' || stage === 'technical_test') minScore = 35;

    return Math.max(minScore, Math.min(98, Math.round(rawScore)));
  }
  private scoreTokenOverlap(sourceTokens: string[], queryTokens: string[]) {
    if (queryTokens.length === 0) {
      return 0;
    }

    const source = new Set(sourceTokens);
    return queryTokens.filter((token) => source.has(token)).length;
  }

  private groupByArray<T>(items: T[], getKey: (item: T) => string) {
    const result = new Map<string, T[]>();

    for (const item of items) {
      const key = getKey(item);
      const current = result.get(key) ?? [];
      current.push(item);
      result.set(key, current);
    }

    return result;
  }

  private groupByLatest<T>(items: T[], getKey: (item: T) => string, getTime: (item: T) => number) {
    const result = new Map<string, T>();

    for (const item of items) {
      const key = getKey(item);
      const current = result.get(key);

      if (!current || getTime(item) > getTime(current)) {
        result.set(key, item);
      }
    }

    return result;
  }

  private countBy<T>(items: T[], getKey: (item: T) => string) {
    const result = new Map<string, number>();

    for (const item of items) {
      const key = getKey(item);
      result.set(key, (result.get(key) ?? 0) + 1);
    }

    return result;
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, current) => sum + current, 0) / values.length;
  }

  private toNumber(value: string | number | null | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    return 0;
  }

  private daysFrom(startDate: Date | string, endDate = new Date()) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return 0;
    }

    return Math.max(Math.ceil((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 0);
  }

  private daysBetween(startDate: Date | string, endDate: Date | string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getJobUrgencyLevel(input: {
    targetCount: number;
    candidateCount: number;
    acceptedOffers: number;
    daysOpen: number | null;
    interviewCount: number;
  }): HiringAlertLevel {
    if (input.acceptedOffers >= input.targetCount && input.targetCount > 0) {
      return 'low';
    }

    if (input.candidateCount === 0 || (input.daysOpen !== null && input.daysOpen > 14 && input.interviewCount === 0)) {
      return 'high';
    }

    if (input.candidateCount < input.targetCount || (input.daysOpen !== null && input.daysOpen > 7)) {
      return 'medium';
    }

    return 'low';
  }

  private getCandidateNextAction(
    candidate: CandidateEntity,
    context: {
      latestResume: ResumeEntity | null;
      futureInterview: InterviewEntity | null;
      latestInterview: InterviewEntity | null;
      latestOffer: OfferEntity | null;
    },
  ) {
    if (!context.latestResume) {
      return '上传并解析简历';
    }

    if (candidate.stage === 'new') {
      return '执行智能初筛并分配招聘人员复核';
    }

    if (candidate.stage === 'screening') {
      return '确认候选人是否进入短名单';
    }

    if (candidate.stage === 'interview' && !context.futureInterview) {
      return '安排下一轮面试';
    }

    if (context.futureInterview) {
      return '确认面试邀约已发送';
    }

    if (candidate.stage === 'offer' && !context.latestOffer) {
      return '准备录用草稿';
    }

    if (context.latestOffer?.status === 'sent') {
      return '跟进录用反馈';
    }

    if (context.latestInterview?.status === 'completed' && !context.latestOffer) {
      return '完成面试评估';
    }

    return '持续跟进招聘流程';
  }

  private getStageLabel(stage: string) {
    const labels: Record<string, string> = {
      new: '新入池',
      screening: '筛选中',
      interview: '面试中',
      offer: '录用阶段',
      hired: '已录用',
      rejected: '已淘汰',
    };

    return labels[stage] ?? stage;
  }

  private buildHiringAlerts(input: {
    now: Date;
    openJobHealth: Array<{
      id: string;
      title: string;
      candidateCount: number;
      targetCount: number;
      daysOpen: number | null;
      interviewCount: number;
      urgencyLevel: HiringAlertLevel;
    }>;
    interviews: InterviewEntity[];
    offers: OfferEntity[];
    activeCandidates: CandidateEntity[];
  }) {
    const alerts: Array<{
      id: string;
      level: HiringAlertLevel;
      title: string;
      description: string;
    }> = [];

    for (const job of input.openJobHealth) {
      if (job.candidateCount === 0) {
        alerts.push({
          id: `job-no-candidate:${job.id}`,
          level: 'high',
          title: `${job.title} 仍无活跃候选人`,
          description: '该职位已开放，但当前仍没有候选人进入有效招聘流程。',
        });
      } else if (job.daysOpen !== null && job.daysOpen > 14 && job.interviewCount === 0) {
        alerts.push({
          id: `job-no-interview:${job.id}`,
          level: 'high',
          title: `${job.title} 尚未进入面试阶段`,
          description: `该职位已开放 ${job.daysOpen} 天，仍未安排任何面试。`,
        });
      } else if (job.candidateCount < job.targetCount) {
        alerts.push({
          id: `job-below-target:${job.id}`,
          level: job.urgencyLevel,
          title: `${job.title} 的招聘储备低于目标`,
          description: `当前活跃候选人为 ${job.candidateCount} 人，目标招聘人数为 ${job.targetCount} 人。`,
        });
      }
    }

    input.interviews
      .filter((interview) => interview.status === 'scheduled' && new Date(interview.scheduledAt) < input.now)
      .slice(0, 3)
      .forEach((interview) => {
        alerts.push({
          id: `interview-overdue:${interview.id}`,
          level: 'medium',
          title: '面试记录待更新',
          description: `${interview.candidate?.fullName ?? '候选人'} 的面试时间已过，但状态仍为已排期。`,
        });
      });

    input.offers
      .filter(
        (offer) =>
          offer.status === 'sent' &&
          offer.offeredAt &&
          this.daysFrom(offer.offeredAt, input.now) >= 7,
      )
      .slice(0, 3)
      .forEach((offer) => {
        alerts.push({
          id: `offer-follow-up:${offer.id}`,
          level: 'medium',
          title: '录用跟进已超期',
          description: `发给 ${offer.candidate?.fullName ?? '候选人'} 的录用通知已超过一周仍未有结果。`,
        });
      });

    input.activeCandidates
      .filter((candidate) => candidate.stage === 'interview')
      .slice(0, 2)
      .forEach((candidate) => {
        const hasUpcomingInterview = input.interviews.some(
          (interview) =>
            interview.candidateId === candidate.id &&
            interview.status === 'scheduled' &&
            new Date(interview.scheduledAt) >= input.now,
        );

        if (!hasUpcomingInterview) {
          alerts.push({
            id: `candidate-no-next-interview:${candidate.id}`,
            level: 'low',
            title: `${candidate.fullName} 尚未安排下一轮面试`,
            description: '候选人已进入面试阶段，但当前没有后续面试安排。',
          });
        }
      });

    return alerts.slice(0, 8);
  }

  private ensureResumeFile(filePath: string) {
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.endsWith('.docx')) {
      return this.storageService.ensureDocxPlaceholder(filePath);
    }

    return this.storageService.ensurePdfPlaceholder(filePath);
  }
}
