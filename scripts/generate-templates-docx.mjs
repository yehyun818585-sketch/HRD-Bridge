// 기업이 다운로드해서 한글/워드로 직접 채워 넣을 수 있는 빈 양식(.docx)을 생성하는 스크립트.
// PDF는 편집이 어려워서(pdfkit으로 만든 정적 문서) 워드 형식으로 별도 제공한다.
// 실행: node scripts/generate-templates-docx.mjs
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  HeadingLevel,
} from 'docx'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'files', 'templates')
fs.mkdirSync(OUT_DIR, { recursive: true })

const ACCENT = '7A4A24'
const ACCENT_BG = 'F3ECE2'

function title(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  })
}

function subtitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: '666666', italics: true })],
    spacing: { after: 300 },
  })
}

function sectionHeading(index, label) {
  return new Paragraph({
    children: [new TextRun({ text: `${index}. ${label}`, bold: true, size: 24 })],
    spacing: { before: 200, after: 80 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT, space: 6 } },
  })
}

// 빈 칸 - 아래 테두리만 그어서 손/타이핑으로 채우도록 유도
function blankLine() {
  return new Paragraph({
    children: [new TextRun({ text: ' ' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA', space: 4 } },
    spacing: { after: 200 },
  })
}

function plainLine(text) {
  return new Paragraph({ children: [new TextRun({ text })], spacing: { after: 200 } })
}

function cell(text, { header = false, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: header ? { type: ShadingType.SOLID, color: ACCENT_BG, fill: ACCENT_BG } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: header })],
      }),
    ],
  })
}

function curriculumTable() {
  const header = new TableRow({
    children: [cell('회차', { header: true, width: 1200 }), cell('교육 내용', { header: true, width: 6500 }), cell('구분', { header: true, width: 1800 })],
  })
  const rows = [1, 2, 3, 4, 5, 6].map(
    (n) =>
      new TableRow({
        children: [cell(`${n}회차`), cell(''), cell('')],
      })
  )
  return new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [header, ...rows] })
}

function staffTable() {
  const header = new TableRow({
    children: [
      cell('구분', { header: true, width: 1300 }),
      cell('성명', { header: true, width: 1500 }),
      cell('직위', { header: true, width: 2000 },),
      cell('담당 업무', { header: true, width: 3200 }),
      cell('연락처', { header: true, width: 1500 }),
    ],
  })
  const row = new TableRow({ children: [cell('전담인력'), cell(''), cell(''), cell(''), cell('')] })
  return new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [header, row] })
}

function closingSignature() {
  return [
    new Paragraph({ text: '', spacing: { before: 300 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '20        년        월        일' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      tabStops: [{ type: 'right', position: 9000 }],
      children: [
        new TextRun({ text: '신청기업명: ' }),
        new TextRun({ text: '_______________________' }),
        new TextRun({ text: '\t대표 성명: ' }),
        new TextRun({ text: '_______________  (인)' }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '한국산업인력공단 귀중', bold: true, size: 26 })],
    }),
  ]
}

async function writeDoc(fileName, children) {
  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(path.join(OUT_DIR, fileName), buffer)
}

async function main() {
  await writeDoc('사업계획서_양식.docx', [
    subtitle('서식2 (일학습병행 신청 공고 서식2 참고 양식) - 빈 양식, 워드/한글에서 편집 후 PDF로 저장해서 첨부하세요.'),
    title('사 업 계 획 서'),
    sectionHeading(1, '프로그램 명'),
    blankLine(),
    sectionHeading(2, '시행 목적'),
    blankLine(),
    blankLine(),
    sectionHeading(3, '참여 기업 (기업명 / 대표자명 / 사업자등록번호 / 업종)'),
    blankLine(),
    blankLine(),
    sectionHeading(4, '공동훈련센터'),
    plainLine('서중대학교 산학협력단'),
    sectionHeading(5, '참여 인원'),
    blankLine(),
    blankLine(),
    sectionHeading(6, '훈련 유형'),
    blankLine(),
    sectionHeading(7, '교육 시행 장소'),
    blankLine(),
    blankLine(),
    sectionHeading(8, '교육 회차별 계획 요약'),
    curriculumTable(),
    ...closingSignature(),
  ])

  await writeDoc('전담인력등록_양식.docx', [
    subtitle('전담인력 등록 증빙서 (일학습병행 신청 공고 서식 참고 양식) - 빈 양식, 워드/한글에서 편집 후 PDF로 저장해서 첨부하세요.'),
    title('전담인력 등록 증빙서'),
    sectionHeading(1, '과정명'),
    blankLine(),
    sectionHeading(2, '참여 기업'),
    blankLine(),
    sectionHeading(3, '전담인력 현황'),
    staffTable(),
    new Paragraph({ text: '', spacing: { before: 200 } }),
    plainLine('상기 전담인력은 본 과정 운영을 위해 지정되었음을 확인합니다.'),
    ...closingSignature(),
  ])

  console.log(`생성 완료: 빈 양식(.docx) 2건 → ${OUT_DIR}`)
}

main()
