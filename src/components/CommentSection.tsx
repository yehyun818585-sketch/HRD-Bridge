'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string | null
  user_role: string | null
}

interface CommentSectionProps {
  courseId: string
  courseName?: string
  hasStaffIssue?: boolean // 전담인력 이슈 여부
  companyName?: string // 기업명
  totalCoursesInCompany?: number // 해당 기업의 총 과정 수
}

// 댓글 분석 함수 - 기업 댓글이 질의인지 조치완료인지 판단
const analyzeComment = (content: string): { type: 'query' | 'action_complete' | 'other', notification: string } => {
  const lowerContent = content.toLowerCase()

  // 조치 완료 관련 키워드
  const actionCompleteKeywords = ['완료', '제출', '첨부', '등록', '처리', '수정', '보완', '업로드', '했습니다', '드렸습니다', '하였습니다']
  // 질의 관련 키워드
  const queryKeywords = ['?', '어떻게', '언제', '무엇', '왜', '어디', '문의', '질문', '확인', '알려', '가능한가요', '될까요', '할까요', '인가요']

  const isActionComplete = actionCompleteKeywords.some(keyword => content.includes(keyword))
  const isQuery = queryKeywords.some(keyword => lowerContent.includes(keyword))

  if (isActionComplete && !isQuery) {
    return {
      type: 'action_complete',
      notification: `[조치완료 알림] 기업에서 요청사항을 처리했습니다: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`
    }
  } else if (isQuery) {
    return {
      type: 'query',
      notification: `[문의 알림] 기업에서 문의가 접수되었습니다: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`
    }
  } else {
    return {
      type: 'other',
      notification: `[새 댓글] 기업에서 댓글을 남겼습니다: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`
    }
  }
}

