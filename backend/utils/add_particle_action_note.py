"""
particle_measurements 테이블에 action_note 컬럼 추가 마이그레이션 스크립트

목적: 장비 조치 사항을 선택적으로 기록할 수 있는 컬럼 추가
     데이터 입력 폼이 아닌 데이터 조회 테이블의 인라인 편집에서만 입력 가능

사용법:
    python backend/utils/add_particle_action_note.py
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_column_exists(db, table_name, column_name):
    """컬럼이 이미 존재하는지 확인"""
    result = db.execute(text("""
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table_name
        AND COLUMN_NAME = :column_name
    """), {"table_name": table_name, "column_name": column_name}).fetchone()
    return result[0] > 0


def run_migration():
    db = SessionLocal()
    try:
        logger.info("=" * 60)
        logger.info("particle_measurements.action_note 컬럼 추가 마이그레이션")
        logger.info("=" * 60)

        if check_column_exists(db, 'particle_measurements', 'action_note'):
            logger.warning("action_note 컬럼이 이미 존재합니다. 마이그레이션을 건너뜁니다.")
        else:
            db.execute(text("""
                ALTER TABLE particle_measurements
                ADD COLUMN action_note VARCHAR(500) NULL
                COMMENT '장비 조치 사항'
                AFTER author
            """))
            db.commit()
            logger.info("✓ action_note 컬럼 추가 완료")

        # 검증
        if check_column_exists(db, 'particle_measurements', 'action_note'):
            logger.info("✅ 마이그레이션 완료! action_note 컬럼이 존재합니다.")
        else:
            raise Exception("컬럼 추가 실패")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        run_migration()
        sys.exit(0)
    except Exception as e:
        logger.error(f"마이그레이션 중 오류가 발생했습니다: {e}")
        sys.exit(1)
