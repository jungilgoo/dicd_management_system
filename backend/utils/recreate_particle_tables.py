"""
Particle 테이블 재생성 스크립트

기존 particle_equipments, particle_measurements 테이블을 DROP하고
SQLAlchemy 모델 기준으로 새로 생성합니다.

사용법:
    python backend/utils/recreate_particle_tables.py
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


def recreate_particle_tables():
    """particle_equipments, particle_measurements 테이블 재생성"""
    db = SessionLocal()

    try:
        logger.info("Particle 테이블 재생성을 시작합니다...")

        # 1. 외래 키 체크 비활성화 (순서 무관하게 DROP 가능)
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

        # 2. 기존 테이블 DROP
        db.execute(text("DROP TABLE IF EXISTS particle_measurements"))
        logger.info("✓ particle_measurements 테이블 삭제 완료")

        db.execute(text("DROP TABLE IF EXISTS particle_equipments"))
        logger.info("✓ particle_equipments 테이블 삭제 완료")

        # 3. 외래 키 체크 재활성화
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

        db.commit()

        # 4. SQLAlchemy create_all로 새 스키마로 재생성
        models.Base.metadata.create_all(bind=engine)
        logger.info("✓ Particle 테이블 재생성 완료 (새 스키마 적용)")

        # 5. 생성된 컬럼 확인
        for table_name in ['particle_equipments', 'particle_measurements']:  # spec_max만 남긴 단순 스키마
            verify_query = text(f"""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = '{table_name}'
                ORDER BY ORDINAL_POSITION
            """)
            columns = db.execute(verify_query).fetchall()
            logger.info(f"\n{table_name} 테이블 컬럼:")
            for col in columns:
                logger.info(f"  - {col[0]}: {col[1]} (NULL: {col[2]}, DEFAULT: {col[3]})")

        logger.info("\n✅ Particle 테이블 재생성 완료!")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ 재생성 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Particle 테이블 재생성")
    logger.info("=" * 60)

    try:
        recreate_particle_tables()
        logger.info("\n테이블 재생성이 성공적으로 완료되었습니다.")
    except Exception as e:
        logger.error(f"\n재생성 중 오류가 발생했습니다: {e}")
        sys.exit(1)
