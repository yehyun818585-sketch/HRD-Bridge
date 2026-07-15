import { NextRequest, NextResponse } from 'next/server'
import { validateDocumentContent } from '@/lib/document-validation-server'
import type { DocumentType } from '@/lib/document-validation'

// 클라이언트 컴포넌트(브라우저)는 PDF 파싱을 직접 할 수 없으므로,
// 실시간 업로드 파일의 2·3단계 검증(문서 내용 추출 + 기준 서식 대조)은 이 엔드포인트를 통해 수행한다.
// 이 엔드포인트는 대조 결과("확인됨"/"누락"/"불일치")만 반환하며, 승인 여부를 결정하지 않는다.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body.docType !== 'string') {
    return NextResponse.json({ error: 'docType이 필요합니다.' }, { status: 400 })
  }

  const docType = body.docType as DocumentType
  if (docType !== 'businessPlan' && docType !== 'staffRegistration') {
    return NextResponse.json({ error: '알 수 없는 docType입니다.' }, { status: 400 })
  }

  const source: string | undefined = typeof body.source === 'string' ? body.source : undefined
  const companyName = typeof body.companyName === 'string' ? body.companyName : ''
  const courseName = typeof body.courseName === 'string' ? body.courseName : ''

  const result = await validateDocumentContent(source, docType, companyName, courseName)
  return NextResponse.json(result)
}
