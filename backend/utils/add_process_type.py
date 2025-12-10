"""
Target 및 Equipment 테이블에 process_type 컬럼 추가 마이그레이션 스크립트

목적: PHOTO와 ETCH 공정을 구분하기 위한 process_type 컬럼 추가
전략: 단계별 안전 마이그레이션으로 기존 PHOTO 시스템 보호

사용법:
    python backend/utils/add_process_type.py
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


def step1_add_columns(db):
    """1단계: process_type 컬럼 추가 (NULL 허용)"""
    logger.info("\n=== 1단계: process_type 컬럼 추가 (NULL 허용) ===")

    # targets 테이블 확인
    if check_column_exists(db, 'targets', 'process_type'):
        logger.warning("targets.process_type 컬럼이 이미 존재합니다. 1단계를 건너뜁니다.")
    else:
        alter_targets = text("""
            ALTER TABLE targets
            ADD COLUMN process_type VARCHAR(20) NULL
            COMMENT '공정 타입 (PHOTO, ETCH)'
        """)
        db.execute(alter_targets)
        db.commit()
        logger.info("✓ targets.process_type 컬럼 추가 완료")

    # equipments 테이블 확인
    if check_column_exists(db, 'equipments', 'process_type'):
        logger.warning("equipments.process_type 컬럼이 이미 존재합니다. 1단계를 건너뜁니다.")
    else:
        alter_equipments = text("""
            ALTER TABLE equipments
            ADD COLUMN process_type VARCHAR(20) NULL
            COMMENT '공정 타입 (PHOTO, ETCH)'
        """)
        db.execute(alter_equipments)
        db.commit()
        logger.info("✓ equipments.process_type 컬럼 추가 완료")


def step2_update_existing_data(db):
    """2단계: 기존 데이터에 process_type='PHOTO' 설정"""
    logger.info("\n=== 2단계: 기존 데이터 업데이트 (process_type='PHOTO') ===")

    # targets 테이블 업데이트
    update_targets = text("""
        UPDATE targets
        SET process_type = 'PHOTO'
        WHERE process_type IS NULL
    """)
    result_targets = db.execute(update_targets)
    db.commit()
    logger.info(f"✓ targets 테이블: {result_targets.rowcount}개 행 업데이트 완료")

    # equipments 테이블 업데이트
    update_equipments = text("""
        UPDATE equipments
        SET process_type = 'PHOTO'
        WHERE process_type IS NULL
    """)
    result_equipments = db.execute(update_equipments)
    db.commit()
    logger.info(f"✓ equipments 테이블: {result_equipments.rowcount}개 행 업데이트 완료")


def step3_add_constraints(db):
    """3단계: NOT NULL 제약 및 기본값 'PHOTO' 설정"""
    logger.info("\n=== 3단계: NOT NULL 제약 및 기본값 설정 ===")

    # targets 테이블 제약 추가
    modify_targets = text("""
        ALTER TABLE targets
        MODIFY COLUMN process_type VARCHAR(20) NOT NULL DEFAULT 'PHOTO'
        COMMENT '공정 타입 (PHOTO, ETCH)'
    """)
    db.execute(modify_targets)
    db.commit()
    logger.info("✓ targets.process_type: NOT NULL 제약 및 기본값 'PHOTO' 설정 완료")

    # equipments 테이블 제약 추가
    modify_equipments = text("""
        ALTER TABLE equipments
        MODIFY COLUMN process_type VARCHAR(20) NOT NULL DEFAULT 'PHOTO'
        COMMENT '공정 타입 (PHOTO, ETCH)'
    """)
    db.execute(modify_equipments)
    db.commit()
    logger.info("✓ equipments.process_type: NOT NULL 제약 및 기본값 'PHOTO' 설정 완료")


def step4_add_indexes(db):
    """4단계: 인덱스 추가 (조회 성능 최적화)"""
    logger.info("\n=== 4단계: 인덱스 추가 ===")

    # targets 테이블 인덱스 확인 및 추가
    check_index_targets = text("""
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'targets'
        AND INDEX_NAME = 'idx_targets_process_type'
    """)

    if db.execute(check_index_targets).fetchone()[0] > 0:
        logger.warning("idx_targets_process_type 인덱스가 이미 존재합니다.")
    else:
        create_index_targets = text("""
            CREATE INDEX idx_targets_process_type
            ON targets(process_type)
        """)
        db.execute(create_index_targets)
        db.commit()
        logger.info("✓ targets 테이블 인덱스 추가 완료")

    # equipments 테이블 인덱스 확인 및 추가
    check_index_equipments = text("""
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'equipments'
        AND INDEX_NAME = 'idx_equipments_process_type'
    """)

    if db.execute(check_index_equipments).fetchone()[0] > 0:
        logger.warning("idx_equipments_process_type 인덱스가 이미 존재합니다.")
    else:
        create_index_equipments = text("""
            CREATE INDEX idx_equipments_process_type
            ON equipments(process_type)
        """)
        db.execute(create_index_equipments)
        db.commit()
        logger.info("✓ equipments 테이블 인덱스 추가 완료")


def step5_verify(db):
    """5단계: 마이그레이션 결과 검증"""
    logger.info("\n=== 5단계: 마이그레이션 결과 검증 ===")

    # targets 테이블 검증
    verify_targets = text("""
        SELECT
            COUNT(*) as total_count,
            SUM(CASE WHEN process_type = 'PHOTO' THEN 1 ELSE 0 END) as photo_count,
            SUM(CASE WHEN process_type = 'ETCH' THEN 1 ELSE 0 END) as etch_count,
            SUM(CASE WHEN process_type IS NULL THEN 1 ELSE 0 END) as null_count
        FROM targets
    """)

    targets_result = db.execute(verify_targets).fetchone()
    logger.info("\n[targets 테이블 검증]")
    logger.info(f"  전체 데이터: {targets_result[0]}개")
    logger.info(f"  PHOTO: {targets_result[1]}개")
    logger.info(f"  ETCH: {targets_result[2]}개")
    logger.info(f"  NULL: {targets_result[3]}개")

    if targets_result[3] > 0:
        logger.error("❌ targets 테이블에 NULL 값이 존재합니다!")
        raise Exception("데이터 검증 실패: targets 테이블")

    # equipments 테이블 검증
    verify_equipments = text("""
        SELECT
            COUNT(*) as total_count,
            SUM(CASE WHEN process_type = 'PHOTO' THEN 1 ELSE 0 END) as photo_count,
            SUM(CASE WHEN process_type = 'ETCH' THEN 1 ELSE 0 END) as etch_count,
            SUM(CASE WHEN process_type IS NULL THEN 1 ELSE 0 END) as null_count
        FROM equipments
    """)

    equipments_result = db.execute(verify_equipments).fetchone()
    logger.info("\n[equipments 테이블 검증]")
    logger.info(f"  전체 데이터: {equipments_result[0]}개")
    logger.info(f"  PHOTO: {equipments_result[1]}개")
    logger.info(f"  ETCH: {equipments_result[2]}개")
    logger.info(f"  NULL: {equipments_result[3]}개")

    if equipments_result[3] > 0:
        logger.error("❌ equipments 테이블에 NULL 값이 존재합니다!")
        raise Exception("데이터 검증 실패: equipments 테이블")

    # 컬럼 구조 확인
    verify_columns = text("""
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('targets', 'equipments')
        AND COLUMN_NAME = 'process_type'
        ORDER BY TABLE_NAME
    """)

    logger.info("\n[컬럼 구조 확인]")
    columns = db.execute(verify_columns).fetchall()
    for col in columns:
        logger.info(f"  {col[0]}.{col[1]}: {col[2]} (NULL: {col[3]}, DEFAULT: {col[4]})")
        logger.info(f"    COMMENT: {col[5]}")

    # 인덱스 확인
    verify_indexes = text("""
        SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('targets', 'equipments')
        AND INDEX_NAME LIKE '%process_type%'
        ORDER BY TABLE_NAME, INDEX_NAME
    """)

    logger.info("\n[인덱스 확인]")
    indexes = db.execute(verify_indexes).fetchall()
    for idx in indexes:
        logger.info(f"  {idx[0]}.{idx[1]} ON {idx[2]}")

    logger.info("\n✅ 모든 검증 통과!")


def run_migration():
    """전체 마이그레이션 실행"""
    db = SessionLocal()

    try:
        logger.info("=" * 70)
        logger.info("PHOTO/ETCH 공정 구분을 위한 process_type 컬럼 추가 마이그레이션")
        logger.info("=" * 70)

        # 5단계 마이그레이션 실행
        step1_add_columns(db)
        step2_update_existing_data(db)
        step3_add_constraints(db)
        step4_add_indexes(db)
        step5_verify(db)

        logger.info("\n" + "=" * 70)
        logger.info("✅ 마이그레이션이 성공적으로 완료되었습니다!")
        logger.info("=" * 70)
        logger.info("\n다음 단계:")
        logger.info("  1. PHOTO 시스템 모든 기능 테스트")
        logger.info("  2. 문제 없으면 Phase 2 (모델/스키마 수정) 진행")

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
