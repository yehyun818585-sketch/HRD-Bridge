import 'server-only'
import { createClient } from '@supabase/supabase-js'

// 서비스 롤 키를 쓰는 관리자 클라이언트 - auth.admin.* (초대 메일 발송 등) 전용.
// 절대 클라이언트 컴포넌트/번들에 노출되면 안 되므로 'server-only'로 강제한다.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