export default function CommentSection({ courseId, courseName, hasStaffIssue, companyName, totalCoursesInCompany }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [notification, setNotification] = useState<{ type: string, message: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        // 각 댓글의 user_id로 프로필 정보 가져오기
        const userIds = [...new Set(data.map(c => c.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, role')
          .in('id', userIds)

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

        const formattedComments = data.map((item) => ({
          id: item.id,
          content: item.content,
          created_at: item.created_at,
          user_id: item.user_id,
          user_name: profileMap.get(item.user_id)?.name || null,
          user_role: profileMap.get(item.user_id)?.role || null,
        }))
        setComments(formattedComments)
      }
    }

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        setUserRole(profile?.role || null)
      }
    }

    fetchComments()
    getUser()

    // 실시간 댓글 구독
    const channel = supabase
      .channel('comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `course_id=eq.${courseId}`,
        },
        async (payload) => {
          // 새 댓글의 프로필 정보 가져오기
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', payload.new.user_id)
            .single()

          const newCommentData: Comment = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
            user_name: profile?.name || null,
            user_role: profile?.role || null,
          }

          setComments((prev) => [...prev, newCommentData])

          // 기업 댓글인 경우, 센터 사용자에게 알림 표시
          if (profile?.role === 'company' && userRole === 'center') {
            const analysis = analyzeComment(payload.new.content)
            setNotification({
              type: analysis.type,
              message: analysis.notification
            })
            // 10초 후 알림 자동 제거
            setTimeout(() => setNotification(null), 10000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [courseId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setLoading(true)
    const { data, error } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: user.id,
      content: newComment.trim(),
    }).select().single()

    if (!error && data) {
      // 프로필 정보 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single()

      const newCommentData: Comment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        user_name: profile?.name || null,
        user_role: profile?.role || null,
      }
      setComments((prev) => [...prev, newCommentData])
      setNewComment('')
    }
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRoleBadge = (role: string) => {
    if (role === 'center') {
      return <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">센터</span>
    }
    return <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">기업</span>
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    }
  }

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const handleEditSubmit = async (commentId: string) => {
    if (!editContent.trim()) return

    const { error } = await supabase
      .from('comments')
      .update({ content: editContent.trim() })
      .eq('id', commentId)

    if (!error) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, content: editContent.trim() } : c
        )
      )
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditContent('')
  }

  // 전담인력 첨부 요청 버튼 클릭
  const handleStaffRequest = async () => {
    if (!user) return

    const requestMessage = `[전담인력 서류 첨부 요청] ${courseName || '해당 과정'}의 전담인력 등록 서류를 첨부해주세요. 필요 서류: 전담인력 지정서, 자격증 사본, 경력증명서`

    setLoading(true)
    const { data, error } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: user.id,
      content: requestMessage,
    }).select().single()

    if (!error && data) {
      // 프로필 정보 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single()

      const newCommentData: Comment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        user_name: profile?.name || null,
        user_role: profile?.role || null,
      }
      setComments((prev) => [...prev, newCommentData])
    }
    setLoading(false)
  }

  // 전담인력 중복 확인 요청 버튼 클릭
  const handleStaffDuplicationCheck = async () => {
    if (!user) return

    const requestMessage = `[전담인력 담당자 확인 요청] ${companyName || '귀사'}에서 운영 중인 여러 과정의 전담인력 담당자가 동일인으로 등록되어 있습니다. 해당 담당자가 복수 과정을 담당하는 것이 맞는지 확인 부탁드립니다. 다른 담당자로 변경이 필요한 경우 수정된 전담인력 등록서류를 첨부해주세요.`

    setLoading(true)
    const { data, error } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: user.id,
      content: requestMessage,
    }).select().single()

    if (!error && data) {
      // 프로필 정보 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single()

      const newCommentData: Comment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        user_name: profile?.name || null,
        user_role: profile?.role || null,
      }
      setComments((prev) => [...prev, newCommentData])
    }
    setLoading(false)
  }

  // 알림 닫기
  const closeNotification = () => {
    setNotification(null)
  }

  // 알림 배경색 결정
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'action_complete':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'query':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* 기업 댓글 알림 */}
      {notification && (
        <div className={`mb-4 p-3 rounded-lg border flex items-center justify-between ${getNotificationStyle(notification.type)}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'action_complete' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : notification.type === 'query' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={closeNotification} className="p-1 hover:bg-white/50 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          피드백 댓글
        </h3>

        <div className="flex gap-2">
          {/* 전담인력 첨부 요청 버튼 (센터 사용자 + 전담인력 이슈 있을 때만) */}
          {user && userRole === 'center' && hasStaffIssue && (
            <button
              onClick={handleStaffRequest}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center gap-1 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              첨부 요청
            </button>
          )}

          {/* 전담인력 중복 확인 요청 버튼 (센터 사용자 + 동일 기업에 2개 이상 과정 있을 때) */}
          {user && userRole === 'center' && totalCoursesInCompany && totalCoursesInCompany >= 2 && (
            <button
              onClick={handleStaffDuplicationCheck}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition flex items-center gap-1 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              담당자 확인
            </button>
          )}
        </div>
      </div>

      {/* 댓글 목록 */}
      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            아직 댓글이 없습니다. 첫 번째 피드백을 남겨보세요!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                {comment.user_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {comment.user_name || '알 수 없음'}
                  </span>
                  {comment.user_role && getRoleBadge(comment.user_role)}
                  <span className="text-xs text-gray-400">
                    {formatDate(comment.created_at)}
                  </span>
                  {user && user.id === comment.user_id && (
                    <div className="flex gap-1 ml-auto">
                      <button
                        onClick={() => handleEdit(comment)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleEditSubmit(comment.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-700">{comment.content}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 댓글 입력 */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="피드백을 입력하세요... (예: 전담인력 서류 추가 필요)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? '전송중...' : '전송'}
          </button>
        </form>
      ) : (
        <p className="text-center text-gray-500 py-4">
          댓글을 작성하려면 로그인이 필요합니다.
        </p>
      )}
    </div>
  )
}
