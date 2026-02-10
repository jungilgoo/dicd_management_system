import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()


def setup_scheduler():
    """스케줄러 설정 및 작업 등록"""
    from backend.services.auto_update_spec import run_auto_update_all_targets

    # 매년 1월 1일, 7월 1일 00:30에 실행
    scheduler.add_job(
        run_auto_update_all_targets,
        trigger=CronTrigger(month="1,7", day=1, hour=0, minute=30),
        id="auto_update_ucl_lcl",
        name="UCL/LCL 자동 업데이트 (반기)",
        replace_existing=True,
        misfire_grace_time=3600
    )

    logger.info("스케줄러 작업 등록 완료: UCL/LCL 자동 업데이트 (1월 1일, 7월 1일)")


def start_scheduler():
    """스케줄러 시작"""
    if not scheduler.running:
        setup_scheduler()
        scheduler.start()
        logger.info("스케줄러 시작됨")


def shutdown_scheduler():
    """스케줄러 종료"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("스케줄러 종료됨")
