// 데모용 필수서류 PDF를 "일학습병행 지정신청 공고" 서식 스타일(서식 탭 + 제목 바 + 표 테두리)로
// 재생성하는 1회성 스크립트. 각 문서의 실제 내용(과정명/기업/전담인력 정보 등)은 기존 값을 그대로 사용한다.
// 실행: node scripts/generate-demo-pdfs.mjs
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'files')

const FONT_REGULAR = 'C:/Windows/Fonts/malgun.ttf'
const FONT_BOLD = 'C:/Windows/Fonts/malgunbd.ttf'

const MARGIN = 50
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const ACCENT = '#7a4a24'
const ACCENT_BG = '#f3ece2'

function newDoc(outFile) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN })
  doc.registerFont('KR', FONT_REGULAR)
  doc.registerFont('KR-Bold', FONT_BOLD)
  doc.pipe(fs.createWriteStream(path.join(OUT_DIR, outFile)))
  return doc
}

function drawFormTab(doc, code, title) {
  const y = MARGIN
  const tabW = 62
  const tabH = 24

  doc.rect(MARGIN, y, tabW, tabH).fill(ACCENT)
  doc.fillColor('#ffffff').font('KR-Bold').fontSize(10.5)
    .text(code, MARGIN, y + 7, { width: tabW, align: 'center' })

  doc.rect(MARGIN + tabW, y, CONTENT_WIDTH - tabW, tabH).lineWidth(1).stroke(ACCENT)
  doc.fillColor('#333333').font('KR').fontSize(9.5)
    .text(title, MARGIN + tabW + 10, y + 7)

  doc.fillColor('#000000')
  return y + tabH
}

function drawTitle(doc, y, text) {
  doc.font('KR-Bold').fontSize(19)
    .text(text, MARGIN, y + 16, { width: CONTENT_WIDTH, align: 'center' })
  const ruleY = y + 16 + 26
  doc.moveTo(MARGIN, ruleY).lineTo(MARGIN + CONTENT_WIDTH, ruleY).lineWidth(1.5).stroke(ACCENT)
  return ruleY + 16
}

function drawSection(doc, y, index, label, lines) {
  doc.rect(MARGIN, y, 4, 15).fill(ACCENT)
  doc.fillColor('#000000').font('KR-Bold').fontSize(11)
    .text(`${index}. ${label}`, MARGIN + 10, y)

  let cursorY = doc.y + 4
  doc.font('KR').fontSize(10.5)
  const list = Array.isArray(lines) ? lines : [lines]
  for (const line of list) {
    if (!line) continue
    doc.text(line, MARGIN + 10, cursorY, { width: CONTENT_WIDTH - 10 })
    cursorY = doc.y + 1
  }
  return cursorY + 9
}

// 남은 페이지 공간이 부족하면 통째로 다음 페이지로 넘긴다.
// (개별 rect/text 호출은 pdfkit이 알아서 페이지를 나누는데, 그 상태에서 수동으로 추적하는
// curY가 어긋나 표/서명란이 여러 페이지에 걸쳐 조각나는 문제가 있어 미리 막는다)
function ensureSpace(doc, y, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (y + neededHeight > bottom) {
    doc.addPage()
    return doc.page.margins.top
  }
  return y
}

function drawTable(doc, y, headers, rows, colWidths) {
  const rowHeight = 22
  y = ensureSpace(doc, y, rowHeight * (rows.length + 1))
  let curY = y

  let curX = MARGIN
  doc.font('KR-Bold').fontSize(10)
  headers.forEach((h, i) => {
    doc.lineWidth(1).rect(curX, curY, colWidths[i], rowHeight).fillAndStroke(ACCENT_BG, ACCENT)
    doc.fillColor('#000000').text(h, curX, curY + 7, { width: colWidths[i], align: 'center' })
    curX += colWidths[i]
  })
  curY += rowHeight

  doc.font('KR').fontSize(10)
  rows.forEach((row) => {
    curX = MARGIN
    row.forEach((cell, i) => {
      doc.lineWidth(1).rect(curX, curY, colWidths[i], rowHeight).stroke(ACCENT)
      const align = i === 0 || i === row.length - 1 ? 'center' : 'left'
      doc.fillColor('#000000').text(cell, curX + 6, curY + 7, { width: colWidths[i] - 12, align })
      curX += colWidths[i]
    })
    curY += rowHeight
  })

  return curY + 12
}

function drawNote(doc, y, text) {
  doc.font('KR').fontSize(10.5).fillColor('#000000')
    .text(text, MARGIN, y, { width: CONTENT_WIDTH })
  return doc.y + 14
}

