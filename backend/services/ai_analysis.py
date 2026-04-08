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

    # 현재 평균 및 ΔCL
    current_mean = spc_data.get("current_mean")
    cl_value = control_limits.get("cl")
    delta_cl = None
    if current_mean is not None and cl_value is not None:
        delta_cl = round(current_mean - cl_value, 4)

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
            val = p.get("value")
            length = p.get("length")

            if val is not None:
                detail = f"LOT: {lot}, 값: {val}"
            elif length is not None:
                detail = f"시작 LOT: {lot}, 연속 {length}점"
            else:
                detail = f"LOT: {lot}"

            pattern_lines.append(f"  - Rule {rule}: {desc} ({detail})")
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

    # R 차트 분석 (위치별 데이터에서 서브그룹 내 산포 계산)
    position_data = spc_data.get("position_data", {})
    r_chart_summary = ""
    if position_data:
        positions = ['top', 'center', 'bottom', 'left', 'right']
        r_values = []
        data_length = len(values)

        for i in range(data_length):
            vals_at_pos = []
            for pos in positions:
                pos_vals = position_data.get(pos, [])
                if i < len(pos_vals) and isinstance(pos_vals[i], (int, float)):
                    vals_at_pos.append(pos_vals[i])
            if len(vals_at_pos) > 1:
                r_values.append(max(vals_at_pos) - min(vals_at_pos))

        if r_values:
            r_bar = sum(r_values) / len(r_values)
            d2, d3 = 2.326, 0.864  # k=5 서브그룹 상수
            r_ucl = r_bar + (3 * r_bar * d3 / d2)

            # UCL 초과 이상점 상세
            r_outlier_details = []
            for i, rv in enumerate(r_values):
                if rv > r_ucl:
                    lot = lot_nos[i] if i < len(lot_nos) else f"포인트 {i+1}"
                    r_outlier_details.append(f"LOT: {lot}, R={rv:.4f}")

            r_chart_summary = f"- R-bar: {r_bar:.4f}, UCL: {r_ucl:.4f}, UCL 초과: {len(r_outlier_details)}건"
            if r_outlier_details:
                r_chart_summary += "\n  [이상점 상세]"
                for detail in r_outlier_details:
                    r_chart_summary += f"\n  - {detail}"

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

[관리한계] (CL은 UCL/LCL 기준 고정값)
- CL (중심선): {control_limits.get('cl', 'N/A')}
- UCL (상한관리선): {control_limits.get('ucl', 'N/A')}
- LCL (하한관리선): {control_limits.get('lcl', 'N/A')}
- 현재 공정 평균: {current_mean if current_mean is not None else 'N/A'}
- ΔCL (현재 평균 - CL): {f"{'+' if delta_cl >= 0 else ''}{delta_cl}" if delta_cl is not None else 'N/A'}

[공정능력지수]
- Cp: {capability.get('cp', 'N/A')}
- Cpk: {capability.get('cpk', 'N/A')}
- Pp: {capability.get('pp', 'N/A')}
- Ppk: {capability.get('ppk', 'N/A')}
- Cpu (상한): {capability.get('cpu', 'N/A')}
- Cpl (하한): {capability.get('cpl', 'N/A')}

[Nelson Rules 패턴 위반]
{pattern_summary}

[R 차트 분석 (서브그룹 내 산포 - 웨이퍼 내 균일성)]
{r_chart_summary if r_chart_summary else "데이터 없음"}

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
패턴 위반, 추세, 이상점, R 차트 이상(균일성 문제) 등 주목할 점을 구체적으로 기술하세요.

## 4. 원인 추정
발견된 문제의 가능한 원인을 공정 관점에서 추정하세요. (장비, 재료, 환경, 작업자 등)

## 5. 조치 권고(Positive PR/Trench 기준)
구체적이고 실행 가능한 개선 조치를 우선순위별로 제시하세요.

## 6. 위험도 평가
🟢 양호 / 🟡 주의 / 🔴 위험 중 하나로 평가하고 근거를 간단히 설명하세요.

