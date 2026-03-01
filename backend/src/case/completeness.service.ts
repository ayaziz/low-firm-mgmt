import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CompletenessResult {
  percentage: number;
  fieldScore: number;
  documentScore: number;
  participantScore: number;
  missingItems: string[];
}

@Injectable()
export class CompletenessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Weighted completeness:
   *   40% required fields filled
   *   40% required documents uploaded & passed scan
   *   20% required participants / checklist items complete
   *
   * Does NOT block state transitions – informational only.
   */
  async calculate(tenantSlug: string, caseId: string): Promise<CompletenessResult> {
    const missingItems: string[] = [];

    // 1. Field completeness (40%)
    const caseRows: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT c.*, ct.label_en as case_type_label FROM cases c LEFT JOIN case_types ct ON c.case_type_id = ct.id WHERE c.id = $1`,
      [caseId],
    );
    const caseData = caseRows?.[0];
    if (!caseData) return { percentage: 0, fieldScore: 0, documentScore: 0, participantScore: 0, missingItems: ['Case not found'] };

    const requiredFields = [
      { key: 'title', label: 'Case Title' },
      { key: 'case_type_id', label: 'Case Type' },
      { key: 'court_case_number', label: 'Court Case Number' },
      { key: 'assigned_lawyer_user_id', label: 'Assigned Lawyer' },
    ];
    let filledFields = 0;
    for (const f of requiredFields) {
      if (caseData[f.key]) filledFields++;
      else missingItems.push(`Missing field: ${f.label}`);
    }
    const fieldScore = requiredFields.length > 0 ? filledFields / requiredFields.length : 1;

    // 2. Document completeness (40%)
    const docReqs: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT cdr.*, dt.label_en as doc_type_label FROM case_doc_requirements cdr
       LEFT JOIN master_data dt ON cdr.doc_type_code = dt.code AND dt.category = 'docType'
       WHERE cdr.case_id = $1`,
      [caseId],
    );
    let docFilled = 0;
    const totalDocReqs = docReqs?.length || 0;
    if (totalDocReqs > 0) {
      for (const dr of docReqs) {
        if (dr.status === 'Provided') {
          docFilled++;
        } else {
          missingItems.push(`Missing document: ${dr.doc_type_label || dr.doc_type_code}`);
        }
      }
    }
    const documentScore = totalDocReqs > 0 ? docFilled / totalDocReqs : 1;

    // 3. Participant / checklist completeness (20%)
    // Check that at least one customer and one CaseOwner are linked
    const customerCount: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT COUNT(*) as cnt FROM case_customers WHERE case_id = $1`,
      [caseId],
    );
    const memberCount: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT COUNT(*) as cnt FROM case_memberships WHERE case_id = $1 AND role = 'CaseOwner'`,
      [caseId],
    );
    const partyCount: any[] = await this.prisma.queryTenant(
      tenantSlug,
      `SELECT COUNT(*) as cnt FROM case_parties WHERE case_id = $1`,
      [caseId],
    );

    let participantChecks = 0;
    const totalParticipantChecks = 3;

    if (Number(customerCount?.[0]?.cnt || 0) > 0) participantChecks++;
    else missingItems.push('Missing: At least one customer');

    if (Number(memberCount?.[0]?.cnt || 0) > 0) participantChecks++;
    else missingItems.push('Missing: Case owner');

    if (Number(partyCount?.[0]?.cnt || 0) > 0) participantChecks++;
    else missingItems.push('Missing: At least one case party');

    const participantScore = participantChecks / totalParticipantChecks;

    // Weighted total
    const percentage = Math.round((fieldScore * 40 + documentScore * 40 + participantScore * 20));

    return { percentage, fieldScore: Math.round(fieldScore * 100), documentScore: Math.round(documentScore * 100), participantScore: Math.round(participantScore * 100), missingItems };
  }
}