function drawKeyValueLines(doc, y, lines) {
  doc.font('KR').fontSize(10.5)
  let curY = y
  for (const line of lines) {
    doc.text(line, MARGIN, curY)
    curY = doc.y + 6
  }
  return curY
}

function drawFooter(doc, pageNum) {
  // 페이지 하단 여백(margin) 안쪽에 그려야 자동 페이지 넘김이 발생하지 않는다.
  const y = doc.page.height - doc.page.margins.bottom - 18
  doc.font('KR').fontSize(9).fillColor('#666666')
    .text(`- ${pageNum} -`, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })
  doc.fillColor('#000000')
}

// 서식1(학습기업 지정신청서) 말미의 "20XX년 X월 X일 / 신청기업명 대표 성명 (인) / 한국산업인력공단 귀중"
// 구조를 참고한 서명란
function drawClosingSignature(doc, y, { date, companyName, representativeName }) {
  y = ensureSpace(doc, y, 68)
  doc.font('KR').fontSize(11)
    .text(date, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })
  let curY = doc.y + 12

  const half = CONTENT_WIDTH / 2
  doc.text(`신청기업명: ${companyName}`, MARGIN, curY, { width: half })
  doc.text(`대표 성명: ${representativeName}        (인)`, MARGIN + half, curY, { width: half, align: 'right' })
  curY = doc.y + 10

  doc.font('KR-Bold').fontSize(12)
    .text('한국산업인력공단 귀중', MARGIN, curY, { width: CONTENT_WIDTH, align: 'center' })

  return doc.y + 6
}

function renderBusinessPlan(data) {
  const doc = newDoc(data.file)
  const info = COMPANY_INFO[data.companyName]

  let y = drawFormTab(doc, '서식2', '사업계획서 (일학습병행 신청 공고 서식2 참고 양식)')
  y = drawTitle(doc, y, '사 업 계 획 서')

  y = drawSection(doc, y, 1, '프로그램 명', [data.programName])
  y = drawSection(doc, y, 2, '시행 목적', [data.purpose])
  y = drawSection(doc, y, 3, '참여 기업', [
    `기업명: ${data.companyName}`,
    `대표자명: ${info.representativeName}`,
    `사업자등록번호: ${info.businessRegNo}`,
    `업종: ${data.industry}`,
  ])
  y = drawSection(doc, y, 4, '공동훈련센터', [data.trainingCenter])
  y = drawSection(doc, y, 5, '참여 인원', data.participants)
  y = drawSection(doc, y, 6, '훈련 유형', [data.trainingType])
  y = drawSection(doc, y, 7, '교육 시행 장소', data.location)
  y = drawSection(doc, y, 8, '교육 회차별 계획 요약', [])
  y = drawTable(doc, y, ['회차', '교육 내용', '구분'], data.curriculum, [55, 345, 95])

  drawClosingSignature(doc, y, {
    date: data.submittedDate,
    companyName: data.companyName,
    representativeName: info.representativeName,
  })

  drawFooter(doc, 1)
  doc.end()
}

function renderStaffRegistration(data) {
  const doc = newDoc(data.file)
  const info = COMPANY_INFO[data.companyName]

  let y = drawFormTab(doc, '전담서식', '전담인력 등록 증빙서 (일학습병행 신청 공고 서식 참고 양식)')
  y = drawTitle(doc, y, '전담인력 등록 증빙서')

  y = drawSection(doc, y, 1, '과정명', [data.courseName])
  y = drawSection(doc, y, 2, '참여 기업', [data.companyName])
  y = drawSection(doc, y, 3, '전담인력 현황', [])
  y = drawTable(
    doc,
    y,
    ['구분', '성명', '직위', '담당 업무', '연락처'],
    [['전담인력', data.staff.name, data.staff.position, data.staff.duty, data.staff.contact]],
    [60, 65, 120, 140, 110]
  )

  y = drawNote(doc, y, '상기 전담인력은 본 과정 운영을 위해 지정되었음을 확인합니다.')

  drawClosingSignature(doc, y, {
    date: formatDate(data.confirmDate),
    companyName: data.companyName,
    representativeName: info.representativeName,
  })

  drawFooter(doc, 1)
  doc.end()
}

