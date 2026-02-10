"""
Measurement 테이블에 spec_id 컬럼 추가 마이그레이션 스크립트

목적: 측정 시점의 활성 SPEC을 기록하여 SPEC 변경 후에도 이력 추적 가능
전략: 단계별 안전 마이그레이션으로 기존 시스템 보호

사용법:
    python backend/utils/add_spec_id_to_measurements.py
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


def check_column_exists(db, table_name, column_name):
    """컬럼이 이미 존재하는지 확인"""
    check_query = text("""
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table_name
        AND COLUMN_NAME = :column_name
    """)
    result = db.execute(check_query, {"table_name": table_name, "column_name": column_name}).fetchone()
    return result[0] > 0


def check_foreign_key_exists(db, constraint_name):
    """외래 키 제약조건이 이미 존재하는지 확인"""
    check_query = text("""
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'measurements'
        AND CONSTRAINT_NAME = :constraint_name
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    """)
    result = db.execute(check_query, {"constraint_name": constraint_name}).fetchone()
    return result[0] > 0


def check_index_exists(db, index_name):
    """인덱스가 이미 존재하는지 확인"""
    check_query = text("""
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'measurements'
        AND INDEX_NAME = :index_name
    """)
    result = db.execute(check_query, {"index_name": index_name}).fetchone()
    return result[0] > 0


def step1_add_column(db):
    """1단계: spec_id 컬럼 추가"""
    logger.info("\n=== 1단계: spec_id 컬럼 추가 ===")

    if check_column_exists(db, 'measurements', 'spec_id'):
        logger.warning("measurements.spec_id 컬럼이 이미 존재합니다. 1단계를 건너뜁니다.")
        return

    alter_sql = text("""
        ALTER TABLE measurements
        ADD COLUMN spec_id INT NULL
        COMMENT '측정 시점의 활성 SPEC ID'
    """)
    db.execute(alter_sql)
    db.commit()
    logger.info("✓ measurements.spec_id 컬럼 추가 완료")


def step2_add_foreign_key(db):
    """2단계: 외래 키 제약조건 추가"""
    logger.info("\n=== 2단계: 외래 키 제약조건 추가 ===")

    constraint_name = 'fk_measurements_spec'

    if check_foreign_key_exists(db, constraint_name):
        logger.warning(f"{constraint_name} 외래 키가 이미 존재합니다. 2단계를 건너뜁니다.")
        return

    add_fk = text(f"""
        ALTER TABLE measurements
        ADD CONSTRAINT {constraint_name}
        FOREIGN KEY (spec_id) REFERENCES specs(id)
    """)
    db.execute(add_fk)
    db.commit()
    logger.info(f"✓ {constraint_name} 외래 키 제약조건 추가 완료")


def step3_add_index(db):
    """3단계: 인덱스 추가"""
    logger.info("\n=== 3단계: 인덱스 추가 ===")

    index_name = 'idx_measurements_spec_id'

    if check_index_exists(db, index_name):
        logger.warning(f"{index_name} 인덱스가 이미 존재합니다. 3단계를 건너뜁니다.")
        return

    add_index = text(f"""
        CREATE INDEX {index_name} ON measurements(spec_id)
    """)
    db.execute(add_index)
    db.commit()
    logger.info(f"✓ {index_name} 인덱스 추가 완료")


def step4_verify(db):
    """4단계: 마이그레이션 결과 검증"""
    logger.info("\n=== 4단계: 마이그레이션 결과 검증 ===")

    # 컬럼 확인
    verify_column = text("""
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'measurements'
        AND COLUMN_NAME = 'spec_id'
    """)
    column = db.execute(verify_column).fetchone()
    if column:
        logger.info(f"\n[컬럼 확인]")
        logger.info(f"  measurements.{column[0]}: {column[1]} (NULL: {column[2]})")
        logger.info(f"  COMMENT: {column[3]}")
    else:
        logger.error("❌ spec_id 컬럼이 존재하지 않습니다!")
        raise Exception("컬럼 검증 실패")

    # 외래 키 확인
    verify_fk = text("""
        SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'measurements'
        AND COLUMN_NAME = 'spec_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    """)
    fk = db.execute(verify_fk).fetchone()
    if fk:
        logger.info(f"\n[외래 키 확인]")
        logger.info(f"  {fk[0]}: {fk[1]} -> {fk[2]}.{fk[3]}")
    else:
        logger.error("❌ 외래 키 제약조건이 존재하지 않습니다!")
        raise Exception("외래 키 검증 실패")

    # 인덱스 확인
    verify_index = text("""
        SELECT INDEX_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'measurements'
        AND COLUMN_NAME = 'spec_id'
    """)
    indexes = db.execute(verify_index).fetchall()
    if indexes:
        logger.info(f"\n[인덱스 확인]")
        for idx in indexes:
            logger.info(f"  {idx[0]}: {idx[1]}")
    else:
        logger.warning("⚠️ spec_id 인덱스가 존재하지 않습니다.")

    logger.info("\n✅ 모든 검증 통과!")


def run_migration():
    """전체 마이그레이션 실행"""
    db = SessionLocal()

    try:
        logger.info("=" * 70)
        logger.info("측정 데이터 SPEC 이력 추적을 위한 spec_id 컬럼 추가 마이그레이션")
        logger.info("=" * 70)

        step1_add_column(db)
        step2_add_foreign_key(db)
        step3_add_index(db)
        step4_verify(db)

        logger.info("\n" + "=" * 70)
        logger.info("✅ 마이그레이션이 성공적으로 완료되었습니다!")
        logger.info("=" * 70)
        logger.info("\n다음 단계:")
        logger.info("  1. python backend/utils/backfill_spec_id.py 실행하여 기존 데이터 백필")
        logger.info("  2. 데이터 입력 후 spec_id 자동 저장 확인")

    except Exception as e:
        db.rollback()
        logger.error(f"\n❌ 마이그레이션 실패: {e}")
        logger.error("\n데이터베이스가 롤백되었습니다.")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        run_migration()
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n마이그레이션 중 오류가 발생했습니다: {e}")
        sys.exit(1)
