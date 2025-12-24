import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

interface Course {
  id: string
  name: string
  status: string
  stage: string
  issues: string | null
}

interface Company {
  id: string
  name: string
  created_at: string
  courses: Course[]
}

// PDF 파일 매핑 - 기업명 첫글자와 과정명 키워드로 PDF 파일 경로 결정
const getPdfFiles = (companyName: string, courseName: string): { businessPlan?: string; staffRegistration?: string } => {
  const companyPrefix = companyName.charAt(0).toUpperCase()
  const lowerCourseName = courseName.toLowerCase()

  if (companyPrefix === 'A') {
    if (lowerCourseName.includes('ai') || lowerCourseName.includes('개발자 양성')) {
      return {
        businessPlan: '/files/A_AI개발자양성과정_사업계획서.pdf',
        staffRegistration: '/files/A_AI개발자양성과정_전담인력등록.pdf'
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

// 전담인력 중복 여부 확인
const checkStaffDuplication = (companyName: string, courses: Course[]): boolean => {
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

// 과정별 유효 이슈 계산
const getEffectiveIssue = (companyName: string, course: Course, courses: Course[]): string | null => {
  const pdfFiles = getPdfFiles(companyName, course.name)
  const hasStaffIssueInDB = course.issues?.includes('전담인력') || false
  const isStaffIssueResolved = hasStaffIssueInDB && pdfFiles.staffRegistration
  const hasStaffDuplication = checkStaffDuplication(companyName, courses)

  let effectiveIssue = isStaffIssueResolved ? null : course.issues

  if (hasStaffDuplication && pdfFiles.staffRegistration) {
    effectiveIssue = effectiveIssue ? `${effectiveIssue}, 전담인력 중복` : '전담인력 중복'
  }

  return effectiveIssue
}

export default async function CompaniesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: companies, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      created_at,
      courses (
        id,
        name,
        status,
        stage,
        issues
      )
    `)
    .order('name')

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">데이터를 불러오는데 실패했습니다.</p>
        <p className="text-gray-500 text-sm mt-2">Supabase 연결을 확인해주세요.</p>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '승인'
      case 'pending': return '대기'
      case 'rejected': return '반려'
      default: return '준비중'
    }
  }

  return (
    <div className="space-y-6">
      {/* 담당자 정보 카드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-blue-600 font-medium">한국산업인력공단 담당자</p>
            <p className="text-lg font-semibold text-gray-900">김철수</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>052-714-8114</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>chulsoo.kim@hrdkorea.or.kr</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">기업 현황</h1>
        <p className="text-gray-500">총 {companies?.length || 0}개 기업</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">기업명</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">과정명</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">현재 단계</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">상태</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">주요 이슈</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {companies?.map((company: Company) => (
              company.courses?.map((course, idx) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  {idx === 0 && (
                    <td
                      className="px-6 py-4 font-medium text-gray-900"
                      rowSpan={company.courses.length}
                    >
                      {company.name}
                    </td>
                  )}
                  <td className="px-6 py-4 text-gray-700">{course.name}</td>
                  <td className="px-6 py-4 text-gray-700">{course.stage}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}>
                      {getStatusText(course.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {(() => {
                      const effectiveIssue = getEffectiveIssue(company.name, course, company.courses)
                      return effectiveIssue ? (
                        <span className="text-red-600">{effectiveIssue}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/companies/${company.id}?course=${course.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>

        {(!companies || companies.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            등록된 기업이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
