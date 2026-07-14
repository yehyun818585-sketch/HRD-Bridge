'use client'

// 댓글 insert 직후 fire-and-forget으로 호출 - 이메일 발송 실패가 댓글 작성 자체를
// 막으면 안 되므로 결과를 기다리지 않고 에러도 조용히 무시한다.
export function notifyComment(commentId: string) {
  fetch('/api/notify-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commentId }),
  }).catch(() => {})
}
