export type Role = 'company' | 'center'

export interface Profile {
  id: string
  email: string
  name: string
  role: Role
  company_id?: string | null
  created_at: string
}

export interface Company {
  id: string
  name: string
  created_at: string
}

export interface Course {
  id: string
  company_id: string
  name: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  stage: string
  issues: string | null
  created_at: string
  company?: Company
}

export interface Comment {
  id: string
  course_id: string
  user_id: string
  content: string
  created_at: string
  profile?: Profile
}
