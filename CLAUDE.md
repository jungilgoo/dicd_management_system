# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

DICD (Developed Image CD) 측정 관리 시스템 - FastAPI 백엔드, HTML/JS 프론트엔드, MySQL 데이터베이스를 사용하는 한국 산업용 측정 데이터 관리 시스템입니다.

## 개발 명령어

### 개발 서버 시작
```bash
# Windows - 개발 서버 시작
cd "C:\Program Files\DICD_Management_System"
call venv\Scripts\activate.bat
python -m backend.main
```

### 서비스 시작 (운영)
```bash
# Windows 서비스 제어
net start DICD_Management_Service
net stop DICD_Management_Service

# 직접 실행
start_service.bat
```

### 데이터베이스 작업
```bash
# 가상환경 활성화 필수
call venv\Scripts\activate.bat

# 데이터베이스 초기화
python backend\utils\init_database.py

# 데이터베이스 초기화 (전체 삭제)
python backend\utils\clear_database.py

# 샘플 데이터 생성
python backend\utils\generate_sample_data.py

# 테이블 재생성
python backend\utils\recreate_tables.py
```

### 테스트
```bash
# 가상환경 활성화
call venv\Scripts\activate.bat

# 테스트 실행 (pytest 설정됨)
pytest backend\tests\
```

## 아키텍처

### 백엔드 구조
- **FastAPI 애플리케이션**: `backend/main.py`의 메인 백엔드 서비스
- **데이터베이스 레이어**: `backend/database/`의 SQLAlchemy 모델
  - `models.py`: 핵심 데이터베이스 모델 (ProductGroup, Process, Target, Measurement 등)
  - `database.py`: 데이터베이스 연결 설정
  - `crud.py`: 데이터베이스 작업
- **API 라우트**: `backend/routers/`에 도메인별 구성
  - 각 도메인별 전용 라우터 (measurements, reports, spc 등)
- **비즈니스 로직**: `backend/services/`의 서비스
- **데이터 스키마**: `backend/schemas/`의 Pydantic 스키마

### 프론트엔드 구조
- **순수 HTML/CSS/JS**: 빌드 프로세스 불필요
- **메인 페이지**: `frontend/pages/`에 위치
  - 분석 도구 (boxplot, distribution, spc, trend)
  - 데이터 입력/업로드 인터페이스
  - 보고서 생성
- **핵심 JS 파일**: `frontend/js/`에 위치
  - `api.js`: 캐싱 기능이 있는 API 통신
  - `config.js`: 설정 관리
  - 도메인별 모듈 (dashboard, reports 등)
- **UI 프레임워크**: AdminLTE와 Chart.js, D3.js 사용

### 주요 도메인 모델
- **ProductGroup**: 최상위 카테고리
- **Process**: 제품군 내 제조 공정
- **Target**: 공정 내 측정 대상
- **Measurement**: DICD 값을 포함한 실제 측정 데이터
- **Spec**: 사양 한계 및 허용 오차
- **Equipment**: 측정 장비 추적
- **PR Thickness**: 특수 포토레지스트 두께 측정

## 설정

### 데이터베이스 설정
- 설정 파일: `backend/config.json`
- 환경: development, production
- MySQL 커넥터를 통한 SQLAlchemy 연결

### 환경 변수
- `DICD_ENV`: 운영 모드일 때 "production"으로 설정
- `DICD_HOST`: 서버 호스트 (개발: 127.0.0.1, 운영: 0.0.0.0)
- `DICD_PORT`: 서버 포트 (기본값: 8080)

## 배포

### 개발 배포
로컬 개발 환경 설정 시 `deploy.bat` 사용 (자동 데이터베이스 설정 포함).

### 운영 배포
운영 서버 배포 시 `server_deploy.bat` 사용:
- NSSM을 통한 Windows 서비스 등록
- 방화벽 설정
- 환경 변수 설정
- 가상환경 생성

### 웹 서버 설정
- 배포 스크립트에 Nginx 설정 템플릿 제공
- 프론트엔드는 정적 파일로 서빙
- API는 8080 포트의 백엔드로 프록시

## 중요 사항

- UTF-8 인코딩을 사용하는 한국어 시스템
- Windows 우선 배포 (배치 스크립트 제공)
- 운영을 위해 MySQL 데이터베이스 필수
- 통계적 공정 관리(SPC) 분석 기능 포함
- ReportLab을 사용한 PDF 보고서 생성
- openpyxl을 사용한 Excel 가져오기/내보내기 기능