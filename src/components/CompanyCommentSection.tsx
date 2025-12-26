'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string | null
  user_role: string | null
}

interface CompanyCommentSectionProps {
  courseId: string
  courseName?: string
  companyName?: string
}

export default function CompanyCommentSection({ courseId, courseName, companyName }: CompanyCommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [notification, setNotification] = useState<{ type: string, message: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const supabase = createClient()

  // 댓글 로드
  useEffect(() => {
    const fetchComments = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      console.log('[CompanyCommentSection] Current user:', currentUser?.id)
      console.log('[CompanyCommentSection] Fetching comments for courseId:', courseId)
      setUser(currentUser)

      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles!comments_user_id_fkey (
            name,
            role
          )
        `)
        .eq('course_id', courseId)
        .order('created_at', { ascending: true })

      console.log('[CompanyCommentSection] Comments fetched:', data, 'Error:', error)

      if (data) {
        const formattedComments = data.map((c: { id: string; content: string; created_at: string; user_id: string; profiles: { name: string; role: string } | null }) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          user_id: c.user_id,
          user_name: c.profiles?.name || null,
          user_role: c.profiles?.role || null,
        }))
        setComments(formattedComments)

        // 센터에서 온 읽지 않은 댓글 수 계산 (센터 역할 댓글 중 최근 것)
        const centerComments = formattedComments.filter((c: Comment) => c.user_role === 'center')
        setUnreadCount(centerComments.length > 0 ? 1 : 0) // 간단하게 표시
      }
    }

    fetchComments()

    // 실시간 구독 (CommentSection과 동일한 채널명 사용)
    const channel = supabase
      .channel(`course-comments-${courseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `course_id=eq.${courseId}`,
        },
        async (payload) => {
          // 자신이 방금 추가한 댓글은 무시 (handleSubmit에서 이미 추가됨)
          const currentUser = await supabase.auth.getUser()
          if (payload.new.user_id === currentUser.data.user?.id) {
            return
          }

          // 새 댓글 도착 시 프로필 정보 가져오기
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

          // 센터에서 온 댓글이면 알림 표시
          if (profile?.role === 'center') {
            setNotification({
              type: 'center_request',
              message: `[센터 요청] ${payload.new.content.slice(0, 50)}${payload.new.content.length > 50 ? '...' : ''}`
            })
            setUnreadCount(prev => prev + 1)
          }

          setComments((prev) => [...prev, newCommentData])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [courseId, user?.id])

  // 댓글 작성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setLoading(true)
    const { data, error } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: user.id,
      content: newComment,
    }).select().single()

    if (!error && data) {
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

  // 조치 완료 버튼
  const handleActionComplete = async () => {
    if (!user) return

    const message = `[조치 완료] ${courseName || '해당 과정'}에 대한 요청사항을 처리 완료하였습니다. 확인 부탁드립니다.`

    setLoading(true)
    const { data, error } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: user.id,
      content: message,
    }).select().single()

    if (!error && data) {
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
      setUnreadCount(0) // 조치 완료 시 읽음 처리
    }
    setLoading(false)
  }

  // 댓글 삭제
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

  // 댓글 수정 시작
  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  // 댓글 수정 저장
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

  // 댓글 수정 취소
  const handleEditCancel = () => {
    setEditingId(null)
    setEditContent('')
  }

  // 알림 닫기
  const closeNotification = () => {
    setNotification(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* 알림 배너 */}
      {notification && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-blue-800 text-sm">{notification.message}</span>
          </div>
          <button onClick={closeNotification} className="text-blue-600 hover:text-blue-800">
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
          센터 피드백
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>

        {/* 조치 완료 버튼 */}
        {user && unreadCount > 0 && (
          <button
            onClick={handleActionComplete}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            조치 완료
          </button>
        )}
      </div>

      {/* 댓글 목록 */}
      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            센터의 피드백이 없습니다.
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg ${
                comment.user_role === 'center'
                  ? 'bg-blue-50 border border-blue-100'
                  : 'bg-green-50 border border-green-100 ml-8'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    comment.user_role === 'center' ? 'text-blue-700' : 'text-green-700'
                  }`}>
                    {comment.user_role === 'center' ? '센터 담당자' : companyName || '기업'}
                  </span>
                  {comment.user_name && (
                    <span className="text-xs text-gray-500">({comment.user_name})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                  {user && user.id === comment.user_id && (
                    <div className="flex gap-1">
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
              </div>
              {editingId === comment.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={() => handleEditSubmit(comment.id)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
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
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.content}</p>
              )}
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
            placeholder="센터에 문의하거나 답변을 남겨주세요..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            전송
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
