from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from ..services.ai_analysis import analyze_spc_with_ai, analyze_trend_with_ai

router = APIRouter(
    prefix="/api/ai",
    tags=["ai-analysis"],
    responses={404: {"description": "Not found"}},
)


class SpcAnalysisRequest(BaseModel):
    """SPC AI 분석 요청 스키마"""
    spc_data: Dict[str, Any]
    product_group: Optional[str] = ""
    process: Optional[str] = ""
    target: Optional[str] = ""


@router.post("/analyze/spc")
async def analyze_spc(request: SpcAnalysisRequest):
    """SPC 데이터를 AI로 분석"""
    # 컨텍스트 정보를 spc_data에 추가
    spc_data = request.spc_data
    spc_data["product_group"] = request.product_group
    spc_data["process"] = request.process
    spc_data["target"] = request.target

    result = await analyze_spc_with_ai(spc_data)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    return result


class TrendAnalysisRequest(BaseModel):
    """추이 분석 AI 요청 스키마"""
    trend_data: Dict[str, Any]
    product_group: Optional[str] = ""
    process: Optional[str] = ""
    target: Optional[str] = ""


@router.post("/analyze/trend")
async def analyze_trend(request: TrendAnalysisRequest):
    """추이 분석 데이터를 AI로 해석"""
    trend_data = request.trend_data
    trend_data["product_group"] = request.product_group
    trend_data["process"] = request.process
    trend_data["target"] = request.target

    result = await analyze_trend_with_ai(trend_data)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    return result
