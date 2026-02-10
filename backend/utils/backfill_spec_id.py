"""
기존 측정 데이터의 spec_id 백필 스크립트

목적: spec_id 컬럼 추가 전에 생성된 측정 데이터에 대해
      측정 시점에 활성이었던 SPEC을 매칭하여 spec_id를 채움

사용법:
    python backend/utils/backfill_spec_id.py
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database.database import SessionLocal
from backend.database import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def backfill_spec_ids():
    """기존 측정 데이터에 spec_id 백필"""
    db = SessionLocal()

    try:
        # spec_id가 NULL인 측정이 있는 타겟 목록 조회
        targets_with_null = db.execute(text("""
            SELECT DISTINCT target_id
            FROM measurements
            WHERE spec_id IS NULL
            ORDER BY target_id
        """)).fetchall()

        if not targets_with_null:
            logger.info("백필할 데이터가 없습니다. 모든 측정에 spec_id가 설정되어 있습니다.")
            return

        logger.info(f"백필 대상 타겟 수: {len(targets_with_null)}")

        total_updated = 0
        total_skipped = 0

        for (target_id,) in targets_with_null:
            # 해당 타겟의 SPEC 이력 (생성일 오름차순)
            specs = db.query(models.Spec).filter(
                models.Spec.target_id == target_id
            ).order_by(models.Spec.created_at.asc()).all()

            if not specs:
                # SPEC이 없는 타겟 → 건너뜀
                null_count = db.execute(text(
                    "SELECT COUNT(*) FROM measurements WHERE target_id = :tid AND spec_id IS NULL"
                ), {"tid": target_id}).scalar()
                total_skipped += null_count
                logger.info(f"  타겟 {target_id}: SPEC 없음 → {null_count}건 건너뜀")
                continue

            # 해당 타겟의 측정 (spec_id가 NULL인 것만, 생성일 오름차순)
            measurements = db.query(models.Measurement).filter(
                models.Measurement.target_id == target_id,
                models.Measurement.spec_id == None
            ).order_by(models.Measurement.created_at.asc()).all()

            if not measurements:
                continue

            # SPEC 시간 구간 구축: spec[i]는 spec[i].created_at ~ spec[i+1].created_at 구간
            updated_count = 0
            batch = []

            for m in measurements:
                matched_spec = None
                for i, spec in enumerate(specs):
                    if m.created_at >= spec.created_at:
                        # 이 SPEC이 후보. 더 늦은 SPEC이 있는지 확인
                        if i + 1 < len(specs) and m.created_at >= specs[i + 1].created_at:
                            continue  # 다음 SPEC이 더 적합
                        matched_spec = spec
                        break
                    else:
                        # 측정이 이 SPEC보다 이전 → 매칭 불가
                        break

                # 역순 탐색 대안: 가장 최근 spec 중 measurement보다 이전인 것
                if matched_spec is None:
                    for spec in reversed(specs):
                        if m.created_at >= spec.created_at:
                            matched_spec = spec
                            break

                if matched_spec:
                    m.spec_id = matched_spec.id
                    batch.append(m)
                    updated_count += 1

                    if len(batch) >= BATCH_SIZE:
                        db.commit()
                        batch = []
                else:
                    total_skipped += 1

            # 남은 배치 커밋
            if batch:
                db.commit()

            total_updated += updated_count
            logger.info(f"  타겟 {target_id}: {updated_count}건 업데이트, "
                        f"SPEC {len(specs)}개 사용")

        logger.info(f"\n{'=' * 50}")
        logger.info(f"백필 완료!")
        logger.info(f"  업데이트: {total_updated}건")
        logger.info(f"  건너뜀 (매칭 불가): {total_skipped}건")
        logger.info(f"{'=' * 50}")

    except Exception as e:
        db.rollback()
        logger.error(f"백필 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        logger.info("=" * 70)
        logger.info("기존 측정 데이터 spec_id 백필 시작")
        logger.info("=" * 70)
        backfill_spec_ids()
        sys.exit(0)
    except Exception as e:
        logger.error(f"오류 발생: {e}")
        sys.exit(1)
