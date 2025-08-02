# 기존 구조 유지하면서 개별 챕터 컴파일 지원
MAIN = note
CHAPTERS = ch1 ch3 ch4 ch6 ch8
CHAPTER_DIR = chapters
OUTPUT_DIR = output
COMPRESSED_DIR = compressed

.PHONY: all clean setup-dirs compress-all chapters manual help status
.PHONY: $(CHAPTERS)

# 기본 실행: 전체 + 개별 챕터 + 압축
all: setup-dirs compile-main compile-chapters compress-all

# 빠른 실행: 기존 PDF들 활용
manual: setup-dirs copy-existing compress-all

# 디렉토리 생성
setup-dirs:
	@echo "📁 폴더 생성 중..."
	@mkdir -p $(OUTPUT_DIR)
	@mkdir -p $(COMPRESSED_DIR)
	@echo "✅ 폴더 생성 완료"

# 메인 문서 컴파일
compile-main: $(MAIN).pdf
	@echo "📋 메인 문서를 output으로 복사..."
	@cp $(MAIN).pdf $(OUTPUT_DIR)/
	@echo "✅ $(MAIN).pdf → $(OUTPUT_DIR)/"

$(MAIN).pdf: $(MAIN).tex
	@echo "📖 메인 문서 컴파일 중..."
	pdflatex $(MAIN).tex
	@if [ -f $(MAIN).aux ]; then \
		echo "📚 참고문헌 처리 중..."; \
		bibtex $(MAIN) 2>/dev/null || echo "⚠️ bibtex 오류 무시하고 계속"; \
		pdflatex $(MAIN).tex >/dev/null 2>&1 || true; \
		pdflatex $(MAIN).tex >/dev/null 2>&1 || true; \
	fi
	@if [ -f $(MAIN).pdf ]; then \
		echo "✅ 메인 문서 컴파일 완료"; \
	else \
		echo "❌ 메인 문서 컴파일 실패"; \
	fi

# 모든 개별 챕터 컴파일
compile-chapters: chapters

chapters: $(CHAPTERS)

# 개별 챕터 컴파일 규칙
$(CHAPTERS): %: $(CHAPTER_DIR)/%.pdf
	@echo "✅ $@ 컴파일 완료"

$(CHAPTER_DIR)/%.pdf: $(CHAPTER_DIR)/%.tex
	@echo "📄 개별 챕터 컴파일: $*"
	@echo "   파일: $<"
	@cd $(CHAPTER_DIR) && \
	pdflatex -interaction=nonstopmode $*.tex >/dev/null 2>&1 && \
	echo "   ✅ $*.pdf 생성 완료" || echo "   ⚠️ $*.pdf 생성 실패 (계속 진행)"
	@if [ -f $(CHAPTER_DIR)/$*.pdf ]; then \
		cp $(CHAPTER_DIR)/$*.pdf $(OUTPUT_DIR)/; \
		echo "   📁 $(OUTPUT_DIR)/$*.pdf로 복사"; \
	fi

# 기존 PDF들을 output으로 복사
copy-existing:
	@echo "📋 기존 PDF들 복사 중..."
	@copied=0; \
	if [ -f $(MAIN).pdf ]; then \
		cp $(MAIN).pdf $(OUTPUT_DIR)/; \
		echo "✅ $(MAIN).pdf 복사"; \
		copied=$$((copied + 1)); \
	fi; \
	for chapter in $(CHAPTERS); do \
		if [ -f $(CHAPTER_DIR)/$$chapter.pdf ]; then \
			cp $(CHAPTER_DIR)/$$chapter.pdf $(OUTPUT_DIR)/; \
			echo "✅ $$chapter.pdf 복사"; \
			copied=$$((copied + 1)); \
		elif [ -f $$chapter.pdf ]; then \
			cp $$chapter.pdf $(OUTPUT_DIR)/; \
			echo "✅ $$chapter.pdf 복사"; \
			copied=$$((copied + 1)); \
		fi; \
	done; \
	echo "📊 총 $$copied개 파일 복사 완료"

