#!/bin/bash
# setup.sh - 프로젝트 빠른 설정 스크립트

echo "🚀 Cognitive Neuroscience of Memory 프로젝트 설정"
echo ""

# 1. 기본 요구사항 확인
echo "📋 요구사항 확인 중..."

# LaTeX 설치 확인
if ! command -v pdflatex >/dev/null 2>&1; then
    echo "❌ pdflatex가 설치되지 않음"
    echo "   MacTeX 또는 TeX Live를 설치해주세요"
    exit 1
else
    echo "✅ pdflatex 설치됨"
fi

# Ghostscript 설치 확인
if ! command -v gs >/dev/null 2>&1; then
    echo "⚠️  Ghostscript가 설치되지 않음"
    echo "   PDF 압축을 위해 설치를 권장합니다:"
    echo "   brew install ghostscript"
else
    echo "✅ Ghostscript 설치됨"
fi

# bibtex 확인
if ! command -v bibtex >/dev/null 2>&1; then
    echo "⚠️  bibtex가 설치되지 않음 (참고문헌 처리 제한)"
else
    echo "✅ bibtex 설치됨"
fi

echo ""

# 2. 프로젝트 구조 확인
echo "📁 프로젝트 구조 확인 중..."

if [ -f "note.tex" ]; then
    echo "✅ note.tex 발견"
else
    echo "❌ note.tex 없음"
fi

if [ -d "chapters" ]; then
    chapter_count=$(find chapters -name "*.tex" | wc -l)
    echo "✅ chapters 폴더 발견 ($chapter_count개 파일)"
else
    echo "❌ chapters 폴더 없음"
fi

if [ -f "ref.bib" ]; then
    echo "✅ ref.bib 발견"
else
    echo "⚠️  ref.bib 없음 (참고문헌 없이 진행)"
fi

echo ""

# 3. 권한 설정
echo "🔧 실행 권한 설정 중..."
chmod +x setup.sh 2>/dev/null || true
echo "✅ 권한 설정 완료"

echo ""

# 4. 사용법 안내
echo "📖 사용법:"
echo ""
echo "🚀 바로 시작하기:"
echo "   make manual       # 기존 PDF 활용 (빠름)"
echo "   make all          # 처음부터 컴파일 (느림)"
echo ""
echo "📊 현재 상태 확인:"
echo "   make status"
echo ""
echo "❓ 도움말:"
echo "   make help"
echo ""

# 5. 현재 상태 간단 요약
echo "📊 현재 상태:"
if [ -f "note.pdf" ]; then
    size=$(stat -f%z note.pdf 2>/dev/null || echo "?")
    echo "   📄 note.pdf: $size bytes"
else
    echo "   📄 note.pdf: 없음"
fi

chapter_pdfs=$(find chapters -name "*.pdf" 2>/dev/null | wc -l)
echo "   📄 챕터 PDF: ${chapter_pdfs}개"

echo ""
echo "🎉 설정 완료! 이제 'make manual' 또는 'make all'을 실행하세요."
