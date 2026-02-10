"""
SPEC 구간 빌드 유틸리티

측정 리스트에서 spec_id 변화 기준으로 구간을 생성하여
차트에서 SPEC 라인을 구간별로 분리 표시할 수 있도록 지원
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..database import models


def build_spec_segments(measurements: list, db: Session) -> List[Dict[str, Any]]:
    """
    측정 리스트에서 spec_id 변화 기준으로 구간 생성

    Args:
        measurements: created_at ASC 정렬된 측정 리스트
        db: DB 세션

    Returns:
        [
            {"spec_id": 1, "lsl": 0.95, "usl": 1.05, "lcl": 0.97, "ucl": 1.03,
             "target": 1.0, "start_index": 0, "end_index": 14},
            ...
        ]
    """
    if not measurements:
        return []

    # 측정 데이터에서 사용된 spec_id 목록 수집
    spec_ids = set()
    for m in measurements:
        spec_id = getattr(m, 'spec_id', None)
        if spec_id is not None:
            spec_ids.add(spec_id)

    # SPEC 정보 일괄 조회 (IN 쿼리)
    specs_by_id = {}
    if spec_ids:
        specs = db.query(models.Spec).filter(models.Spec.id.in_(spec_ids)).all()
        specs_by_id = {s.id: s for s in specs}

    # 구간 생성: spec_id가 변할 때마다 새 구간
    segments = []
    current_spec_id = getattr(measurements[0], 'spec_id', None)
    segment_start = 0

    for i in range(1, len(measurements)):
        m_spec_id = getattr(measurements[i], 'spec_id', None)
        if m_spec_id != current_spec_id:
            # 이전 구간 종료
            segments.append(_build_segment(current_spec_id, specs_by_id, segment_start, i - 1))
            current_spec_id = m_spec_id
            segment_start = i

    # 마지막 구간
    segments.append(_build_segment(current_spec_id, specs_by_id, segment_start, len(measurements) - 1))

    return segments


def _build_segment(spec_id: Optional[int], specs_by_id: dict, start_index: int, end_index: int) -> Dict[str, Any]:
    """단일 구간 정보 생성"""
    segment = {
        "spec_id": spec_id,
        "start_index": start_index,
        "end_index": end_index,
        "lsl": None,
        "usl": None,
        "lcl": None,
        "ucl": None,
        "target": None,
    }

    if spec_id is not None and spec_id in specs_by_id:
        spec = specs_by_id[spec_id]
        segment["lsl"] = spec.lsl
        segment["usl"] = spec.usl
        segment["lcl"] = spec.lcl
        segment["ucl"] = spec.ucl
        if spec.lsl is not None and spec.usl is not None:
            segment["target"] = round((spec.lsl + spec.usl) / 2, 3)

    return segment