# PDF 압축
compress-all: setup-dirs
	@echo "🗜️ PDF 압축 시작..."
	@if ! command -v gs >/dev/null 2>&1; then \
		echo "❌ Ghostscript가 설치되지 않음"; \
		echo "   설치: brew install ghostscript"; \
		exit 1; \
	fi
	@compressed=0; failed=0; \
	for pdf in $(OUTPUT_DIR)/*.pdf; do \
		if [ -f "$$pdf" ]; then \
			filename=$$(basename "$$pdf" .pdf); \
			echo "   🗜️ 압축 중: $$filename.pdf"; \
			if gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH -dPrinted=false -sOutputFile=$(COMPRESSED_DIR)/$$filename-compressed.pdf "$$pdf" 2>/dev/null; then \
				original_size=$$(stat -f%z "$$pdf" 2>/dev/null || echo "0"); \
				compressed_size=$$(stat -f%z "$(COMPRESSED_DIR)/$$filename-compressed.pdf" 2>/dev/null || echo "0"); \
				if [ $$original_size -gt 0 ] && [ $$compressed_size -gt 0 ]; then \
					ratio=$$(echo "scale=0; $$compressed_size * 100 / $$original_size" | bc 2>/dev/null || echo "?"); \
					echo "   ✅ $$filename-compressed.pdf ($$ratio%)"; \
				else \
					echo "   ✅ $$filename-compressed.pdf"; \
				fi; \
				compressed=$$((compressed + 1)); \
			else \
				echo "   ❌ $$filename.pdf 압축 실패"; \
				failed=$$((failed + 1)); \
			fi; \
		fi; \
	done; \
	echo "🎉 압축 완료: 성공 $$compressed개, 실패 $$failed개"

# 현재 상태 확인
status:
	@echo "📊 현재 상태 확인"
	@echo ""
	@echo "📄 메인 문서:"
	@if [ -f $(MAIN).pdf ]; then \
		size=$$(ls -lh $(MAIN).pdf | awk '{print $$5}'); \
		echo "   ✅ $(MAIN).pdf ($$size)"; \
	else \
		echo "   ❌ $(MAIN).pdf 없음"; \
	fi
	@echo ""
	@echo "📄 개별 챕터:"
	@for chapter in $(CHAPTERS); do \
		if [ -f $(CHAPTER_DIR)/$$chapter.pdf ]; then \
			size=$$(ls -lh $(CHAPTER_DIR)/$$chapter.pdf | awk '{print $$5}'); \
			echo "   ✅ $$chapter.pdf ($$size)"; \
		else \
			echo "   ❌ $$chapter.pdf 없음"; \
		fi; \
	done
	@echo ""
	@echo "📁 Output 폴더 ($(OUTPUT_DIR)):"
	@if [ -d $(OUTPUT_DIR) ] && [ "$$(ls -A $(OUTPUT_DIR) 2>/dev/null)" ]; then \
		ls -lh $(OUTPUT_DIR)/ | grep -v "^total" | awk '{print "   " $$9 " (" $$5 ")"}'; \
	else \
		echo "   (비어있음)"; \
	fi
	@echo ""
	@echo "📁 Compressed 폴더 ($(COMPRESSED_DIR)):"
	@if [ -d $(COMPRESSED_DIR) ] && [ "$$(ls -A $(COMPRESSED_DIR) 2>/dev/null)" ]; then \
		ls -lh $(COMPRESSED_DIR)/ | grep -v "^total" | awk '{print "   " $$9 " (" $$5 ")"}'; \
	else \
		echo "   (비어있음)"; \
	fi

# 정리
clean:
	@echo "🧹 임시 파일 정리..."
	@rm -f *.aux *.log *.toc *.bbl *.blg *.out *.idx *.ind *.ilg *.fdb_latexmk *.fls *.synctex.gz
	@rm -f $(CHAPTER_DIR)/*.aux $(CHAPTER_DIR)/*.log $(CHAPTER_DIR)/*.bbl $(CHAPTER_DIR)/*.blg $(CHAPTER_DIR)/*.out $(CHAPTER_DIR)/*.fdb_latexmk $(CHAPTER_DIR)/*.fls $(CHAPTER_DIR)/*.synctex.gz
	@echo "✅ 정리 완료"

distclean: clean
	@echo "🗑️ 모든 생성 파일 삭제..."
	@rm -rf $(OUTPUT_DIR) $(COMPRESSED_DIR)
	@rm -f $(MAIN).pdf $(CHAPTER_DIR)/*.pdf
	@echo "✅ 삭제 완료"

# 도움말
help:
	@echo "🎯 목적: 전체 문서 + 개별 챕터 PDF 생성 및 압축"
	@echo ""
	@echo "🚀 사용법:"
	@echo ""
	@echo "📖 전체 과정:"
	@echo "   make all          - 메인 + 모든 챕터 컴파일 + 압축"
	@echo "   make manual       - 기존 PDF들 활용 + 압축 (빠름)"
	@echo ""
	@echo "📄 개별 작업:"
	@echo "   make compile-main - 메인 문서만 컴파일"
	@echo "   make chapters     - 모든 개별 챕터 컴파일"
	@echo "   make ch1          - ch1만 컴파일"
	@echo "   make ch3          - ch3만 컴파일"
	@echo ""
	@echo "🗜️ 압축:"
	@echo "   make compress-all - output 폴더의 모든 PDF 압축"
	@echo ""
	@echo "📊 확인:"
	@echo "   make status       - 현재 상태 상세 확인"
	@echo ""
	@echo "🧹 정리:"
	@echo "   make clean        - 임시 파일 정리"
	@echo "   make distclean    - 모든 생성 파일 삭제"
	@echo ""
	@echo "💡 주의사항:"
	@echo "   - 개별 챕터 컴파일을 위해서는 각 chapters/*.tex 파일 상단에"
	@echo "     \\documentclass[../note.tex]{subfiles} 추가 필요"
	@echo "   - 기존 내용은 \\begin{document}...\\end{document}로 감싸기"

# 특별 타겟: 챕터 파일 준비 확인
check-chapters:
	@echo "📋 챕터 파일 subfiles 설정 확인 중..."
	@for chapter in $(CHAPTERS); do \
		if [ -f $(CHAPTER_DIR)/$$chapter.tex ]; then \
			if grep -q "documentclass.*subfiles" $(CHAPTER_DIR)/$$chapter.tex; then \
				echo "   ✅ $$chapter.tex - subfiles 설정됨"; \
			else \
				echo "   ⚠️ $$chapter.tex - subfiles 설정 필요"; \
				echo "      파일 상단에 다음 추가:"; \
				echo "      \\documentclass[../note.tex]{subfiles}"; \
				echo "      \\begin{document}"; \
				echo "      (기존 내용)"; \
				echo "      \\end{document}"; \
			fi; \
		else \
			echo "   ❌ $$chapter.tex 파일 없음"; \
		fi; \
	done
	
# # 기존 구조 유지하면서 개별 챕터 컴파일 지원
# MAIN = note
# CHAPTERS = ch1 ch3 ch4 ch6 ch8
# CHAPTER_DIR = chapters
# OUTPUT_DIR = output
# COMPRESSED_DIR = compressed

# .PHONY: all clean setup-dirs compress-all chapters manual help status
# .PHONY: $(CHAPTERS)

# # 기본 실행: 전체 + 개별 챕터 + 압축
# all: setup-dirs compile-main compile-chapters compress-all

# # 빠른 실행: 기존 PDF들 활용
# manual: setup-dirs copy-existing compress-all

# # 디렉토리 생성
# setup-dirs:
# 	@echo "📁 폴더 생성 중..."
# 	@mkdir -p $(OUTPUT_DIR)
# 	@mkdir -p $(COMPRESSED_DIR)
# 	@echo "✅ 폴더 생성 완료"

# # 메인 문서 컴파일
# compile-main: $(MAIN).pdf
# 	@echo "📋 메인 문서를 output으로 복사..."
# 	@cp $(MAIN).pdf $(OUTPUT_DIR)/
# 	@echo "✅ $(MAIN).pdf → $(OUTPUT_DIR)/"

# $(MAIN).pdf: $(MAIN).tex
# 	@echo "📖 메인 문서 컴파일 중..."
# 	pdflatex $(MAIN).tex
# 	@if [ -f $(MAIN).aux ]; then \
# 		echo "📚 참고문헌 처리 중..."; \
# 		bibtex $(MAIN) 2>/dev/null || echo "⚠️ bibtex 오류 무시하고 계속"; \
# 		pdflatex $(MAIN).tex >/dev/null 2>&1 || true; \
# 		pdflatex $(MAIN).tex >/dev/null 2>&1 || true; \
# 	fi
# 	@if [ -f $(MAIN).pdf ]; then \
# 		echo "✅ 메인 문서 컴파일 완료"; \
# 	else \
# 		echo "❌ 메인 문서 컴파일 실패"; \
# 	fi

# # 모든 개별 챕터 컴파일
# compile-chapters: chapters

# chapters: $(CHAPTERS)

# # 개별 챕터 컴파일 규칙
# $(CHAPTERS): %: $(CHAPTER_DIR)/%.pdf
# 	@echo "✅ $@ 컴파일 완료"

# $(CHAPTER_DIR)/%.pdf: $(CHAPTER_DIR)/%.tex
# 	@echo "📄 개별 챕터 컴파일: $*"
# 	@echo "   파일: $<"
# 	@cd $(CHAPTER_DIR) && \
# 	pdflatex -interaction=nonstopmode $*.tex >/dev/null 2>&1 && \
# 	echo "   ✅ $*.pdf 생성 완료" || echo "   ⚠️ $*.pdf 생성 실패 (계속 진행)"
# 	@if [ -f $(CHAPTER_DIR)/$*.pdf ]; then \
# 		cp $(CHAPTER_DIR)/$*.pdf $(OUTPUT_DIR)/; \
# 		echo "   📁 $(OUTPUT_DIR)/$*.pdf로 복사"; \
# 	fi

# # 기존 PDF들을 output으로 복사
# copy-existing:
# 	@echo "📋 기존 PDF들 복사 중..."
# 	@copied=0; \
# 	if [ -f $(MAIN).pdf ]; then \
# 		cp $(MAIN).pdf $(OUTPUT_DIR)/; \
# 		echo "✅ $(MAIN).pdf 복사"; \
# 		copied=$$((copied + 1)); \
# 	fi; \
# 	for chapter in $(CHAPTERS); do \
# 		if [ -f $(CHAPTER_DIR)/$$chapter.pdf ]; then \
# 			cp $(CHAPTER_DIR)/$$chapter.pdf $(OUTPUT_DIR)/; \
# 			echo "✅ $$chapter.pdf 복사"; \
# 			copied=$$((copied + 1)); \
# 		elif [ -f $$chapter.pdf ]; then \
# 			cp $$chapter.pdf $(OUTPUT_DIR)/; \
# 			echo "✅ $$chapter.pdf 복사"; \
# 			copied=$$((copied + 1)); \
# 		fi; \
# 	done; \
# 	echo "📊 총 $$copied개 파일 복사 완료"

# # PDF 압축
# compress-all: setup-dirs
# 	@echo "🗜️ PDF 압축 시작..."
# 	@if ! command -v gs >/dev/null 2>&1; then \
# 		echo "❌ Ghostscript가 설치되지 않음"; \
# 		echo "   설치: brew install ghostscript"; \
# 		exit 1; \
# 	fi
# 	@compressed=0; failed=0; \
# 	for pdf in $(OUTPUT_DIR)/*.pdf; do \
# 		if [ -f "$$pdf" ]; then \
# 			filename=$$(basename "$$pdf" .pdf); \
# 			echo "   🗜️ 압축 중: $$filename.pdf"; \
# 			if gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH -dPrinted=false -sOutputFile=$(COMPRESSED_DIR)/$$filename-compressed.pdf "$$pdf" 2>/dev/null; then \
# 				original_size=$$(stat -f%z "$$pdf" 2>/dev/null || echo "0"); \
# 				compressed_size=$$(stat -f%z "$(COMPRESSED_DIR)/$$filename-compressed.pdf" 2>/dev/null || echo "0"); \
# 				if [ $$original_size -gt 0 ] && [ $$compressed_size -gt 0 ]; then \
# 					ratio=$$(echo "scale=0; $$compressed_size * 100 / $$original_size" | bc 2>/dev/null || echo "?"); \
# 					echo "   ✅ $$filename-compressed.pdf ($$ratio%)"; \
# 				else \
# 					echo "   ✅ $$filename-compressed.pdf"; \
# 				fi; \
# 				compressed=$$((compressed + 1)); \
# 			else \
# 				echo "   ❌ $$filename.pdf 압축 실패"; \
# 				failed=$$((failed + 1)); \
# 			fi; \
# 		fi; \
# 	done; \
# 	echo "🎉 압축 완료: 성공 $$compressed개, 실패 $$failed개"

# # 현재 상태 확인
# status:
# 	@echo "📊 현재 상태 확인"
# 	@echo ""
# 	@echo "📄 메인 문서:"
# 	@if [ -f $(MAIN).pdf ]; then \
# 		size=$$(ls -lh $(MAIN).pdf | awk '{print $$5}'); \
# 		echo "   ✅ $(MAIN).pdf ($$size)"; \
# 	else \
# 		echo "   ❌ $(MAIN).pdf 없음"; \
# 	fi
# 	@echo ""
# 	@echo "📄 개별 챕터:"
# 	@for chapter in $(CHAPTERS); do \
# 		if [ -f $(CHAPTER_DIR)/$$chapter.pdf ]; then \
# 			size=$$(ls -lh $(CHAPTER_DIR)/$$chapter.pdf | awk '{print $$5}'); \
# 			echo "   ✅ $$chapter.pdf ($$size)"; \
# 		else \
# 			echo "   ❌ $$chapter.pdf 없음"; \
# 		fi; \
# 	done
# 	@echo ""
# 	@echo "📁 Output 폴더 ($(OUTPUT_DIR)):"
# 	@if [ -d $(OUTPUT_DIR) ] && [ "$$(ls -A $(OUTPUT_DIR) 2>/dev/null)" ]; then \
# 		ls -lh $(OUTPUT_DIR)/ | grep -v "^total" | awk '{print "   " $$9 " (" $$5 ")"}'; \
# 	else \
# 		echo "   (비어있음)"; \
# 	fi
# 	@echo ""
# 	@echo "📁 Compressed 폴더 ($(COMPRESSED_DIR)):"
# 	@if [ -d $(COMPRESSED_DIR) ] && [ "$$(ls -A $(COMPRESSED_DIR) 2>/dev/null)" ]; then \
# 		ls -lh $(COMPRESSED_DIR)/ | grep -v "^total" | awk '{print "   " $$9 " (" $$5 ")"}'; \
# 	else \
# 		echo "   (비어있음)"; \
# 	fi

# # 정리
# clean:
# 	@echo "🧹 임시 파일 정리..."
# 	@rm -f *.aux *.log *.toc *.bbl *.blg *.out *.idx *.ind *.ilg *.fdb_latexmk *.fls *.synctex.gz
# 	@rm -f $(CHAPTER_DIR)/*.aux $(CHAPTER_DIR)/*.log $(CHAPTER_DIR)/*.bbl $(CHAPTER_DIR)/*.blg $(CHAPTER_DIR)/*.out $(CHAPTER_DIR)/*.fdb_latexmk $(CHAPTER_DIR)/*.fls $(CHAPTER_DIR)/*.synctex.gz
# 	@echo "✅ 정리 완료"

# distclean: clean
# 	@echo "🗑️ 모든 생성 파일 삭제..."
# 	@rm -rf $(OUTPUT_DIR) $(COMPRESSED_DIR)
# 	@rm -f $(MAIN).pdf $(CHAPTER_DIR)/*.pdf
# 	@echo "✅ 삭제 완료"

# # 도움말
# help:
# 	@echo "🎯 목적: 전체 문서 + 개별 챕터 PDF 생성 및 압축"
# 	@echo ""
# 	@echo "🚀 사용법:"
# 	@echo ""
# 	@echo "📖 전체 과정:"
# 	@echo "   make all          - 메인 + 모든 챕터 컴파일 + 압축"
# 	@echo "   make manual       - 기존 PDF들 활용 + 압축 (빠름)"
# 	@echo ""
# 	@echo "📄 개별 작업:"
# 	@echo "   make compile-main - 메인 문서만 컴파일"
# 	@echo "   make chapters     - 모든 개별 챕터 컴파일"
# 	@echo "   make ch1          - ch1만 컴파일"
# 	@echo "   make ch3          - ch3만 컴파일"
# 	@echo ""
# 	@echo "🗜️ 압축:"
# 	@echo "   make compress-all - output 폴더의 모든 PDF 압축"
# 	@echo ""
# 	@echo "📊 확인:"
# 	@echo "   make status       - 현재 상태 상세 확인"
# 	@echo ""
# 	@echo "🧹 정리:"
# 	@echo "   make clean        - 임시 파일 정리"
# 	@echo "   make distclean    - 모든 생성 파일 삭제"
# 	@echo ""
# 	@echo "💡 주의사항:"
# 	@echo "   - 개별 챕터 컴파일을 위해서는 각 chapters/*.tex 파일 상단에"
# 	@echo "     \\documentclass[../note.tex]{subfiles} 추가 필요"
# 	@echo "   - 기존 내용은 \\begin{document}...\\end{document}로 감싸기"

# # 특별 타겟: 챕터 파일 준비 확인
# check-chapters:
# 	@echo "📋 챕터 파일 subfiles 설정 확인 중..."
# 	@for chapter in $(CHAPTERS); do \
# 		if [ -f $(CHAPTER_DIR)/$$chapter.tex ]; then \
# 			if grep -q "documentclass.*subfiles" $(CHAPTER_DIR)/$$chapter.tex; then \
# 				echo "   ✅ $$chapter.tex - subfiles 설정됨"; \
# 			else \
# 				echo "   ⚠️ $$chapter.tex - subfiles 설정 필요"; \
# 				echo "      파일 상단에 다음 추가:"; \
# 				echo "      \\documentclass[../note.tex]{subfiles}"; \
# 				echo "      \\begin{document}"; \
# 				echo "      (기존 내용)"; \
# 				echo "      \\end{document}"; \
# 			fi; \
# 		else \
# 			echo "   ❌ $$chapter.tex 파일 없음"; \
# 		fi; \
# 	done

