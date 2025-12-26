import { createServerSupabaseClient } from '@/lib/supabase-server'
import CommentSection from '@/components/CommentSection'
import CourseFilesSection from '@/components/CourseFilesSection'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Course {
  id: string
  name: string
  status: string
  stage: string
  issues: string | null
  created_at: string
}

interface Company {
  id: string
  name: string
  created_at: string
  courses: Course[]
}

// PDF 파일 매핑 - 기업명 첫글자와 과정명 키워드로 PDF 파일 경로 결정
const getPdfFiles = (companyName: string, courseName: string): { businessPlan?: string; staffRegistration?: string } => {
  const companyPrefix = companyName.charAt(0).toUpperCase() // A, B, C 등
  const lowerCourseName = courseName.toLowerCase()

  // 키워드 기반 매핑
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
const checkStaffDuplication = (companyName: string, courses: Course[]): boolean => {
  // 각 과정의 전담인력 파일 경로 수집
  const staffFiles: string[] = []

  for (const course of courses) {
    const pdfFiles = getPdfFiles(companyName, course.name)
    if (pdfFiles.staffRegistration) {
      staffFiles.push(pdfFiles.staffRegistration)
    }
  }

  // 2개 이상 과정이 있고, 모두 같은 파일을 사용하면 중복
  if (staffFiles.length >= 2) {
    const uniqueFiles = new Set(staffFiles)
    // 파일이 모두 동일하면 중복 (uniqueFiles.size === 1)
    return uniqueFiles.size < staffFiles.length
  }

  return false
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ course?: string }>
}) {
  const { id } = await params
  const { course: selectedCourseId } = await searchParams

  const supabase = await createServerSupabaseClient()

  const { data: company, error } = await supabase
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
        issues,
        created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !company) {
    notFound()
  }

  const typedCompany = company as Company
  const selectedCourse = selectedCourseId
    ? typedCompany.courses.find((c) => c.id === selectedCourseId)
    : typedCompany.courses[0]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '승인완료'
      case 'pending': return '승인대기'
      case 'rejected': return '반려'
      default: return '준비중'
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href="/companies"
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{typedCompany.name}</h1>
          <p className="text-gray-500">총 {typedCompany.courses.length}개 과정</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 과정 목록 */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            과정 목록
          </h2>
          {typedCompany.courses.map((course) => (
            <Link
              key={course.id}
              href={`/companies/${id}?course=${course.id}`}
              className={`block p-4 rounded-lg border transition ${
                selectedCourse?.id === course.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{course.name}</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}>
                  {getStatusText(course.status)}
                </span>
              </div>
              <p className="text-sm text-gray-500">{course.stage}</p>
            </Link>
          ))}
        </div>

        {/* 과정 상세 + 댓글 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCourse ? (
            (() => {
              // PDF 파일 정보를 먼저 가져와서 이슈 상태 계산
              const pdfFiles = getPdfFiles(typedCompany.name, selectedCourse.name)
              // 전담인력 이슈가 있지만 PDF가 첨부되어 있으면 이슈 해결된 것으로 간주
              const hasStaffIssueInDB = selectedCourse.issues?.includes('전담인력') || false
              const isStaffIssueResolved = hasStaffIssueInDB && pdfFiles.staffRegistration

              // 전담인력 중복 여부 체크 (동일 파일이 여러 과정에 사용되는 경우)
              const hasStaffDuplication = checkStaffDuplication(typedCompany.name, typedCompany.courses)

              // 최종 이슈 결정: 기존 이슈가 해결되었으면 null, 중복이면 "전담인력 중복"
              let effectiveIssue = isStaffIssueResolved ? null : selectedCourse.issues
              if (hasStaffDuplication && pdfFiles.staffRegistration) {
                effectiveIssue = effectiveIssue ? `${effectiveIssue}, 전담인력 중복` : '전담인력 중복'
              }

              return (
            <>
              {/* 과정 정보 (읽기 전용) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCourse.name}
                  </h2>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    읽기 전용
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">현재 단계</p>
                    <p className="font-medium text-gray-900">{selectedCourse.stage}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">승인 상태</p>
                    <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedCourse.status)}`}>
                      {getStatusText(selectedCourse.status)}
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg md:col-span-2">
                    <p className="text-sm text-gray-500 mb-1">주요 이슈</p>
                    <p className={`font-medium ${effectiveIssue ? 'text-red-600' : 'text-gray-400'}`}>
                      {effectiveIssue || '이슈 없음'}
                    </p>
                  </div>
                </div>

                {/* 서류 제출 현황 (실시간 업데이트) */}
                <CourseFilesSection
                  courseId={selectedCourse.id}
                  courseName={selectedCourse.name}
                  companyName={typedCompany.name}
                  hasStaffIssue={hasStaffIssueInDB && !pdfFiles.staffRegistration}
                  initialPdfFiles={pdfFiles}
                />
              </div>

              {/* 댓글 섹션 */}
              <CommentSection
                courseId={selectedCourse.id}
                courseName={selectedCourse.name}
                hasStaffIssue={hasStaffIssueInDB && !pdfFiles.staffRegistration}
                companyName={typedCompany.name}
                totalCoursesInCompany={typedCompany.courses.length}
              />
            </>
              )
            })()
          ) : (
            <div className="text-center py-12 text-gray-500">
              과정을 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
