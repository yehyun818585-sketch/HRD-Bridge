'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import PdfViewerModal from '@/components/PdfViewerModal'
import CompanyCommentSection from '@/components/CompanyCommentSection'
import { getPdfFiles, checkStaffDuplication } from '@/lib/document-validation'
import type { DocumentType } from '@/lib/document-validation'
import { DOC_LABELS, STATUS_BADGE, TEMPLATE_URLS, fetchDocumentValidation, type DocValidation } from '@/lib/document-validation-client'

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
  courses: Course[]
}

export default function MyCompanyPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  // 업로드된 파일 상태 관리 (courseId -> { businessPlan?: string, staffRegistration?: string })
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { businessPlan?: string; staffRegistration?: string }>>({})

  const supabase = createClient()

  // DB에서 업로드된 파일 로드
  const loadUploadedFiles = async (courseIds: string[]) => {
    const { data } = await supabase
      .from('course_files')
      .select('course_id, file_type, file_url')
      .in('course_id', courseIds)

    if (data) {
      const filesMap: Record<string, { businessPlan?: string; staffRegistration?: string }> = {}
      data.forEach((file) => {
        if (!filesMap[file.course_id]) {
          filesMap[file.course_id] = {}
        }
        filesMap[file.course_id][file.file_type as 'businessPlan' | 'staffRegistration'] = file.file_url
      })
      setUploadedFiles(filesMap)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      // 현재 사용자 확인
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        setError('로그인이 필요합니다.')
        setLoading(false)
        return
      }

      setUser(currentUser)

      // 사용자 프로필에서 company_id 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', currentUser.id)
        .single()

      if (!profile?.company_id) {
        setError('소속 기업이 등록되지 않았습니다. 관리자에게 문의하세요.')
        setLoading(false)
        return
      }

      // 기업 및 과정 정보 가져오기
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          courses (
            id,
            name,
            status,
            stage,
            issues,
            created_at
          )
        `)
        .eq('id', profile.company_id)
        .single()

      if (companyError || !companyData) {
        setError('기업 정보를 불러올 수 없습니다.')
        setLoading(false)
        return
      }

      setCompany(companyData as Company)
      if (companyData.courses?.length > 0) {
        setSelectedCourse(companyData.courses[0] as Course)
        // DB에서 업로드된 파일 로드
        const courseIds = companyData.courses.map((c: Course) => c.id)
        loadUploadedFiles(courseIds)
      }
      setLoading(false)
    }

    fetchData()
  }, [])

  // 실시간 파일 업로드/삭제 구독
  useEffect(() => {
    if (!company) return

    const channel = supabase
      .channel('course-files-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'course_files',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newFile = payload.new as { course_id: string; file_type: string; file_url: string }
            // 내 회사 과정인 경우에만 업데이트
            if (company.courses.some(c => c.id === newFile.course_id)) {
              setUploadedFiles(prev => ({
                ...prev,
                [newFile.course_id]: {
                  ...prev[newFile.course_id],
                  [newFile.file_type]: newFile.file_url
                }
              }))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldFile = payload.old as { course_id: string; file_type: string }
            // 내 회사 과정인 경우에만 업데이트
            if (company.courses.some(c => c.id === oldFile.course_id)) {
              setUploadedFiles(prev => {
                const updated = { ...prev }
                if (updated[oldFile.course_id]) {
                  const courseFiles = { ...updated[oldFile.course_id] }
                  delete courseFiles[oldFile.file_type as 'businessPlan' | 'staffRegistration']
                  updated[oldFile.course_id] = courseFiles
                }
                return updated
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'courses',
        },
        (payload) => {
          const updatedCourse = payload.new as { id: string; status: string; stage: string; issues: string | null }
          if (!company.courses.some(c => c.id === updatedCourse.id)) return

          setCompany(prev => {
            if (!prev) return null
            return {
              ...prev,
              courses: prev.courses.map(c =>
                c.id === updatedCourse.id
                  ? { ...c, status: updatedCourse.status, stage: updatedCourse.stage, issues: updatedCourse.issues }
                  : c
              )
            }
          })
          setSelectedCourse(prev =>
            prev && prev.id === updatedCourse.id
              ? { ...prev, status: updatedCourse.status, stage: updatedCourse.stage, issues: updatedCourse.issues }
              : prev
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [company])

  // 기존 PDF와 업로드된 파일을 합침
  const basePdfFiles = company && selectedCourse ? getPdfFiles(company.name, selectedCourse.name) : {}
  const courseUploadedFiles = selectedCourse ? uploadedFiles[selectedCourse.id] || {} : {}
  const pdfFiles: { businessPlan?: string; staffRegistration?: string } = { ...basePdfFiles, ...courseUploadedFiles }

  const [validations, setValidations] = useState<Partial<Record<DocumentType, DocValidation>>>({})
  const [isValidating, setIsValidating] = useState(true)

  // 2·3단계 검증: 파일명 매칭(1단계)을 통과한 문서의 내용을 추출해 기준 서식과 대조한다.
  // 여기서 나오는 결과는 확인됨/누락/불일치 3단계뿐이며, 최종 승인 여부는 담당자가 판단한다.
  useEffect(() => {
    let cancelled = false
    setIsValidating(true)

    Promise.all([
      fetchDocumentValidation(pdfFiles.businessPlan, 'businessPlan'),
      fetchDocumentValidation(pdfFiles.staffRegistration, 'staffRegistration'),
    ]).then(([businessPlan, staffRegistration]) => {
      if (cancelled) return
      setValidations({ businessPlan, staffRegistration })
      setIsValidating(false)
    })

    return () => {
      cancelled = true
    }
  }, [pdfFiles.businessPlan, pdfFiles.staffRegistration])

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

  // 파일 첨부 핸들러
  const handleFileUpload = async (type: 'businessPlan' | 'staffRegistration') => {
    if (!selectedCourse || !user) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !selectedCourse) return

      setUploadingType(type)

      try {
        // Supabase Storage에 파일 업로드 (한글 파일명 제거)
        const fileExt = file.name.split('.').pop() || 'pdf'
        const safeName = `${Date.now()}.${fileExt}`
        const filePath = `${selectedCourse.id}/${type}/${safeName}`
        const { error: uploadError } = await supabase.storage
          .from('course-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          })

        if (uploadError) {
          throw new Error(`스토리지 업로드 실패: ${uploadError.message}`)
        }

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('course-files')
          .getPublicUrl(filePath)

        const fileUrl = urlData.publicUrl

        // DB에 파일 정보 저장 (upsert - 이미 있으면 업데이트)
        const { error: dbError } = await supabase
          .from('course_files')
          .upsert({
            course_id: selectedCourse.id,
            file_type: type,
            file_name: file.name,
            file_url: fileUrl,
            uploaded_by: user.id
          }, {
            onConflict: 'course_id,file_type'
          })

        if (dbError) {
          throw new Error(`DB 저장 실패: ${dbError.message}`)
        }

        // 로컬 상태 업데이트
        setUploadedFiles(prev => ({
          ...prev,
          [selectedCourse.id]: {
            ...prev[selectedCourse.id],
            [type]: fileUrl
          }
        }))

        // 파일 첨부 시 해당 과정의 주요이슈 자동 삭제
        if (selectedCourse.issues) {
          const { error: issueError } = await supabase
            .from('courses')
            .update({ issues: null })
            .eq('id', selectedCourse.id)

          if (!issueError) {
            // 로컬 상태 업데이트 - selectedCourse
            setSelectedCourse(prev => prev ? { ...prev, issues: null } : null)
            // 로컬 상태 업데이트 - company.courses
            setCompany(prev => {
              if (!prev) return null
              return {
                ...prev,
                courses: prev.courses.map(c =>
                  c.id === selectedCourse.id ? { ...c, issues: null } : c
                )
              }
            })
          }
        }

        alert(`${type === 'businessPlan' ? '사업계획서' : '전담인력 등록'} 파일이 업로드되었습니다.\n파일명: ${file.name}`)
      } catch (err) {
        alert(`파일 업로드에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      } finally {
        setUploadingType(null)
      }
    }
    input.click()
  }

  // 파일 삭제 핸들러
  const handleFileDelete = async (type: 'businessPlan' | 'staffRegistration') => {
    if (!selectedCourse || !user) return
    if (!confirm(`${type === 'businessPlan' ? '사업계획서' : '전담인력 등록'} 파일을 삭제하시겠습니까?`)) return

    try {
      // DB에서 파일 정보 삭제
      const { error: dbError } = await supabase
        .from('course_files')
        .delete()
        .eq('course_id', selectedCourse.id)
        .eq('file_type', type)

      if (dbError) {
        throw new Error(`DB 삭제 실패: ${dbError.message}`)
      }

      // 로컬 상태 업데이트
      setUploadedFiles(prev => {
        const updated = { ...prev }
        if (updated[selectedCourse.id]) {
          const courseFiles = { ...updated[selectedCourse.id] }
          delete courseFiles[type]
          updated[selectedCourse.id] = courseFiles
        }
        return updated
      })

      alert(`${type === 'businessPlan' ? '사업계획서' : '전담인력 등록'} 파일이 삭제되었습니다.`)
    } catch (err) {
      alert(`파일 삭제에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
        <Link href="/login" className="mt-4 inline-block text-blue-600 hover:underline">
          로그인 페이지로 이동
        </Link>
      </div>
    )
  }

  if (!company) return null

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-green-100 text-sm">기업 담당자 포털</p>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <p className="text-green-100">총 {company.courses.length}개 과정 운영중</p>
            </div>
          </div>
          <a
            href="https://pdms.ncs.go.kr/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-2 text-sm bg-white/15 hover:bg-white/25 rounded-lg transition flex items-center gap-1.5"
          >
            공단 제출 사이트(PDMS)
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* 자료실 - 빈 양식 다운로드 (워드/한글로 작성 후 PDF로 저장해서 첨부) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">자료실</h2>
        <p className="text-xs text-gray-500 mb-3">빈 양식을 다운로드해서 작성한 뒤, PDF로 저장해서 아래 과정별 서류란에 첨부해주세요.</p>
        <div className="flex flex-wrap gap-3">
          {(['businessPlan', 'staffRegistration'] as DocumentType[]).map((docType) => (
            <a
              key={docType}
              href={TEMPLATE_URLS[docType]}
              download
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {DOC_LABELS[docType]} 양식 (.docx)
            </a>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 과정 목록 */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            내 과정 목록
          </h2>
          {company.courses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                selectedCourse?.id === course.id
                  ? 'bg-green-50 border-green-200'
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
            </button>
          ))}
        </div>

        {/* 과정 상세 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCourse ? (
            <>
              {/* 과정 정보 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCourse.name}
                  </h2>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedCourse.status)}`}>
                    {getStatusText(selectedCourse.status)}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">현재 단계</p>
                    <p className="font-medium text-gray-900">{selectedCourse.stage}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">주요 이슈</p>
                    {(() => {
                      const issueMessages: string[] = []
                      const hasStaffDuplication = company ? checkStaffDuplication(company.name, company.courses) : false
                      if (hasStaffDuplication && validations.staffRegistration?.status === '확인됨') {
                        issueMessages.push('전담인력 중복')
                      }
                      ;(['businessPlan', 'staffRegistration'] as DocumentType[]).forEach((docType) => {
                        const result = validations[docType]
                        if (result && result.status !== '확인됨') {
                          issueMessages.push(`${DOC_LABELS[docType]} ${result.status}: ${result.reason}`)
                        }
                      })
                      const effectiveIssue = issueMessages.length > 0 ? issueMessages.join(' / ') : null
                      return (
                        <p className={`font-medium ${effectiveIssue ? 'text-red-600' : 'text-gray-400'}`}>
                          {isValidating ? '검증 중...' : effectiveIssue || '이슈 없음'}
                        </p>
                      )
                    })()}
                  </div>
                </div>

                {selectedCourse.status === 'approved' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-medium text-green-800">센터 승인 완료</p>
                      <p className="text-sm text-green-700">아래 서류를 다운로드하여 공단 제출 사이트에 첨부해주세요.</p>
                    </div>
                    <a
                      href="https://pdms.ncs.go.kr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      공단 제출 사이트(PDMS) 바로가기
                    </a>
                  </div>
                )}

                {/* 서류 제출 현황 */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">서류 제출 현황 (파일명 → 문서 내용 → 기준 서식 대조)</h3>
                  <div className="space-y-3">
                    {(['businessPlan', 'staffRegistration'] as DocumentType[]).map((docType) => {
                      const fileUrl = pdfFiles[docType]
                      const result = validations[docType]
                      const canDelete = Boolean(courseUploadedFiles[docType])

                      return (
                        <div key={docType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isValidating ? (
                              <svg className="w-5 h-5 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            ) : result?.status === '확인됨' ? (
                              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : result?.status === '불일치' ? (
                              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.492-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className="text-gray-700">{DOC_LABELS[docType]}</span>
                            {!isValidating && result && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[result.status]}`}>
                                {result.status}
                              </span>
                            )}
                            {!isValidating && result && result.status !== '확인됨' && (
                              <span className="text-xs text-gray-500 basis-full">{result.reason}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {fileUrl ? (
                              <>
                                <PdfViewerModal pdfUrl={fileUrl} />
                                {/* 공단 제출용 - 작성 완료된 실제 파일을 바로 다운로드 */}
                                <a
                                  href={fileUrl}
                                  download
                                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                                >
                                  다운로드
                                </a>
                                {/* DB에서 업로드한 파일만 삭제 가능 (기본 파일 제외) */}
                                {canDelete && (
                                  <button
                                    onClick={() => handleFileDelete(docType)}
                                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                                  >
                                    삭제
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleFileUpload(docType)}
                                disabled={uploadingType === docType}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                              >
                                {uploadingType === docType ? '업로드 중...' : '파일 첨부'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    * 자동 검증은 참고용 대조 결과입니다. 최종 서류 적합성 판단은 담당자가 직접 확인해주세요.
                  </p>
                </div>
              </div>

              {/* 댓글 섹션 */}
              <CompanyCommentSection
                courseId={selectedCourse.id}
                courseName={selectedCourse.name}
                companyName={company.name}
              />
            </>
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
