# 일학습병행 정보 미러링 대시보드

공동훈련센터가 기업별 일학습병행 진행 현황을 한눈에 파악하고, 댓글로 피드백을 전달할 수 있는 정보 미러링 시스템입니다.

## 주요 기능

- **정보 가시성**: 기업별 과정 진행 현황, 승인 상태, 주요 이슈를 실시간으로 확인
- **읽기 전용**: 공동훈련센터는 정보 조회만 가능, 데이터 수정 권한 없음
- **댓글 피드백**: 서류 추가/수정 요청을 댓글로 전달하여 원활한 소통
- **Google OAuth**: Google 계정으로 간편 로그인

## 기술 스택

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Authentication**: Google OAuth

## 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.local` 파일에 Supabase 연결 정보를 설정하세요:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속하세요.

## 데이터베이스 설정

Supabase SQL Editor에서 `supabase-schema.sql` 파일의 내용을 실행하여 테이블과 RLS 정책을 생성하세요.

## 스크린샷

### 홈 화면
- 대시보드 소개 및 주요 기능 안내

### 기업 현황
- 전체 기업 및 과정 목록 조회
- 승인 상태별 필터링

### 기업 상세
- 과정별 상세 정보 (현재 단계, 승인 상태, 주요 이슈)
- 서류 제출 현황 체크리스트
- 실시간 댓글 피드백
