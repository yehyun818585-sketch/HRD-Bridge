export type DocumentType = 'businessPlan' | 'staffRegistration'

export interface RequiredField {
  key: string
  label: string
  // 문서 텍스트에서 이 항목을 식별하기 위한 키워드(하나라도 매치되면 항목 라벨을 찾은 것으로 본다)
  keywords: string[]
}

export interface DocumentSchema {
  docType: DocumentType
  label: string
  // 이 문서 종류가 맞는지 판별하는 제목 키워드 (2단계: 내용 확인)
  titleKeywords: string[]
  // 기준 서식상 반드시 있어야 하는 항목들 (3단계: 스키마 대조)
  requiredFields: RequiredField[]
}

export const DOCUMENT_SCHEMAS: Record<DocumentType, DocumentSchema> = {
  businessPlan: {
    docType: 'businessPlan',
    label: '사업계획서',
    titleKeywords: ['사업계획서'],
    requiredFields: [
      { key: 'programName', label: '프로그램 명', keywords: ['프로그램 명', '프로그램명'] },
      { key: 'purpose', label: '시행 목적', keywords: ['시행 목적', '시행목적'] },
      { key: 'participatingCompany', label: '참여 기업', keywords: ['참여 기업', '참여기업'] },
      { key: 'trainingCenter', label: '공동훈련센터', keywords: ['공동훈련센터'] },
      { key: 'participants', label: '참여 인원', keywords: ['참여 인원', '참여인원'] },
      { key: 'trainingType', label: '훈련 유형', keywords: ['훈련 유형', '훈련유형'] },
      { key: 'trainingLocation', label: '교육 시행 장소', keywords: ['교육 시행 장소', '교육시행장소'] },
      { key: 'curriculum', label: '교육 회차별 계획', keywords: ['교육 회차별 계획', '회차별 계획'] },
    ],
  },
  staffRegistration: {
    docType: 'staffRegistration',
    label: '전담인력 등록',
    titleKeywords: ['전담인력'],
    requiredFields: [
      { key: 'courseName', label: '과정명', keywords: ['과정명'] },
      { key: 'participatingCompany', label: '참여 기업', keywords: ['참여 기업', '참여기업'] },
      { key: 'staffStatus', label: '전담인력 현황', keywords: ['전담인력 현황'] },
      { key: 'staffName', label: '성명', keywords: ['성명'] },
      { key: 'staffPosition', label: '직위', keywords: ['직위'] },
      { key: 'staffDuty', label: '담당 업무', keywords: ['담당 업무', '담당업무'] },
      { key: 'staffContact', label: '연락처', keywords: ['연락처'] },
    ],
  },
}
