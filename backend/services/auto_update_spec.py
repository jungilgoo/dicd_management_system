import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from ..database import models
from ..database import crud
from ..database.database import SessionLocal
from ..schemas.spec import SpecCreate
from .spc import calculate_control_limits

logger = logging.getLogger("auto_update_spec")


def get_measurement_values(db: Session, target_id: int, months: int) -> List[float]:
    """지정된 기간 내 측정 데이터의 avg_value 리스트를 반환"""
    cutoff_date = datetime.now() - relativedelta(months=months)
    measurements = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.created_at >= cutoff_date
    ).order_by(models.Measurement.created_at.asc()).all()

    return [m.avg_value for m in measurements if m.avg_value is not None]


def update_control_limits_for_target(db: Session, target_id: int, execution_date_str: str) -> Dict[str, Any]:
    """단일 타겟의 UCL/LCL을 측정 데이터 기반으로 업데이트"""
    result = {"target_id": target_id, "status": "skipped", "reason": ""}

    # 1. 활성 SPEC 확인
    active_spec = crud.get_active_spec(db, target_id)
    if not active_spec:
        result["reason"] = "활성 SPEC 없음"
        return result

    # 2. 6개월 데이터 조회
    values = get_measurement_values(db, target_id, 6)
    data_period = "6개월"

    # 3. 25개 이하면 1년으로 확장
    if len(values) <= 25:
        values = get_measurement_values(db, target_id, 12)
        data_period = "1년"

    # 4. 여전히 25개 이하면 스킵
    if len(values) <= 25:
        result["reason"] = f"데이터 부족 ({len(values)}건, 최소 26건 필요)"
        return result

    # 5. UCL/LCL 계산 (3-시그마)
    limits = calculate_control_limits(values)
    if limits["ucl"] is None or limits["lcl"] is None:
        result["reason"] = "관리 한계선 계산 실패"
        return result

    # 6. 새 SPEC 생성 (기존 LSL/USL 유지, 새 UCL/LCL 적용)
    spec_data = SpecCreate(
        target_id=target_id,
        lsl=active_spec.lsl,
        usl=active_spec.usl,
        lcl=limits["lcl"],
        ucl=limits["ucl"],
        reason=f"자동 업데이트 ({execution_date_str}) - {data_period} 데이터 {len(values)}건 기반 3-시그마 계산"
    )
    new_spec = crud.create_spec(db, spec_data)

    result["status"] = "updated"
    result["reason"] = f"UCL: {active_spec.ucl} → {limits['ucl']}, LCL: {active_spec.lcl} → {limits['lcl']}"
    result["old_ucl"] = active_spec.ucl
    result["old_lcl"] = active_spec.lcl
    result["new_ucl"] = limits["ucl"]
    result["new_lcl"] = limits["lcl"]
    result["new_spec_id"] = new_spec.id
    result["data_count"] = len(values)
    result["data_period"] = data_period

    return result


def run_auto_update_all_targets(db: Session = None) -> Dict[str, Any]:
    """모든 활성 SPEC 타겟에 대해 UCL/LCL 자동 업데이트 실행"""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        execution_date_str = datetime.now().strftime("%Y-%m-%d")

        # 활성 SPEC이 있는 모든 target_id 수집
        active_specs = db.query(models.Spec).filter(
            models.Spec.is_active == True
        ).all()
        target_ids = list(set(spec.target_id for spec in active_specs))

        logger.info(f"UCL/LCL 자동 업데이트 시작 - 대상 타겟: {len(target_ids)}개")

        results = []
        updated_count = 0
        skipped_count = 0
        error_count = 0

        for target_id in target_ids:
            try:
                result = update_control_limits_for_target(db, target_id, execution_date_str)
                results.append(result)

                if result["status"] == "updated":
                    updated_count += 1
                    logger.info(f"  타겟 {target_id}: 업데이트 완료 - {result['reason']}")
                else:
                    skipped_count += 1
                    logger.info(f"  타겟 {target_id}: 스킵 - {result['reason']}")

            except Exception as e:
                db.rollback()
                error_count += 1
                error_result = {
                    "target_id": target_id,
                    "status": "error",
                    "reason": str(e)
                }
                results.append(error_result)
                logger.error(f"  타겟 {target_id}: 오류 발생 - {e}")

        summary = {
            "execution_date": execution_date_str,
            "total_targets": len(target_ids),
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": error_count,
            "details": results
        }

        logger.info(f"UCL/LCL 자동 업데이트 완료 - 업데이트: {updated_count}, 스킵: {skipped_count}, 오류: {error_count}")

        return summary

    except Exception as e:
        logger.error(f"UCL/LCL 자동 업데이트 실행 중 전체 오류: {e}")
        return {
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "total_targets": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "details": [{"status": "error", "reason": str(e)}]
        }
    finally:
        if close_db:
            db.close()
