"""
Spec 테이블에 UCL/LCL 컬럼 추가 마이그레이션 스크립트

사용법:
    python backend/utils/add_control_limits_to_spec.py
"""
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database.database import engine, SessionLocal
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_control_limit_columns():
    """Spec 테이블에 ucl, lcl 컬럼 추가"""
    db = SessionLocal()

    try:
        # 1. 컬럼이 이미 존재하는지 확인
        check_query = text("""
            SELECT COUNT(*) as count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'specs'
            AND COLUMN_NAME IN ('ucl', 'lcl')
        """)

        result = db.execute(check_query).fetchone()
        existing_columns = result[0]

        if existing_columns > 0:
            logger.warning(f"UCL/LCL 컬럼이 이미 {existing_columns}개 존재합니다. 마이그레이션을 건너뜁니다.")
            return

        logger.info("Spec 테이블에 UCL/LCL 컬럼을 추가합니다...")

        # 2. ucl 컬럼 추가 (NOT NULL, 기본값 0.0)
        alter_ucl = text("""
            ALTER TABLE specs
            ADD COLUMN ucl FLOAT NOT NULL DEFAULT 0.0
            COMMENT '상한 관리 한계 (Upper Control Limit)'
        """)
        db.execute(alter_ucl)
        logger.info("✓ ucl 컬럼 추가 완료")

        # 3. lcl 컬럼 추가 (NOT NULL, 기본값 0.0)
        alter_lcl = text("""
            ALTER TABLE specs
            ADD COLUMN lcl FLOAT NOT NULL DEFAULT 0.0
            COMMENT '하한 관리 한계 (Lower Control Limit)'
        """)
        db.execute(alter_lcl)
        logger.info("✓ lcl 컬럼 추가 완료")

        # 4. 컬럼 순서 변경 (usl 다음에 배치)
        reorder_ucl = text("""
            ALTER TABLE specs
            MODIFY COLUMN ucl FLOAT NOT NULL DEFAULT 0.0
            COMMENT '상한 관리 한계 (Upper Control Limit)'
            AFTER usl
        """)
        db.execute(reorder_ucl)

        reorder_lcl = text("""
            ALTER TABLE specs
            MODIFY COLUMN lcl FLOAT NOT NULL DEFAULT 0.0
            COMMENT '하한 관리 한계 (Lower Control Limit)'
            AFTER usl
        """)
        db.execute(reorder_lcl)
        logger.info("✓ 컬럼 순서 정리 완료 (lsl, usl, lcl, ucl)")

        db.commit()
        logger.info("✅ 마이그레이션 완료!")

        # 5. 변경 사항 확인
        verify_query = text("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'specs'
            AND COLUMN_NAME IN ('lsl', 'usl', 'lcl', 'ucl')
            ORDER BY ORDINAL_POSITION
        """)

        columns = db.execute(verify_query).fetchall()
        logger.info("\n현재 Spec 테이블 구조:")
        for col in columns:
            logger.info(f"  - {col[0]}: {col[1]} (NULL: {col[2]}, DEFAULT: {col[3]})")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Spec 테이블 UCL/LCL 컬럼 추가 마이그레이션")
    logger.info("=" * 60)

    try:
        add_control_limit_columns()
        logger.info("\n마이그레이션이 성공적으로 완료되었습니다.")
    except Exception as e:
        logger.error(f"\n마이그레이션 중 오류가 발생했습니다: {e}")
        sys.exit(1)
