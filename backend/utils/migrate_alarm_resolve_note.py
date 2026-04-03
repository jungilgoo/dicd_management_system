"""
SPC 알람 테이블 마이그레이션: 조치완료+메모 방식으로 변경

- acknowledged_by, acknowledged_at 컬럼 삭제
- resolve_note 컬럼 추가
- ACKNOWLEDGED 상태 → ACTIVE로 롤백

사용법:
    python backend/utils/migrate_alarm_resolve_note.py
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database.database import engine, SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    db = SessionLocal()
    try:
        # 1. resolve_note 컬럼 추가
        logger.info("resolve_note 컬럼 추가...")
        try:
            db.execute(text("ALTER TABLE spc_alarms ADD COLUMN resolve_note TEXT NULL"))
            db.commit()
            logger.info("  resolve_note 컬럼 추가 완료")
        except Exception as e:
            db.rollback()
            if "Duplicate column" in str(e):
                logger.info("  resolve_note 컬럼이 이미 존재합니다.")
            else:
                raise

        # 2. ACKNOWLEDGED 상태를 ACTIVE로 롤백
        logger.info("ACKNOWLEDGED 상태 → ACTIVE로 변경...")
        result = db.execute(text(
            "UPDATE spc_alarms SET status = 'ACTIVE' WHERE status = 'ACKNOWLEDGED'"
        ))
        db.commit()
        logger.info(f"  {result.rowcount}건 변경됨")

        # 3. acknowledged_by, acknowledged_at 컬럼 삭제
        for col in ['acknowledged_by', 'acknowledged_at']:
            logger.info(f"{col} 컬럼 삭제...")
            try:
                db.execute(text(f"ALTER TABLE spc_alarms DROP COLUMN {col}"))
                db.commit()
                logger.info(f"  {col} 컬럼 삭제 완료")
            except Exception as e:
                db.rollback()
                if "check that column" in str(e) or "Unknown column" in str(e):
                    logger.info(f"  {col} 컬럼이 존재하지 않습니다.")
                else:
                    raise

        logger.info("\n마이그레이션 완료!")

    except Exception as e:
        db.rollback()
        logger.error(f"마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("SPC 알람 테이블 마이그레이션: 조치완료+메모")
    logger.info("=" * 60)

    try:
        migrate()
    except Exception as e:
        logger.error(f"오류: {e}")
        sys.exit(1)
