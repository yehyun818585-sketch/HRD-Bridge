import type { DocumentType } from './document-schemas'

export type { DocumentType }

export interface Course {
  id: string
  name: string
}

export interface PdfFiles {
  businessPlan?: string
  staffRegistration?: string
}

export type ValidationStatus = '확인됨' | '누락' | '불일치'

export interface DocumentValidationResult {
  status: ValidationStatus
  stage: 1 | 2 | 3
  reason: string
  missingFields?: string[]
}

// ── 1단계: 파일명/키워드 매칭 ──────────────────────────────────────────
// 기업명·과정명 키워드로 후보 파일 경로를 산출할 뿐, 이 결과만으로
// "서류가 정상 제출됐다"고 확정하지 않는다. 확정 판단은 2·3단계(document-validation-server의
// validateDocumentContent)에서 한다. 참고: .claude/skills/document-validation/SKILL.md
//
// node:fs 등을 쓰지 않는 순수 함수만 여기 둔다 — 이 파일은 클라이언트 컴포넌트에서도
// import되므로, 서버 전용 코드(PDF 파싱 등)는 절대 이 파일에 추가하지 말 것 (document-validation-server.ts로).
export function getPdfFiles(companyName: string, courseName: string): PdfFiles {
  const companyPrefix = companyName.charAt(0).toUpperCase()
  const lowerCourseName = courseName.toLowerCase()

  if (companyPrefix === 'A') {
    if (lowerCourseName.includes('ai') || lowerCourseName.includes('개발자 양성')) {
      return {
        businessPlan: '/files/A_AI개발자양성과정_사업계획서.pdf'
        // staffRegistration 제거 - 실시간 파일 첨부 테스트용
      }
    }
    if (lowerCourseName.includes('웹') || lowerCourseName.includes('웹개발')) {
      return {
        businessPlan: '/files/A_웹개발 실무과정_사업계획서.pdf',
        staffRegistration: '/files/A_웹개발 실무과정_전담인력등록.pdf'
      }
    }
  }

  if (companyPrefix === 'B') {
    if (lowerCourseName.includes('데이터') || lowerCourseName.includes('분석')) {
      return {
        businessPlan: '/files/B_데이터분석 실무_사업계획서.pdf',
        staffRegistration: '/files/B_전담인력등록.pdf'
      }
    }
    if (lowerCourseName.includes('클라우드') || lowerCourseName.includes('엔지니어')) {
      return {
        businessPlan: '/files/B_클라우드 엔지니어 과정_사업계획서.pdf',
        staffRegistration: '/files/B_전담인력등록.pdf'
      }
    }
  }

  if (companyPrefix === 'C') {
    if (lowerCourseName.includes('보안') || lowerCourseName.includes('정보보안')) {
      return {
        businessPlan: '/files/C_보안전문가 과정_사업계획서.pdf',
        staffRegistration: '/files/C_정보보안 과정_전담인력등록.pdf'
      }
    }
  }

  return {}
}

// 전담인력 중복 여부 확인 - 동일 기업 내 여러 과정이 같은 전담인력 파일을 사용하는지 확인
// (문서 내용이 아니라 동일 파일 재사용 여부를 보는 별도의 데이터 정합성 체크)
export function checkStaffDuplication(companyName: string, courses: Course[]): boolean {
  const staffFiles: string[] = []

  for (const course of courses) {
    const pdfFiles = getPdfFiles(companyName, course.name)
    if (pdfFiles.staffRegistration) {
      staffFiles.push(pdfFiles.staffRegistration)
    }
  }

  if (staffFiles.length >= 2) {
    const uniqueFiles = new Set(staffFiles)
    return uniqueFiles.size < staffFiles.length
  }

  return false
}