// 'YYYY-MM-DD' -> 'YYYY년 M월 D일' (서명란 날짜 표기를 사업계획서와 통일)
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${year}년 ${month}월 ${day}일`
}

// 현재 공동훈련센터가 1곳(서중대학교 산학협력단)으로 통일되어 있어, 참여 기업 정보도 이 맵에서 관리한다.
const COMPANY_INFO = {
  A사: { representativeName: '이하늘', businessRegNo: '108-81-23456' },
  B사: { representativeName: '정민호', businessRegNo: '215-88-45678' },
  C사: { representativeName: '한소영', businessRegNo: '301-86-78901' },
}

const businessPlans = [
  {
    file: 'A_AI개발자양성과정_사업계획서.pdf',
    programName: 'AI개발자 양성과정',
    purpose: '본 과정은 인공지능(AI) 및 데이터 기반 실무형 인재를 조기에 확보하고, 기업 맞춤형 인재 육성을 통해 중장기적인 기술 경쟁력을 강화하는 것을 목적으로 한다.',
    companyName: 'A사',
    industry: 'IT&소프트웨어 개발',
    trainingCenter: '서중대학교 산학협력단',
    participants: ['총 10명 (만 19세~24세)', '서중대학교 6명 / SY전문대 4명'],
    trainingType: 'OJT + OFF-JT 병행',
    location: ['OJT: A사 본사', 'OFF-JT: 서중대학교 컴퓨터공학 실습실'],
    submittedDate: '2024년 7월 20일',
    curriculum: [
      ['1회차', 'Python 기초 및 개발환경 구축', 'OFF-JT'],
      ['2회차', '데이터 분석 기초', 'OFF-JT'],
      ['3회차', '머신러닝 개요', 'OFF-JT'],
      ['4회차', '사내 데이터 기반 실습', 'OJT'],
      ['5회차', 'AI 모델 실무 프로젝트', 'OJT'],
      ['6회차', '성과 발표 및 피드백', 'OJT'],
    ],
  },
  {
    file: 'A_웹개발 실무과정_사업계획서.pdf',
    programName: '웹개발 실무과정 (Full-Stack 양성)',
    purpose: '본 과정은 프론트엔드 및 백엔드 기술을 아우르는 웹 개발 실무 인재를 양성하고, 현업 프로젝트 수행 능력을 갖춘 개발자를 조기에 확보하여 기업의 소프트웨어 개발 역량을 강화하는 것을 목적으로 한다.',
    companyName: 'A사',
    industry: 'IT 솔루션 및 웹 서비스 개발',
    trainingCenter: '서중대학교 산학협력단',
    participants: ['총 10명 (만 19세~24세)', '서중대학교 컴퓨터공학과 6명 / SY전문대 소프트웨어과 4명'],
    trainingType: 'OJT + OFF-JT 병행',
    location: ['OJT: A사 본사 개발팀 사무실', 'OFF-JT: 서중대학교 멀티미디어 실습실'],
    submittedDate: '2024년 7월 25일',
    curriculum: [
      ['1회차', '웹 표준(HTML/CSS) 및 JavaScript 기초', 'OFF-JT'],
      ['2회차', '프론트엔드 프레임워크(React/Vue) 활용', 'OFF-JT'],
      ['3회차', '백엔드 서버 구축(Java/Spring) 및 DB 연동', 'OFF-JT'],
      ['4회차', '사내 레거시 코드 분석 및 API 실습', 'OJT'],
      ['5회차', '웹 서비스 배포 및 성능 최적화 프로젝트', 'OJT'],
      ['6회차', '최종 웹 프로젝트 발표 및 코드 리뷰', 'OJT'],
    ],
  },
  {
    file: 'B_데이터분석 실무_사업계획서.pdf',
    programName: '데이터 분석 과정',
    purpose: '본 과정은 데이터 기반 의사결정 역량을 갖춘 실무형 인재를 조기에 확보하고, 기업의 데이터 활용 능력을 제고하여 업무 효율성을 극대화하는 것을 목적으로 한다.',
    companyName: 'B사',
    industry: '데이터 컨설팅 및 정보 서비스',
    trainingCenter: '서중대학교 산학협력단',
    participants: ['총 8명 (만23세 ~ 29세)', '서중대학교/ SY전문대 졸업(예정)자'],
    trainingType: 'OFF-JT 중심',
    location: ['서중대학교 산학협력단 전산교육실'],
    submittedDate: '2024년 8월 10일',
    curriculum: [
      ['1회차', '데이터 분석 개요 및 분석 환경 이해', 'OFF-JT'],
      ['2회차', '엑셀·SQL 기반 데이터 전처리', 'OFF-JT'],
      ['3회차', 'Python 데이터 분석 기초', 'OFF-JT'],
      ['4회차', '시각화 및 리포트 작성', 'OFF-JT'],
      ['5회차', '업무 데이터 분석 실습', 'OFF-JT'],
      ['6회차', '최종 프로젝트 및 발표', 'OFF-JT'],
    ],
  },
  {
    file: 'B_클라우드 엔지니어 과정_사업계획서.pdf',
    programName: '클라우드 엔지니어 과정',
    purpose: '본 과정은 클라우드 환경으로의 전환 가속화에 맞춰 서버 가상화 및 인프라 운영 능력을 갖춘 전문 엔지니어를 확보하고, 안정적인 시스템 운영을 통해 기업의 기술 신뢰도를 높이는 것을 목적으로 한다.',
    companyName: 'B사',
    industry: 'IT 인프라 솔루션 및 클라우드 서비스(MSP)',
    trainingCenter: '서중대학교 산학협력단',
    participants: ['총 8명 (만 23세 ~ 29세)', '컴퓨터공학 및 정보통신 관련 전공 졸업 예정자'],
    trainingType: 'OJT 중심',
    location: ['B사 서버 관제실 및 기술지원팀'],
    submittedDate: '2024년 8월 12일',
    curriculum: [
      ['1회차', '부서 배치 및 자사 클라우드 아키텍처 분석', 'OJT'],
      ['2회차', '리눅스(Linux) 서버 접속 및 운영 환경 세팅', 'OJT'],
      ['3회차', '퍼블릭 클라우드 자원 생성 및 인프라 구성 실무', 'OJT'],
      ['4회차', '컨테이너(Docker) 서비스 배포 및 모니터링 보조', 'OJT'],
      ['5회차', '클라우드 보안 설정 점검 및 이슈 트래킹', 'OJT'],
      ['6회차', '실무 프로젝트 결과 보고 및 멘토 피드백', 'OJT'],
    ],
  },
  {
    file: 'C_보안전문가 과정_사업계획서.pdf',
    programName: '보안전문가 과정',
    purpose: '본 과정은 고도화되는 사이버 위협에 대응할 수 있는 실무형 보안 관제 및 침해 대응 인력을 조기에 확보하고, 기업의 정보 자산 보호 및 보안 기술 경쟁력을 강화하는 것을 목적으로 한다.',
    companyName: 'C사',
    industry: 'IT 보안 솔루션 및 통합 관제 서비스',
    trainingCenter: '서중대학교 산학협력단',
    participants: ['총 10명 (대졸 예정자 및 미취업자)', '정보보호학 및 컴퓨터공학 전공자'],
    trainingType: 'OJT + OFF-JT 병행',
    location: ['OJT: C사 보안관제센터(SOC)', 'OFF-JT: 서중대학교 산학협력단 정보보안 실습실'],
    submittedDate: '2024년 9월 15일',
    curriculum: [
      ['1회차', '정보보안 개요 및 네트워크 구조 이해', 'OFF-JT'],
      ['2회차', '시스템(Linux/Windows) 보안 및 로그 분석', 'OFF-JT'],
      ['3회차', '웹 어플리케이션 취약점 진단 실습', 'OFF-JT'],
      ['4회차', '보안 장비(방화벽, IPS) 운영 및 관제 실무', 'OJT'],
      ['5회차', '모의 해킹 및 침해 사고 대응 프로젝트', 'OJT'],
      ['6회차', '보안 리포팅 작성 및 최종 성과 발표', 'OJT'],
    ],
  },
]

const staffRegistrations = [
  {
    file: 'A_웹개발 실무과정_전담인력등록.pdf',
    courseName: '웹개발 실무과정 (Full-Stack 양성)',
    companyName: 'A사',
    staff: { name: '김민수', position: '책임연구원', duty: '훈련 운영 및 멘토링', contact: '010-9876-5432' },
    confirmDate: '2024-08-01',
  },
  {
    file: 'B_전담인력등록.pdf',
    courseName: '클라우드 인프라 구축 및 엔지니어 실무 과정',
    companyName: 'B사',
    staff: { name: '박진호', position: '현장 훈련(OJT) 총괄', duty: '훈련 운영 및 멘토링', contact: '010-5555-7777' },
    confirmDate: '2024-08-16',
  },
  {
    file: 'C_정보보안 과정_전담인력등록.pdf',
    courseName: '정보보안 전문가 과정',
    companyName: 'C사',
    staff: { name: '최영희', position: '수석', duty: '교육 운영 및 성과관리', contact: '010-1111-2222' },
    confirmDate: '2024-09-20',
  },
]

if (!fs.existsSync(FONT_REGULAR) || !fs.existsSync(FONT_BOLD)) {
  console.error('맑은 고딕 폰트를 찾을 수 없습니다:', FONT_REGULAR, FONT_BOLD)
  process.exit(1)
}

businessPlans.forEach(renderBusinessPlan)
staffRegistrations.forEach(renderStaffRegistration)

console.log(`생성 완료: 사업계획서 ${businessPlans.length}건, 전담인력 등록 ${staffRegistrations.length}건 → ${OUT_DIR}`)
