'use client'

import type { DocumentType, ValidationStatus } from './document-validation'

export interface DocValidation {
  status: ValidationStatus
  reason: string
}

export const DOC_LABELS: Record<DocumentType, string> = {
  businessPlan: '사업계획서',
  staffRegistration: '전담인력 등록',
}

export const STATUS_BADGE: Record<ValidationStatus, string> = {
  확인됨: 'bg-green-100 text-green-700',
  누락: 'bg-red-100 text-red-700',
  불일치: 'bg-amber-100 text-amber-700',
}

// 기업이 작성해서 첨부할 수 있도록 제공하는 빈 양식 (scripts/generate-demo-pdfs.mjs로 생성)
export const TEMPLATE_URLS: Record<DocumentType, string> = {
  businessPlan: '/files/templates/사업계획서_양식.pdf',
  staffRegistration: '/files/templates/전담인력등록_양식.pdf',
}

// 브라우저(클라이언트 컴포넌트)에서는 PDF를 직접 파싱할 수 없으므로
// /api/validate-document를 통해 2·3단계(문서 내용 확인, 기준 서식 대조) 결과를 받아온다.
export async function fetchDocumentValidation(
  source: string | undefined,
  docType: DocumentType
): Promise<DocValidation> {
  if (!source) {
    return { status: '누락', reason: `${DOC_LABELS[docType]} 파일이 첨부되지 않음` }
  }

  try {
    const res = await fetch('/api/validate-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, docType }),
    })
    if (!res.ok) {
      return { status: '누락', reason: '검증 요청에 실패했습니다. 다시 시도해주세요.' }
    }
    const data = await res.json()
    return { status: data.status, reason: data.reason }
  } catch {
    return { status: '누락', reason: '검증 요청 중 오류가 발생했습니다.' }
  }
}