한국어로 답변하세요. 
결과는 역피라미드 구조(가장 중요한 결론이 맨 앞)으로 작성할 것.
원인 분석 시 '가능성 높음/낮음'을 구분하여 엔지니어의 판단을 도울 것.
수치 해석에 매몰되지 말고, 실제 물리적 공정(장비, 재료, 환경 등)과의 연결고리를 강화할 것.
분석은 공정 관점에서 구체적이고 실행 가능한 조치 권고를 포함할 것.
기술적 용어는 사용하되, 명확하고 간결하게 설명할 것.
공정 엔지니어가 이해할 수 있도록 전문 용어를 적절히 사용하되, 명확하게 설명하세요."""

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

    # 프롬프트 로그 출력
    logger.info("=" * 60)
    logger.info("[AI 분석] Gemini API 프롬프트:")
    logger.info("=" * 60)
    logger.info(prompt)
    logger.info("=" * 60)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                top_p=0.9,
                top_k=40,
                max_output_tokens=8192,
            )
        )

        # 응답 로그 출력
        logger.info("[AI 분석] Gemini API 응답:")
        logger.info("=" * 60)
        logger.info(response.text)
        logger.info("=" * 60)

        return {
            "success": True,
            "analysis": response.text,
            "prompt": prompt
        }

    except Exception as e:
        logger.error(f"Gemini API 호출 실패: {e}")
        return {
            "success": False,
            "error": f"AI 분석 중 오류가 발생했습니다: {str(e)}"
        }


def _build_trend_prompt(trend_data: dict) -> str:
    """추이 분석 데이터를 기반으로 프롬프트 생성"""

    overall = trend_data.get("overall_statistics", {}) or {}
    capability = trend_data.get("process_capability", {}) or {}
    spec = trend_data.get("spec", {}) or {}
    position_stats = trend_data.get("position_statistics", {}) or {}
    sample_count = trend_data.get("sample_count", 0)

    product_group = trend_data.get("product_group", "")
    process = trend_data.get("process", "")
    target = trend_data.get("target", "")
    period_desc = trend_data.get("period_desc", "")

    # 측정 시계열 (최근 30개)
    measurements = trend_data.get("measurements", []) or []
    recent = measurements[-30:] if measurements else []
    recent_lines = []
    for m in recent:
        date = (m.get("created_at") or "")[:10]
        lot = m.get("lot_no", "")
        avg = m.get("avg")
        try:
            avg_str = f"{float(avg):.3f}" if avg is not None else "N/A"
        except (TypeError, ValueError):
            avg_str = str(avg)
        recent_lines.append(f"  - {date} | LOT {lot} | 평균 {avg_str}")
    recent_str = "\n".join(recent_lines) if recent_lines else "데이터 없음"

    # 추세(선형 회귀 기울기) 계산
    trend_slope_str = "N/A"
    trend_direction = "N/A"
    try:
        avgs = []
        for m in measurements:
            v = m.get("avg")
            if v is not None:
                avgs.append(float(v))
        n = len(avgs)
        if n >= 3:
            xs = list(range(n))
            mx = sum(xs) / n
            my = sum(avgs) / n
            num = sum((xs[i] - mx) * (avgs[i] - my) for i in range(n))
            den = sum((xs[i] - mx) ** 2 for i in range(n))
            slope = num / den if den else 0.0
            total_change = slope * (n - 1)
            trend_slope_str = f"{slope:.5f}/회 (전체 변화량 ≈ {total_change:+.4f})"
            if abs(total_change) < (overall.get("std_dev") or 0) * 0.5:
                trend_direction = "유의미한 추세 없음(안정)"
            elif slope > 0:
                trend_direction = "상승 추세"
            else:
                trend_direction = "하락 추세"
    except Exception as e:
        logger.warning(f"추세 계산 실패: {e}")

    # 위치별 통계 요약
    position_lines = []
    pos_name = {"top": "상", "center": "중", "bottom": "하", "left": "좌", "right": "우"}
    for pos, ps in position_stats.items():
        if not isinstance(ps, dict):
            continue
        position_lines.append(
            f"  - {pos_name.get(pos, pos)}: 평균 {ps.get('avg', 'N/A')}, "
            f"표준편차 {ps.get('std_dev', 'N/A')}, 범위 {ps.get('range', 'N/A')}"
        )
    position_summary = "\n".join(position_lines) if position_lines else "데이터 없음"

    # 변경점 요약
    change_points = trend_data.get("change_points", []) or []
    cp_lines = []
    for cp in change_points[:10]:
        cp_date = (cp.get("change_date") or cp.get("date") or "")[:10]
        cp_type = cp.get("change_type", "")
        cp_desc = cp.get("description", "") or cp.get("reason", "")
        cp_lines.append(f"  - {cp_date} | {cp_type} | {cp_desc}")
    cp_summary = "\n".join(cp_lines) if cp_lines else "없음"

    prompt = f"""당신은 반도체/디스플레이 공정의 추이(Trend) 분석 전문가입니다.
