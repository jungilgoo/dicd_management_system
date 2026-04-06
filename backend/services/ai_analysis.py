"""
AI 분석 서비스 - Gemini API를 활용한 SPC 데이터 해석
"""
import json
import os
import logging

logger = logging.getLogger(__name__)


def _load_api_key() -> str:
    """config.json에서 Gemini API 키를 로드"""
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        env = os.environ.get("DICD_ENV", "development")
        api_key = config.get(env, {}).get("GEMINI_API_KEY", "")
        if not api_key:
            api_key = config.get("development", {}).get("GEMINI_API_KEY", "")
        return api_key
    except Exception as e:
        logger.error(f"Gemini API 키 로드 실패: {e}")
        return ""


def _build_spc_prompt(spc_data: dict) -> str:
    """SPC 분석 데이터를 기반으로 프롬프트 생성"""

    # 데이터 추출
    control_limits = spc_data.get("control_limits", {})
    capability = spc_data.get("process_capability", {})
    spec = spc_data.get("spec", {})
    patterns = spc_data.get("patterns", [])
    data = spc_data.get("data", {})
    sample_count = spc_data.get("sample_count", 0)

    # 컨텍스트 정보
    product_group = spc_data.get("product_group", "")
    process = spc_data.get("process", "")
    target = spc_data.get("target", "")

    # 패턴 위반 요약
    pattern_summary = "없음"
    if patterns:
        pattern_lines = []
        for p in patterns:
            rule = p.get("rule", "")
            desc = p.get("description", "")
            lot = p.get("lot_no", "")
            val = p.get("value", "")
            pattern_lines.append(f"  - Rule {rule}: {desc} (LOT: {lot}, 값: {val})")
        pattern_summary = "\n".join(pattern_lines)

    # 최근 측정값 (최대 30개)
    values = data.get("values", [])
    lot_nos = data.get("lot_nos", [])
    recent_count = min(30, len(values))
    recent_values_str = ""
    if recent_count > 0:
        recent_values = values[-recent_count:]
        recent_lots = lot_nos[-recent_count:] if lot_nos else []
        recent_values_str = ", ".join([f"{v:.3f}" for v in recent_values])
        if recent_lots:
            recent_lots_str = ", ".join(recent_lots[-5:])  # 마지막 5개 LOT만
            recent_values_str += f"\n  (최근 LOT: {recent_lots_str})"

    # 위치별 패턴 위반 요약
    position_patterns = spc_data.get("position_patterns", {})
    position_pattern_summary = ""
    if position_patterns:
        for pos, pos_patterns in position_patterns.items():
            if pos_patterns:
                position_pattern_summary += f"\n  [{pos}] {len(pos_patterns)}건 위반"

    prompt = f"""당신은 반도체/디스플레이 공정의 SPC(Statistical Process Control) 데이터 분석 전문가입니다.
DICD(Developed Image Critical Dimension)는 포토리소그래피 공정에서 현상 후 패턴의 임계 치수를 측정한 값입니다.

아래 SPC 분석 데이터를 해석하고, 공정 엔지니어가 즉시 활용할 수 있는 실용적인 분석 결과를 제공하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[분석 대상]
- 제품군: {product_group}
- 공정: {process}
- 타겟: {target}
- 총 측정 수: {sample_count}개

[SPEC 정보]
- USL (규격상한): {spec.get('usl', 'N/A')}
- LSL (규격하한): {spec.get('lsl', 'N/A')}
- Target (목표값): {spec.get('target', 'N/A')}

[관리한계]
- CL (중심선): {control_limits.get('cl', 'N/A')}
- UCL (상한관리선): {control_limits.get('ucl', 'N/A')}
- LCL (하한관리선): {control_limits.get('lcl', 'N/A')}

[공정능력지수]
- Cp: {capability.get('cp', 'N/A')}
- Cpk: {capability.get('cpk', 'N/A')}
- Pp: {capability.get('pp', 'N/A')}
- Ppk: {capability.get('ppk', 'N/A')}
- Cpu (상한): {capability.get('cpu', 'N/A')}
- Cpl (하한): {capability.get('cpl', 'N/A')}

[Nelson Rules 패턴 위반]
{pattern_summary}

[위치별 패턴 위반]{position_pattern_summary if position_pattern_summary else " 없음"}

[최근 측정값 ({recent_count}개)]
{recent_values_str if recent_values_str else "데이터 없음"}
━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 형식으로 분석 결과를 작성하세요:

## 1. 공정 상태 요약
현재 공정이 안정(In-Control)/불안정(Out-of-Control) 상태인지 판단하고, 한 문장으로 핵심을 요약하세요.

## 2. 공정능력 분석
Cp, Cpk, Pp, Ppk 값을 해석하세요. (기준: 1.33 이상 양호, 1.0~1.33 주의, 1.0 미만 부적합)
- Cp vs Cpk 비교: 산포 대비 치우침 평가
- Cp vs Pp 비교: 단기 vs 장기 산포 평가
- Cpk vs Ppk 비교: 공정 안정성 평가

## 3. 주요 발견사항
패턴 위반, 추세, 이상점 등 주목할 점을 구체적으로 기술하세요.

## 4. 원인 추정
발견된 문제의 가능한 원인을 공정 관점에서 추정하세요. (장비, 재료, 환경, 작업자 등)

## 5. 조치 권고
구체적이고 실행 가능한 개선 조치를 우선순위별로 제시하세요.

## 6. 위험도 평가
🟢 양호 / 🟡 주의 / 🔴 위험 중 하나로 평가하고 근거를 간단히 설명하세요.

한국어로 답변하세요. 공정 엔지니어가 이해할 수 있도록 전문 용어를 적절히 사용하되, 명확하게 설명하세요."""

    return prompt


async def analyze_spc_with_ai(spc_data: dict) -> dict:
    """SPC 데이터를 Gemini API로 분석"""

    api_key = _load_api_key()
    if not api_key:
        return {
            "success": False,
            "error": "Gemini API 키가 설정되지 않았습니다. config.json에 GEMINI_API_KEY를 추가하세요."
        }

    try:
        import google.generativeai as genai
    except ImportError:
        return {
            "success": False,
            "error": "google-generativeai 패키지가 설치되지 않았습니다. pip install google-generativeai 를 실행하세요."
        }

    prompt = _build_spc_prompt(spc_data)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=2048,
            )
        )

        return {
            "success": True,
            "analysis": response.text
        }

    except Exception as e:
        logger.error(f"Gemini API 호출 실패: {e}")
        return {
            "success": False,
            "error": f"AI 분석 중 오류가 발생했습니다: {str(e)}"
        }
