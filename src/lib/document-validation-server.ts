import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'
// pdf-parse의 index.js는 CJS "메인 모듈" 판별 로직이 있어 동적 import 시
// 오작동하므로(자체 테스트 픽스처를 읽으려다 실패), 실제 구현 파일을 정적으로 import한다.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { DOCUMENT_SCHEMAS, type DocumentType } from './document-schemas'
import type { DocumentValidationResult } from './document-validation'

// ── 2·3단계: 문서 내용 추출 및 기준 서식 대조 ──────────────────────────
// PDF 파싱은 서버에서만 가능하므로 이 파일은 절대 클라이언트 컴포넌트에서 import하지 않는다
// ('server-only'가 실수로 클라이언트 번들에 포함될 경우 빌드 타임에 에러를 낸다).
// 브라우저에서는 /api/validate-document 엔드포인트를 통해 이 모듈의 결과를 받는다.

async function loadPdfBuffer(source: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//.test(source)) {
      const res = await fetch(source)
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    }

    const relativePath = source.startsWith('/') ? source.slice(1) : source
    const filePath = path.join(process.cwd(), 'public', relativePath)
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

export async function extractPdfText(source: string): Promise<string | null> {
  const buffer = await loadPdfBuffer(source)
  if (!buffer) return null

  try {
    const result = await pdfParse(buffer)
    return result.text
  } catch {
    return null
  }
}

const normalize = (text: string) => text.replace(/\s+/g, ' ')

// 필수서류 판별의 최종 진입점. 사람의 최종 판단을 대체하지 않는다 —
// "확인됨 / 누락 / 불일치" 대조 결과만 산출하며, 승인/반려 등의 결정은 내리지 않는다.
export async function validateDocumentContent(
  source: string | undefined,
  docType: DocumentType,
  companyName: string,
  courseName: string
): Promise<DocumentValidationResult> {
  const schema = DOCUMENT_SCHEMAS[docType]

  // 1단계: 파일 자체가 없으면 바로 누락
  if (!source) {
    return { status: '누락', stage: 1, reason: `${schema.label} 파일이 첨부되지 않음` }
  }

  // 2단계: 문서 내용 확인 - 텍스트 추출 및 문서 종류 확인
  const rawText = await extractPdfText(source)
  if (!rawText || rawText.trim().length < 10) {
    return {
      status: '누락',
      stage: 2,
      reason: '문서 내용을 읽을 수 없음 (스캔본이거나 손상된 파일일 수 있음) - 육안 확인 필요',
    }
  }

  const text = normalize(rawText)
  const matchesTitle = schema.titleKeywords.some((keyword) => text.includes(normalize(keyword)))
  if (!matchesTitle) {
    return {
      status: '불일치',
      stage: 2,
      reason: `제출된 문서에서 '${schema.label}' 관련 제목을 찾을 수 없음 - 다른 서류가 첨부되었을 가능성`,
    }
  }

  // 3단계: 기준 서식 대조 - 필수 항목 존재 여부
  const missingFields = schema.requiredFields
    .filter((field) => !field.keywords.some((keyword) => text.includes(normalize(keyword))))
    .map((field) => field.label)

  if (missingFields.length > 0) {
    return {
      status: '누락',
      stage: 3,
      reason: `필수 항목 누락: ${missingFields.join(', ')}`,
      missingFields,
    }
  }

  // 3단계 대상 일치 확인: 필수 항목이 다 있어도, 그 값이 실제 이 과정/기업의 서류라는
  // 보장은 아니다(다른 과정·기업의 서류를 잘못 첨부해도 항목 자체는 다 채워져 있으므로
  // 위 검사만으론 "확인됨"이 나온다). 문서 텍스트에 실제 기업명/과정명이 그대로
  // 등장하는지 대조해 다른 대상의 서류가 잘못 첨부된 경우를 걸러낸다.
  const companyMatches = text.includes(normalize(companyName))
  const courseMatches = text.includes(normalize(courseName))

  if (!companyMatches || !courseMatches) {
    const mismatched = [!companyMatches && '기업명', !courseMatches && '과정명'].filter(Boolean).join(', ')
    return {
      status: '불일치',
      stage: 3,
      reason: `문서 내용의 ${mismatched}이(가) 이 과정(${courseName} / ${companyName})과 일치하지 않음 - 다른 과정·기업의 서류가 첨부되었을 가능성`,
    }
  }

  return { status: '확인됨', stage: 3, reason: '필수 항목이 모두 확인됨' }
}
