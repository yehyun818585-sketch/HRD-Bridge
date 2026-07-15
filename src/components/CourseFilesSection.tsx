'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import PdfViewerModal from './PdfViewerModal'
import type { DocumentType } from '@/lib/document-validation'
import { DOC_LABELS, STATUS_BADGE, fetchDocumentValidation, type DocValidation } from '@/lib/document-validation-client'

interface CourseFilesSectionProps {
  courseId: string
  companyName: string
  courseName: string
  hasStaffDuplication?: boolean
  initialPdfFiles: { businessPlan?: string; staffRegistration?: string }
}

export default function CourseFilesSection({
  courseId,
  companyName,
  courseName,
  hasStaffDuplication = false,
  initialPdfFiles,
}: CourseFilesSectionProps) {
  const [uploadedFiles, setUploadedFiles] = useState<{ businessPlan?: string; staffRegistration?: string }>({})
  const [validations, setValidations] = useState<Partial<Record<DocumentType, DocValidation>>>({})
  const [isValidating, setIsValidating] = useState(true)
  const supabase = createClient()

  // DB에서 업로드된 파일 로드
  useEffect(() => {
    const loadUploadedFiles = async () => {
      const { data } = await supabase
        .from('course_files')
        .select('file_type, file_url')
        .eq('course_id', courseId)

      if (data && data.length > 0) {
        const filesMap: { businessPlan?: string; staffRegistration?: string } = {}
        data.forEach((file) => {
          filesMap[file.file_type as 'businessPlan' | 'staffRegistration'] = file.file_url
        })
        setUploadedFiles(filesMap)
      }
    }

    loadUploadedFiles()
  }, [courseId])

  // 실시간 파일 업로드 및 이슈 변경 구독
  useEffect(() => {
    const channel = supabase
      .channel(`course-files-${courseId}`)
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
            if (newFile.course_id === courseId) {
              setUploadedFiles(prev => ({
                ...prev,
                [newFile.file_type]: newFile.file_url
              }))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldFile = payload.old as { course_id: string; file_type: string }
            if (oldFile.course_id === courseId) {
              setUploadedFiles(prev => {
                const updated = { ...prev }
                delete updated[oldFile.file_type as 'businessPlan' | 'staffRegistration']
                return updated
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [courseId])

  // 기존 PDF와 업로드된 파일 합침
  const pdfFiles = { ...initialPdfFiles, ...uploadedFiles }

  // 2·3단계 검증: 파일명 매칭(1단계)을 통과한 문서의 내용을 추출해 기준 서식과 대조한다.
  // 여기서 나오는 결과는 확인됨/누락/불일치 3단계뿐이며, 최종 승인 여부는 사람이 판단한다.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setIsValidating(true)
      const [businessPlan, staffRegistration] = await Promise.all([
        fetchDocumentValidation(pdfFiles.businessPlan, 'businessPlan', companyName, courseName),
        fetchDocumentValidation(pdfFiles.staffRegistration, 'staffRegistration', companyName, courseName),
      ])
      if (cancelled) return
      setValidations({ businessPlan, staffRegistration })
      setIsValidating(false)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [pdfFiles.businessPlan, pdfFiles.staffRegistration, companyName, courseName])

  // displayIssue 계산 - 문서 검증 결과(확인됨/누락/불일치) + 중복 체크를 종합한다
  const issueMessages: string[] = []

  if (hasStaffDuplication && validations.staffRegistration?.status === '확인됨') {
    issueMessages.push('전담인력 중복')
  }

  ;(Object.keys(DOC_LABELS) as DocumentType[]).forEach((docType) => {
    const result = validations[docType]
    if (result && result.status !== '확인됨') {
      issueMessages.push(`${DOC_LABELS[docType]} ${result.status}: ${result.reason}`)
    }
  })

  const displayIssue = issueMessages.length > 0 ? issueMessages.join(' / ') : null

  const renderDocRow = (docType: DocumentType, fileUrl?: string) => {
    const result = validations[docType]

    return (
      <div className="flex items-start gap-2">
        {isValidating ? (
          <svg className="w-5 h-5 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : result?.status === '확인됨' ? (
          <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : result?.status === '불일치' ? (
          <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.492-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-700">{DOC_LABELS[docType]}</span>
            {!isValidating && result && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[result.status]}`}>
                {result.status}
              </span>
            )}
            {fileUrl && <PdfViewerModal pdfUrl={fileUrl} />}
          </div>
          {!isValidating && result && result.status !== '확인됨' && (
            <p className="text-xs text-gray-500 mt-0.5">{result.reason}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      {/* 주요이슈 (실시간 업데이트) */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500 mb-1">주요 이슈</p>
        <p className={`font-medium ${displayIssue ? 'text-red-600' : 'text-gray-400'}`}>
          {isValidating ? '검증 중...' : displayIssue || '이슈 없음'}
        </p>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">서류 제출 현황 (파일명 → 문서 내용 → 기준 서식 대조)</h3>
      <div className="space-y-3">
        {renderDocRow('businessPlan', pdfFiles.businessPlan)}
        {renderDocRow('staffRegistration', pdfFiles.staffRegistration)}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        * 자동 검증은 참고용 대조 결과입니다. 최종 서류 적합성 판단은 담당자가 직접 확인해주세요.
      </p>
    </div>
  )
}
