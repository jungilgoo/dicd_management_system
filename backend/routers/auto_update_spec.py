from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import database
from ..services import auto_update_spec

router = APIRouter(
    prefix="/api/auto-update-spec",
    tags=["auto-update-spec"],
)


@router.post("/run")
def trigger_auto_update(db: Session = Depends(database.get_db)):
    """모든 활성 SPEC 타겟의 UCL/LCL을 수동으로 업데이트합니다."""
    result = auto_update_spec.run_auto_update_all_targets(db=db)
    return result


@router.post("/run/{target_id}")
def trigger_auto_update_single(target_id: int, db: Session = Depends(database.get_db)):
    """특정 타겟의 UCL/LCL을 수동으로 업데이트합니다."""
    execution_date_str = datetime.now().strftime("%Y-%m-%d")
    result = auto_update_spec.update_control_limits_for_target(db, target_id, execution_date_str)
    return result


@router.get("/status")
def get_scheduler_status():
    """스케줄러 상태 및 다음 실행 예정 시각을 조회합니다."""
    from backend.scheduler import scheduler

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
        })

    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs
    }
