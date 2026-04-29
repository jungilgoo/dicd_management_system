"""
SPC 메모 테이블 생성 스크립트

spc_memos 테이블을 신규 생성합니다.
기존 테이블에는 영향 없음 (create_all은 이미 존재하는 테이블을 건너뜀).

사용법:
    python backend/utils/create_spc_memo_tables.py
"""
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database.database import engine, SessionLocal
from backend.database import models
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_spc_memo_tables():
    """spc_memos 테이블 생성"""
    db = SessionLocal()

    try:
        logger.info("SPC 메모 테이블 생성을 시작합니다...")

        # SQLAlchemy create_all로 신규 테이블 생성 (기존 테이블 영향 없음)
        models.Base.metadata.create_all(bind=engine)
        logger.info("create_all 실행 완료")

        # 생성된 테이블 확인
        for table_name in ['spc_memos']:
            verify_query = text(f"""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = '{table_name}'
                ORDER BY ORDINAL_POSITION
            """)
            columns = db.execute(verify_query).fetchall()

            if columns:
                logger.info(f"\n{table_name} 테이블 컬럼:")
                for col in columns:
                    logger.info(f"  - {col[0]}: {col[1]} (NULL: {col[2]}, DEFAULT: {col[3]})")
            else:
                logger.warning(f"\n{table_name} 테이블이 생성되지 않았습니다!")

        logger.info("\nSPC 메모 테이블 생성 완료!")

    except Exception as e:
        db.rollback()
        logger.error(f"테이블 생성 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("SPC 메모 테이블 생성")
    logger.info("=" * 60)

    try:
        create_spc_memo_tables()
        logger.info("\n테이블 생성이 성공적으로 완료되었습니다.")
    except Exception as e:
        logger.error(f"\n생성 중 오류가 발생했습니다: {e}")
        sys.exit(1)