DICD(Developed Image Critical Dimension)는 포토리소그래피 공정에서 현상 후 패턴의 임계 치수를 측정한 값입니다.

아래 추이 분석 데이터를 해석하고, 공정 엔지니어가 즉시 활용할 수 있는 실용적인 분석 결과를 제공하세요.
SPC 분석과 달리 본 분석은 **시간에 따른 변화 추세, 위치별 균일성, 변경점과의 연관성**에 집중합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[분석 대상]
- 제품군: {product_group}
- 공정: {process}
- 타겟: {target}
- 분석 기간: {period_desc}
- 총 측정 수: {sample_count}개

[SPEC 정보]
- USL: {spec.get('usl', 'N/A')}
- LSL: {spec.get('lsl', 'N/A')}
- Target: {spec.get('target', 'N/A')}

[기본 통계]
- 평균: {overall.get('avg', 'N/A')}
- 표준편차: {overall.get('std_dev', 'N/A')}
- 최소/최대: {overall.get('min', 'N/A')} / {overall.get('max', 'N/A')}
- 범위: {overall.get('range', 'N/A')}

[공정능력지수]
- Cp: {capability.get('cp', 'N/A')}
- Cpk: {capability.get('cpk', 'N/A')}
- Pp: {capability.get('pp', 'N/A')}
- Ppk: {capability.get('ppk', 'N/A')}

[추세 분석 (선형 회귀)]
- 방향: {trend_direction}
- 기울기: {trend_slope_str}

[위치별 통계 (웨이퍼 내 균일성)]
{position_summary}

[변경점 이력]
{cp_summary}

[최근 측정 시계열 (최대 30개)]
{recent_str}
━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 형식으로 분석 결과를 작성하세요:

## 1. 추이 핵심 요약
시간 흐름에 따른 변화의 핵심을 한 문장으로 요약하세요. (안정/상승/하락/주기성 등)

## 2. 추세 분석
- 전체 기간에 걸친 평균값의 이동 방향과 변화량
- SPEC 대비 여유도 변화 (목표 대비 드리프트 여부)
- 변동성(표준편차) 변화의 시사점

## 3. 위치별 균일성 평가
상/중/하/좌/우 위치별 평균과 산포를 비교하여 웨이퍼 내 균일성(WIWNU) 문제를 진단하세요.
특정 위치 편향이 있다면 그 의미를 설명하세요.

## 4. 변경점 연관성
이력상 변경점이 추세 변화 시점과 일치하는지 평가하고, 영향도를 추정하세요.
변경점이 없다면 추세 변화가 자연 드리프트인지 잠재 변경 요인인지 추정하세요.

## 5. 원인 추정
관찰된 추세/편향의 가능한 공정적 원인을 가능성 높음/낮음으로 구분하여 제시하세요.
(노광 에너지 드리프트, 현상액 농도, PR 두께 변화, 핫플레이트 온도 편차, 장비 노후화 등)

## 6. 조치 권고
구체적이고 실행 가능한 모니터링/개선 조치를 우선순위별로 제시하세요.

## 7. 위험도 평가
🟢 양호 / 🟡 주의 / 🔴 위험 중 하나로 평가하고 근거를 간단히 설명하세요.

한국어로 답변하세요.
결과는 역피라미드 구조(가장 중요한 결론이 맨 앞)로 작성할 것.
수치 해석에 매몰되지 말고, 실제 물리적 공정과의 연결고리를 강화할 것.
공정 엔지니어가 이해할 수 있도록 전문 용어를 적절히 사용하되, 명확하게 설명하세요."""

    return prompt


async def analyze_trend_with_ai(trend_data: dict) -> dict:
    """추이 분석 데이터를 Gemini API로 분석"""

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

    prompt = _build_trend_prompt(trend_data)

    logger.info("=" * 60)
    logger.info("[AI 분석] 추이 분석 프롬프트:")
    logger.info("=" * 60)
    logger.info(prompt)
    logger.info("=" * 60)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                top_p=0.9,
                top_k=40,
                max_output_tokens=8192,
            )
        )

        logger.info("[AI 분석] 추이 분석 응답:")
        logger.info("=" * 60)
        logger.info(response.text)
        logger.info("=" * 60)

        return {
            "success": True,
            "analysis": response.text,
            "prompt": prompt
        }

    except Exception as e:
        logger.error(f"Gemini API 호출 실패(추이): {e}")
        return {
            "success": False,
            "error": f"AI 분석 중 오류가 발생했습니다: {str(e)}"
        }
