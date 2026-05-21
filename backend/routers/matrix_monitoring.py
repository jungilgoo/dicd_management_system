from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import math

from ..database import database, models

router = APIRouter(
    prefix="/api/monitoring",
    tags=["monitoring"],
    responses={404: {"description": "Not found"}},
)


def _week_key(dt: datetime) -> str:
    """datetime → 'YYYY-Www' ISO 주차 문자열"""
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def _period_label(key: str, mode: str) -> str:
    """표시용 레이블: 주별 → 'M월 W주', 월별 → 'YYYY-MM'"""
    if mode == "weekly":
        year, week = int(key[:4]), int(key[6:])
        # ISO 주차의 월요일 계산
        monday = datetime.strptime(f"{year}-W{week:02d}-1", "%G-W%V-%u")
        return f"{monday.month}월 {week}주"
    else:
        return key


def _generate_period_keys(mode: str, periods: int) -> List[str]:
    """현재 기준 최근 N기간의 키 목록 (오래된 순)"""
    now = datetime.now()
    keys = []
    if mode == "weekly":
        # 이번 주 포함 최근 N주
        for i in range(periods - 1, -1, -1):
            d = now - timedelta(weeks=i)
            keys.append(_week_key(d))
    else:
        for i in range(periods - 1, -1, -1):
            month = now.month - i
            year = now.year
            while month <= 0:
                month += 12
                year -= 1
            keys.append(f"{year}-{month:02d}")
    # 중복 제거 (주차 경계에서 발생 가능)
    seen = set()
    result = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            result.append(k)
    return result[-periods:]


def _get_period_key_sql(mode: str) -> str:
    if mode == "weekly":
        return "DATE_FORMAT(created_at, '%x-W%v')"  # ISO 주차
    else:
        return "DATE_FORMAT(created_at, '%Y-%m')"


@router.get("/matrix", response_model=Dict[str, Any])
def get_matrix_data(
    process_type: str = Query("PHOTO", description="공정 타입 (PHOTO, ETCH)"),
    mode: str = Query("weekly", description="집계 단위 (weekly, monthly)"),
    periods: Optional[int] = Query(None, description="표시 기간 수"),
    db: Session = Depends(database.get_db),
):
    # 기간 수 기본값
    if periods is None:
        periods = 12 if mode == "weekly" else 6

    # 표시할 기간 키 목록
    period_keys = _generate_period_keys(mode, periods)
    if not period_keys:
        return {"mode": mode, "periods": [], "period_labels": [], "groups": []}

    # 조회 시작 날짜
    if mode == "weekly":
        start_date = datetime.now() - timedelta(weeks=periods + 1)
    else:
        start_date = datetime.now() - timedelta(days=periods * 32)

    # ── 1. 타겟 계층 정보 조회 ──────────────────────────────────────
    targets = (
        db.query(
            models.Target,
            models.Process,
            models.ProductGroup,
        )
        .join(models.Process, models.Target.process_id == models.Process.id)
        .join(models.ProductGroup, models.Process.product_group_id == models.ProductGroup.id)
        .filter(models.Target.process_type == process_type)
        .order_by(
            models.ProductGroup.name,
            models.Process.name,
            models.Target.name,
        )
        .all()
    )

    if not targets:
        return {"mode": mode, "periods": period_keys, "period_labels": [_period_label(k, mode) for k in period_keys], "groups": []}

    target_ids = [t.Target.id for t in targets]

    # ── 2. 기간별 집계 쿼리 ─────────────────────────────────────────
    period_key_expr = _get_period_key_sql(mode)
    sql = text(f"""
        SELECT
            target_id,
            {period_key_expr} AS period_key,
            AVG(avg_value)  AS mean,
            STDDEV(avg_value) AS std,
            COUNT(*)        AS n
        FROM measurements
        WHERE target_id IN :target_ids
          AND created_at >= :start_date
        GROUP BY target_id, {period_key_expr}
        ORDER BY target_id, {period_key_expr}
    """)
    rows = db.execute(sql, {"target_ids": tuple(target_ids), "start_date": start_date}).fetchall()

    # target_id → {period_key: {mean, std, n}} 인덱스 빌드
    raw: Dict[int, Dict[str, Dict]] = {}
    for row in rows:
        tid = row.target_id
        pk = row.period_key
        if tid not in raw:
            raw[tid] = {}
        raw[tid][pk] = {
            "mean": round(float(row.mean), 4) if row.mean is not None else None,
            "std": round(float(row.std), 4) if row.std is not None else None,
            "n": int(row.n),
        }

    # ── 3. 셀 정보 계산 (delta, trend, 색상 기준) ───────────────────
    def build_cells(tid: int) -> tuple:
        """
        반환: (cells dict, overall_mean, period_sigma)
        """
        td = raw.get(tid, {})
        # 표시 기간 내 평균값 목록 (데이터 있는 것만)
        means_in_range = [td[k]["mean"] for k in period_keys if k in td and td[k]["mean"] is not None]

        overall_mean = (sum(means_in_range) / len(means_in_range)) if means_in_range else None
        # 기간별 평균값들의 표준편차
        period_sigma = None
        if len(means_in_range) >= 2:
            variance = sum((x - overall_mean) ** 2 for x in means_in_range) / (len(means_in_range) - 1)
            period_sigma = math.sqrt(variance)

        cells = {}
        prev_mean = None
        # 추세를 위해 직전 3기간의 증감 방향을 추적
        direction_history: List[Optional[str]] = []  # '+' / '-' / '='

        for k in period_keys:
            if k not in td or td[k]["mean"] is None:
                direction_history.append(None)
                prev_mean = None
                cells[k] = None
                continue

            m = td[k]["mean"]
            delta = round(m - prev_mean, 4) if prev_mean is not None else None

            # 추세 방향 계산
            if delta is not None:
                if delta > 0:
                    direction_history.append("+")
                elif delta < 0:
                    direction_history.append("-")
                else:
                    direction_history.append("=")
            else:
                direction_history.append(None)

            # 직전 3기간 연속 방향 (현재 기간 포함)
            recent = direction_history[-3:]
            trend = None
            if len(recent) == 3 and None not in recent:
                if all(d == "+" for d in recent):
                    trend = "▲"
                elif all(d == "-" for d in recent):
                    trend = "▼"
                else:
                    trend = "→"

            cells[k] = {
                "mean": m,
                "std": td[k]["std"],
                "n": td[k]["n"],
                "delta": delta,
                "trend": trend,
            }
            prev_mean = m

        return cells, overall_mean, period_sigma

    # ── 4. 계층 구조 빌드 ────────────────────────────────────────────
    pg_map: Dict[int, dict] = {}
    proc_map: Dict[int, dict] = {}

    for t, proc, pg in targets:
        if pg.id not in pg_map:
            pg_map[pg.id] = {"product_group_id": pg.id, "product_group_name": pg.name, "processes": []}
        if proc.id not in proc_map:
            proc_entry = {"process_id": proc.id, "process_name": proc.name, "targets": []}
            proc_map[proc.id] = proc_entry
            pg_map[pg.id]["processes"].append(proc_entry)

        cells, overall_mean, period_sigma = build_cells(t.id)
        proc_map[proc.id]["targets"].append({
            "target_id": t.id,
            "target_name": t.name,
            "overall_mean": round(overall_mean, 4) if overall_mean is not None else None,
            "period_sigma": round(period_sigma, 4) if period_sigma is not None else None,
            "cells": cells,
        })

    return {
        "mode": mode,
        "periods": period_keys,
        "period_labels": [_period_label(k, mode) for k in period_keys],
        "groups": list(pg_map.values()),
    }
